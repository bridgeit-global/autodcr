import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserClient, isUuid } from "@/app/lib/regulationsRag/chatAuth";
import { mapChatSummary, mapMessage } from "@/app/lib/regulationsRag/chatStore";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ chatId: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const { chatId } = await ctx.params;
  if (!isUuid(chatId)) {
    return NextResponse.json({ error: "Invalid chat id." }, { status: 400 });
  }

  const { data: chat, error: chatError } = await auth.client
    .from("regulation_chats")
    .select(
      "id, project_id, title, authorities, document_filename, document_pages, created_at, updated_at"
    )
    .eq("id", chatId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (chatError) {
    return NextResponse.json({ error: chatError.message }, { status: 400 });
  }
  if (!chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const { data: messages, error: messageError } = await auth.client
    .from("regulation_chat_messages")
    .select(
      "id, chat_id, role, content, kind, sources, compliance, filename, error, created_at"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 400 });
  }

  return NextResponse.json({
    chat: mapChatSummary(chat),
    messages: (messages || []).map(mapMessage),
  });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const { chatId } = await ctx.params;
  if (!isUuid(chatId)) {
    return NextResponse.json({ error: "Invalid chat id." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    authorities?: unknown;
    title?: unknown;
  };
  const patch: { authorities?: string[]; title?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (body.authorities !== undefined) {
    patch.authorities = normalizeAuthorities(body.authorities);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 80);
  }

  const { data, error } = await auth.client
    .from("regulation_chats")
    .update(patch)
    .eq("id", chatId)
    .eq("user_id", auth.user.id)
    .select(
      "id, project_id, title, authorities, document_filename, document_pages, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  return NextResponse.json({ chat: mapChatSummary(data) });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const { chatId } = await ctx.params;
  if (!isUuid(chatId)) {
    return NextResponse.json({ error: "Invalid chat id." }, { status: 400 });
  }

  const { error } = await auth.client
    .from("regulation_chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
