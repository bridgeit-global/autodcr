"use client";

import dynamic from "next/dynamic";

const CadEmbedClient = dynamic(() => import("./CadEmbedClient"), { ssr: false });

export default function CadEmbedPage() {
  return <CadEmbedClient />;
}
