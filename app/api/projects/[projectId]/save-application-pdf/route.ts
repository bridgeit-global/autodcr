import { NextRequest } from "next/server";
import { POST as saveApplicationPdfPost } from "@/app/api/save-application-pdf/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy nested path — delegates to `/api/save-application-pdf`.
 * Kept for backwards compatibility and Next.js route type generation.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const formData = await request.formData();
  if (!String(formData.get("projectId") ?? "").trim()) {
    formData.set("projectId", projectId.trim());
  }
  const proxy = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: formData,
  });
  return saveApplicationPdfPost(proxy);
}
