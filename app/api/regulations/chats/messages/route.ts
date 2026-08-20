import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserClient, isUuid } from "@/app/lib/regulationsRag/chatAuth";
import {
  DOCUMENT_TEXT_MAX,
  MAX_PROPOSAL_FILES,
  historyFromMessages,
  joinExtractedDocuments,
  mapChatSummary,
  mapMessage,
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
import { extractPdf } from "@/app/lib/regulationsRag/pdf";
import { askQuestion } from "@/app/lib/regulationsRag/rag";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";
import type {
  ChatMessageKind,
  ComplianceResult,
  RagSource,
  RegulationChatMessage,
} from "@/app/lib/regulationsRag/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CHAT_SELECT =
  "id, project_id, title, authorities, document_filename, document_pages, document_text, created_at, updated_at";

const MESSAGE_SELECT =
  "id, chat_id, role, content, kind, sources, compliance, filename, error, created_at";

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
    const authorities = normalizeAuthorities(
      formData.get("authorities") ?? formData.get("authority")
    );
    const uploaded = formData
      .getAll("proposal")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!isUuid(projectId)) {
      return NextResponse.json({ error: "A valid projectId is required." }, { status: 400 });
    }
    if (chatIdRaw && !isUuid(chatIdRaw)) {
      return NextResponse.json({ error: "Invalid chat id." }, { status: 400 });
    }

    let filename: string | null = null;
    let extractedText = "";
    let extractedPages = 0;
    const hasFile = uploaded.length > 0;

    if (hasFile) {
      if (uploaded.length > MAX_PROPOSAL_FILES) {
        return NextResponse.json(
          { error: `You can upload up to ${MAX_PROPOSAL_FILES} PDFs at a time.` },
          { status: 400 }
        );
      }
      const config = getConfig();
      const maxBytes = config.uploadMaxMb * 1024 * 1024;
      const parts: { filename: string; text: string; pages: number }[] = [];
      for (const file of uploaded) {
        const name = file.name || "proposal.pdf";
        const mime = file.type || "";
        if (mime !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
          return NextResponse.json(
            { error: `Only PDF proposals are supported (${name}).` },
            { status: 400 }
          );
        }
        if (file.size > maxBytes) {
          return NextResponse.json(
            { error: `${name} must be under ${config.uploadMaxMb} MB.` },
            { status: 400 }
          );
        }
        const extracted = await extractPdf(Buffer.from(await file.arrayBuffer()));
        const text = extracted.text.trim();
        if (!text) {
          return NextResponse.json(
            {
              error: `Could not extract text from ${name}. Scanned/image-only PDFs need OCR (not supported yet).`,
            },
            { status: 400 }
          );
        }
        parts.push({ filename: name, text, pages: extracted.pages });
      }
      const combined = joinExtractedDocuments(parts);
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
          } else {
            const asked = await askQuestion(question, {
              authorities: scopedAuthorities,
              documentText,
              documentFilename,
              notes,
              history: historyFromMessages(priorMessages),
              onStatus: (text) => send({ type: "status", text }),
              onDelta: (text) => send({ type: "token", text }),
            });
            assistantKind = "ask";
            assistantContent = asked.answer;
            sources = asked.sources || [];
          }

          const { data: assistantRow, error: assistantInsertError } = await auth.client
            .from("regulation_chat_messages")
            .insert({
              chat_id: currentChat.id,
              role: "assistant",
              content: assistantContent,
              kind: assistantKind,
              sources,
              compliance,
              error: assistantError,
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
                compliance,
                error: assistantError,
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
