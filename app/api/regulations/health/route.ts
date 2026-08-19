import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/regulationsRag/config";

export const runtime = "nodejs";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    ok: true,
    llmProvider: config.llmProvider,
    model: config.chatModel,
    embedModel: config.embedModel,
    baseURL: config.baseURL,
    docsDir: config.docsDir,
    vectorDb: "pinecone",
    pineconeIndex: config.pineconeIndex,
    pineconeConfigured: Boolean(config.pineconeApiKey),
  });
}
