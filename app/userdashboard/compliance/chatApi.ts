import { supabase } from "@/app/utils/supabase";
import type {
  ChatMessageReaction,
  ComplianceResult,
  RegulationChatMessage,
  RegulationChatSummary,
} from "@/app/lib/regulationsRag/types";
import {
  DIRECT_PROPOSAL_UPLOAD_MAX_BYTES,
  PROPOSAL_STORAGE_BUCKET,
  regulationChatProposalPath,
} from "@/app/lib/regulationsRag/proposalUploadShared";

export type ChatTurnResult = {
  chat: RegulationChatSummary;
  messages: RegulationChatMessage[];
  userMessage: RegulationChatMessage;
  assistantMessage: RegulationChatMessage;
};

export type ChatTurnHandlers = {
  onStatus?: (text: string) => void;
  onToken?: (text: string) => void;
  onCompliance?: (data: ComplianceResult) => void;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to use regulation chat.");
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response): Promise<string> {
  if (res.status === 413) {
    return "These PDFs are too large for the server. Try fewer files, or compress each PDF and try again.";
  }
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

export async function listRegulationChats(
  projectId: string
): Promise<RegulationChatSummary[]> {
  const res = await fetch(
    `/api/regulations/chats?projectId=${encodeURIComponent(projectId)}`,
    { headers: await authHeaders() }
  );
  const data = (await res.json()) as { chats?: RegulationChatSummary[]; error?: string };
  if (!res.ok) throw new Error(data.error || "Could not load chats.");
  return data.chats || [];
}

export async function getRegulationChat(chatId: string): Promise<{
  chat: RegulationChatSummary;
  messages: RegulationChatMessage[];
}> {
  const res = await fetch(`/api/regulations/chats/${chatId}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json()) as {
    chat?: RegulationChatSummary;
    messages?: RegulationChatMessage[];
    error?: string;
  };
  if (!res.ok || !data.chat) throw new Error(data.error || "Could not load chat.");
  return { chat: data.chat, messages: data.messages || [] };
}

export async function deleteRegulationChat(chatId: string): Promise<void> {
  const res = await fetch(`/api/regulations/chats/${chatId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function setRegulationMessageReaction(
  messageId: string,
  reaction: ChatMessageReaction | null
): Promise<RegulationChatMessage> {
  const res = await fetch(`/api/regulations/chats/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reaction }),
  });
  const data = (await res.json()) as {
    message?: RegulationChatMessage;
    error?: string;
  };
  if (!res.ok || !data.message) {
    throw new Error(data.error || "Could not save reaction.");
  }
  return data.message;
}

function asTurnResult(data: {
  chat?: RegulationChatSummary;
  messages?: RegulationChatMessage[];
  userMessage?: RegulationChatMessage;
  assistantMessage?: RegulationChatMessage;
  error?: string;
}): ChatTurnResult {
  if (!data.chat || !data.userMessage || !data.assistantMessage) {
    throw new Error(data.error || "Could not send message.");
  }
  return {
    chat: data.chat,
    messages: data.messages || [],
    userMessage: data.userMessage,
    assistantMessage: data.assistantMessage,
  };
}

async function readNdjsonTurn(
  res: Response,
  handlers: ChatTurnHandlers
): Promise<ChatTurnResult> {
  if (!res.body) throw new Error("Could not read the reply stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const acc: { result: ChatTurnResult | null } = { result: null };

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as {
      type?: string;
      text?: string;
      error?: string;
      compliance?: ComplianceResult;
      chat?: RegulationChatSummary;
      messages?: RegulationChatMessage[];
      userMessage?: RegulationChatMessage;
      assistantMessage?: RegulationChatMessage;
    };
    if (event.type === "status" && event.text) {
      handlers.onStatus?.(event.text);
      return;
    }
    if (event.type === "token" && event.text) {
      handlers.onToken?.(event.text);
      return;
    }
    if (event.type === "compliance" && event.compliance) {
      handlers.onCompliance?.(event.compliance);
      return;
    }
    if (event.type === "error") {
      throw new Error(event.error || "Request failed.");
    }
    if (event.type === "done") {
      acc.result = asTurnResult(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);
  if (!acc.result) throw new Error("The reply stream ended early.");
  return acc.result;
}

async function removeClientUploads(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabase.storage.from(PROPOSAL_STORAGE_BUCKET).remove(paths);
}

async function attachProposalFiles(
  body: FormData,
  projectId: string,
  files: File[],
  handlers: ChatTurnHandlers
): Promise<string[]> {
  if (!files.length) return [];

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes <= DIRECT_PROPOSAL_UPLOAD_MAX_BYTES) {
    for (const file of files) body.append("proposal", file);
    return [];
  }

  handlers.onStatus?.("Uploading documents…");
  const uploadedPaths: string[] = [];
  try {
    for (const file of files) {
      const path = regulationChatProposalPath(projectId, file.name);
      const { error } = await supabase.storage.from(PROPOSAL_STORAGE_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (error) {
        throw new Error(`Could not upload ${file.name}: ${error.message}`);
      }
      uploadedPaths.push(path);
      body.append("proposalPath", path);
      body.append("proposalName", file.name);
    }
    return uploadedPaths;
  } catch (err) {
    await removeClientUploads(uploadedPaths).catch(() => undefined);
    throw err;
  }
}

export async function sendRegulationChatTurn(
  params: {
    projectId: string;
    chatId?: string;
    question?: string;
    files?: File[] | null;
    file?: File | null;
    authorities: string[];
    notes?: string;
    model?: string;
    reasoningEffort?: string;
    thinking?: boolean;
  },
  handlers: ChatTurnHandlers = {}
): Promise<ChatTurnResult> {
  const body = new FormData();
  body.append("projectId", params.projectId);
  if (params.chatId) body.append("chatId", params.chatId);
  if (params.question?.trim()) body.append("question", params.question.trim());
  if (params.notes?.trim()) body.append("notes", params.notes.trim());
  if (params.model) body.append("model", params.model);
  if (params.reasoningEffort) body.append("reasoningEffort", params.reasoningEffort);
  if (typeof params.thinking === "boolean") {
    body.append("thinking", params.thinking ? "on" : "off");
  }
  if (params.authorities.length) {
    body.append("authorities", params.authorities.join(","));
  }
  const uploads = [
    ...(params.files || []),
    ...(params.file ? [params.file] : []),
  ];
  const uploadedPaths = await attachProposalFiles(
    body,
    params.projectId,
    uploads,
    handlers
  );

  try {
    const res = await fetch("/api/regulations/chats/messages", {
      method: "POST",
      headers: await authHeaders(),
      body,
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(await readError(res));

    if (res.body && !contentType.includes("application/json")) {
      return await readNdjsonTurn(res, handlers);
    }

    const data = (await res.json()) as {
      chat?: RegulationChatSummary;
      messages?: RegulationChatMessage[];
      userMessage?: RegulationChatMessage;
      assistantMessage?: RegulationChatMessage;
      error?: string;
    };
    return asTurnResult(data);
  } catch (err) {
    await removeClientUploads(uploadedPaths).catch(() => undefined);
    throw err;
  }
}
