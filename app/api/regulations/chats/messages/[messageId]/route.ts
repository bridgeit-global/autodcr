import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserClient, isUuid } from "@/app/lib/regulationsRag/chatAuth";
import { mapMessage, MESSAGE_SELECT } from "@/app/lib/regulationsRag/chatStore";
import type { ChatMessageReaction } from "@/app/lib/regulationsRag/types";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ messageId: string }> };

function asReaction(value: unknown): ChatMessageReaction | null | undefined {
  if (value === null) return null;
  if (value === "like" || value === "unlike") return value;
  return undefined;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const { messageId } = await ctx.params;
  if (!isUuid(messageId)) {
    return NextResponse.json({ error: "Invalid message id." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { reaction?: unknown };
  const reaction = asReaction(body.reaction);
  if (reaction === undefined) {
    return NextResponse.json(
      { error: "Reaction must be like, unlike, or null." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.client
    .from("regulation_chat_messages")
    .update({ reaction })
    .eq("id", messageId)
    .select(MESSAGE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  return NextResponse.json({ message: mapMessage(data) });
}
