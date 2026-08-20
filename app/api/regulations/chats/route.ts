import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserClient, isUuid } from "@/app/lib/regulationsRag/chatAuth";
import { mapChatSummary } from "@/app/lib/regulationsRag/chatStore";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const projectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "A valid projectId is required." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("regulation_chats")
    .select(
      "id, project_id, title, authorities, document_filename, document_pages, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[regulations/chats] list", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    chats: (data || []).map(mapChatSummary),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserClient(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: unknown;
    authorities?: unknown;
    title?: unknown;
  };
  const projectId = String(body.projectId || "").trim();
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "A valid projectId is required." }, { status: 400 });
  }

  const authorities = normalizeAuthorities(body.authorities);
  const title = String(body.title || "").trim().slice(0, 80) || "New chat";

  const { data, error } = await auth.client
    .from("regulation_chats")
    .insert({
      user_id: auth.user.id,
      project_id: projectId,
      title,
      authorities,
    })
    .select(
      "id, project_id, title, authorities, document_filename, document_pages, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    console.error("[regulations/chats] create", error?.message);
    return NextResponse.json(
      { error: error?.message || "Could not create chat. Check project access." },
      { status: 400 }
    );
  }

  return NextResponse.json({ chat: mapChatSummary(data) });
}
