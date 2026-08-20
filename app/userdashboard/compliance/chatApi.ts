import { supabase } from "@/app/utils/supabase";
import type {
  RegulationChatMessage,
  RegulationChatSummary,
} from "@/app/lib/regulationsRag/types";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to use regulation chat.");
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response): Promise<string> {
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

export async function sendRegulationChatTurn(params: {
  projectId: string;
  chatId?: string;
  question?: string;
  file?: File | null;
  authorities: string[];
  notes?: string;
}): Promise<{
  chat: RegulationChatSummary;
  messages: RegulationChatMessage[];
  userMessage: RegulationChatMessage;
  assistantMessage: RegulationChatMessage;
}> {
  const body = new FormData();
  body.append("projectId", params.projectId);
  if (params.chatId) body.append("chatId", params.chatId);
  if (params.question?.trim()) body.append("question", params.question.trim());
  if (params.notes?.trim()) body.append("notes", params.notes.trim());
  if (params.authorities.length) {
    body.append("authorities", params.authorities.join(","));
  }
  if (params.file) body.append("proposal", params.file);

  const res = await fetch("/api/regulations/chats/messages", {
    method: "POST",
    headers: await authHeaders(),
    body,
  });
  const data = (await res.json()) as {
    chat?: RegulationChatSummary;
    messages?: RegulationChatMessage[];
    userMessage?: RegulationChatMessage;
    assistantMessage?: RegulationChatMessage;
    error?: string;
  };
  if (!res.ok || !data.chat || !data.userMessage || !data.assistantMessage) {
    throw new Error(data.error || "Could not send message.");
  }
  return {
    chat: data.chat,
    messages: data.messages || [],
    userMessage: data.userMessage,
    assistantMessage: data.assistantMessage,
  };
}
