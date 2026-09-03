import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserClient, isUuid } from "@/app/lib/regulationsRag/chatAuth";
import {
  DOCUMENT_TEXT_MAX,
  MESSAGE_SELECT,
  historyFromMessages,
  joinExtractedDocuments,
  mapChatSummary,
  mapMessage,
  messageLlmFields,
  complianceForStore,
  resolveTurnIntent,
  titleFromTurn,
  userMessageText,
} from "@/app/lib/regulationsRag/chatStore";
import { analyzeCompliance } from "@/app/lib/regulationsRag/compliance";
import {
  assertApiKey,
  assertPinecone,
  getConfig,
  ragErrorStatus,
} from "@/app/lib/regulationsRag/config";
import { resolveChatLlmOptions } from "@/app/lib/regulationsRag/llm";
import {
  extractProposalsFromForm,
  removeProposalUploads,
} from "@/app/lib/regulationsRag/proposalUpload";
import { askQuestion } from "@/app/lib/regulationsRag/rag";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";
import type {
  ChatMessageKind,
  ComplianceResult,
  LlmUsage,
  RagSource,
  RegulationChatMessage,
} from "@/app/lib/regulationsRag/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CHAT_SELECT =
  "id, project_id, title, authorities, document_filename, document_pages, document_text, created_at, updated_at";

type ChatRecord = {
  id: string;
  project_id: string;
  title: string;
  authorities: string[] | null;
  document_filename: string | null;
  document_pages: number | null;
  document_text: string | null;
  created_at: string;
  updated_at: string;
};

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  try {
    assertApiKey();
    assertPinecone();

    const formData = await req.formData();
    const projectId = String(formData.get("projectId") || "").trim();
    const chatIdRaw = String(formData.get("chatId") || "").trim();
    const question = String(formData.get("question") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const llm = resolveChatLlmOptions({
      model: formData.get("model"),
      reasoningEffort: formData.get("reasoningEffort"),
      thinking: formData.get("thinking"),
    });
    const authorities = normalizeAuthorities(
      formData.get("authorities") ?? formData.get("authority")
    );

    if (!isUuid(projectId)) {
      return NextResponse.json({ error: "A valid projectId is required." }, { status: 400 });
    }
    if (chatIdRaw && !isUuid(chatIdRaw)) {
      return NextResponse.json({ error: "Invalid chat id." }, { status: 400 });
    }

    const config = getConfig();
    const extracted = await extractProposalsFromForm({
      formData,
      projectId,
      client: auth.client,
      maxBytes: config.uploadMaxMb * 1024 * 1024,
      uploadMaxMb: config.uploadMaxMb,
    });
    await removeProposalUploads(auth.client, extracted.storagePaths).catch(() => undefined);
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: extracted.status });
    }

    let filename: string | null = null;
    let extractedText = "";
    let extractedPages = 0;
    const hasFile = extracted.parts.length > 0;
    if (hasFile) {
      const combined = joinExtractedDocuments(extracted.parts);
      filename = combined.filename;
      extractedText = combined.text;
      extractedPages = combined.pages;
    }

    let chat: ChatRecord | null = null;
    if (chatIdRaw) {
      const { data, error } = await auth.client
        .from("regulation_chats")
        .select(CHAT_SELECT)
        .eq("id", chatIdRaw)
        .eq("user_id", auth.user.id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      chat = data as ChatRecord | null;
      if (!chat) {
        return NextResponse.json({ error: "Chat not found." }, { status: 404 });
      }
    } else {
      const contentForTitle = userMessageText(question, filename);
      const { data, error } = await auth.client
        .from("regulation_chats")
        .insert({
          user_id: auth.user.id,
          project_id: projectId,
          title: titleFromTurn(contentForTitle, filename),
          authorities,
        })
        .select(CHAT_SELECT)
        .single();
      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Could not create chat. Check project access." },
          { status: 400 }
        );
      }
      chat = data as ChatRecord;
    }

    const storedText = String(chat.document_text || "").trim();
    const intent = resolveTurnIntent({
      question,
      hasNewFile: hasFile,
      hasStoredDocument: Boolean(storedText || extractedText),
    });

    if (intent === "compliance" && !extractedText && !storedText) {
      return NextResponse.json(
        { error: "Upload a proposal PDF to run a compliance check." },
        { status: 400 }
      );
    }

    const { data: priorRows } = await auth.client
      .from("regulation_chat_messages")
      .select(MESSAGE_SELECT)
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true });
    const priorMessages = (priorRows || []).map(mapMessage);

    const userContent = userMessageText(question, filename);
    const { data: userRow, error: userInsertError } = await auth.client
      .from("regulation_chat_messages")
      .insert({
        chat_id: chat.id,
        role: "user",
        content: userContent,
        kind: filename ? "document" : "text",
        filename,
      })
      .select(MESSAGE_SELECT)
      .single();
    if (userInsertError || !userRow) {
      return NextResponse.json(
        { error: userInsertError?.message || "Could not save message." },
        { status: 400 }
      );
    }

    const chatPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (authorities.length) chatPatch.authorities = authorities;
    if (extractedText) {
      chatPatch.document_text = extractedText.slice(0, DOCUMENT_TEXT_MAX);
      chatPatch.document_filename = filename;
      chatPatch.document_pages = extractedPages;
      chatPatch.document_chars = extractedText.length;
    }
    if (chat.title === "New chat") {
      chatPatch.title = titleFromTurn(userContent, filename);
    }

    const { data: patchedChat } = await auth.client
      .from("regulation_chats")
      .update(chatPatch)
      .eq("id", chat.id)
      .eq("user_id", auth.user.id)
      .select(CHAT_SELECT)
      .single();
    if (patchedChat) chat = patchedChat as ChatRecord;
    if (!chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
    const currentChat = chat;

    const documentText = extractedText || storedText;
    const documentFilename =
      filename || currentChat.document_filename || "uploaded-document.pdf";
    const scopedAuthorities =
      authorities.length > 0
        ? authorities
        : Array.isArray(currentChat.authorities)
          ? currentChat.authorities
          : [];

    const userMessage = mapMessage(userRow);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        let assistantKind: ChatMessageKind = "ask";
        let assistantContent = "";
        let sources: RagSource[] = [];
        let compliance: ComplianceResult | null = null;
        let assistantError = false;
        let usage: LlmUsage | null = null;

        try {
          send({
            type: "status",
            text:
              intent === "compliance"
                ? "Matching your proposal to regulations…"
                : "Searching the regulation library…",
          });

          if (intent === "compliance") {
            compliance = await analyzeCompliance({
              proposalText: documentText,
              filename: documentFilename,
              authoritiesOverride: scopedAuthorities.length ? scopedAuthorities : null,
              notes,
              pages: extractedPages || currentChat.document_pages,
              llmOptions: llm,
              onStatus: (text) => send({ type: "status", text }),
              onDelta: (text) => send({ type: "token", text }),
              onPartial: (data) => send({ type: "compliance", compliance: data }),
            });
            assistantKind = "compliance";
            assistantContent =
              compliance.summary ||
              (compliance.needsAuthoritySelection
                ? "Select an authority and try again."
                : "Compliance analysis complete.");
            sources = compliance.sources || [];
            usage = compliance.usage || null;
          } else {
            const asked = await askQuestion(question, {
              authorities: scopedAuthorities,
              documentText,
              documentFilename,
              notes,
              history: historyFromMessages(priorMessages),
              llmOptions: llm,
              onStatus: (text) => send({ type: "status", text }),
              onDelta: (text) => send({ type: "token", text }),
            });
            assistantKind = "ask";
            assistantContent = asked.answer;
            sources = asked.sources || [];
            usage = asked.usage || null;
          }

          const { data: assistantRow, error: assistantInsertError } = await auth.client
            .from("regulation_chat_messages")
            .insert({
              chat_id: currentChat.id,
              role: "assistant",
              content: assistantContent,
              kind: assistantKind,
              sources,
              compliance: complianceForStore(compliance),
              error: assistantError,
              ...messageLlmFields(llm.model, usage),
            })
            .select(MESSAGE_SELECT)
            .single();

          if (assistantInsertError || !assistantRow) {
            send({
              type: "error",
              error: assistantInsertError?.message || "Could not save the reply.",
            });
            return;
          }

          const assistantMessage = mapMessage(assistantRow);
          const messages: RegulationChatMessage[] = [
            ...priorMessages,
            userMessage,
            assistantMessage,
          ];
          send({
            type: "done",
            chat: mapChatSummary(currentChat),
            userMessage,
            assistantMessage,
            messages,
          });
        } catch (err) {
          assistantError = true;
          assistantContent = err instanceof Error ? err.message : "Request failed";
          try {
            const { data: assistantRow, error: assistantInsertError } = await auth.client
              .from("regulation_chat_messages")
              .insert({
                chat_id: currentChat.id,
                role: "assistant",
                content: assistantContent,
                kind: assistantKind,
                sources,
                compliance: complianceForStore(compliance),
                error: assistantError,
                ...messageLlmFields(llm.model, usage),
              })
              .select(MESSAGE_SELECT)
              .single();
            if (assistantInsertError || !assistantRow) {
              send({ type: "error", error: assistantContent });
              return;
            }
            const assistantMessage = mapMessage(assistantRow);
            send({
              type: "done",
              chat: mapChatSummary(currentChat),
              userMessage,
              assistantMessage,
              messages: [...priorMessages, userMessage, assistantMessage],
            });
          } catch (inner) {
            send({
              type: "error",
              error: inner instanceof Error ? inner.message : assistantContent,
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    console.error("[regulations/chats/messages]", message);
    return NextResponse.json({ error: message }, { status: ragErrorStatus(err) });
  }
}
