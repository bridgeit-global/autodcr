export const CAD_EMBED_SOURCE = "autodcr-cad-embed";
export const CAD_HOST_SOURCE = "autodcr-cad-host";

export type CadOpenMode = "review" | "write";

export type CadEmbedToParent =
  | { source: typeof CAD_EMBED_SOURCE; type: "ready" }
  | {
      source: typeof CAD_EMBED_SOURCE;
      type: "opened";
      ok: boolean;
      name?: string;
      error?: string;
    }
  | { source: typeof CAD_EMBED_SOURCE; type: "status"; message: string }
  | {
      source: typeof CAD_EMBED_SOURCE;
      type: "exported";
      requestId: string;
      ok: boolean;
      name?: string;
      buffer?: ArrayBuffer;
      error?: string;
    };

export type CadParentToEmbed =
  | {
      source: typeof CAD_HOST_SOURCE;
      type: "open";
      name: string;
      buffer: ArrayBuffer;
      mode?: CadOpenMode;
    }
  | { source: typeof CAD_HOST_SOURCE; type: "command"; cmd: string }
  | { source: typeof CAD_HOST_SOURCE; type: "export"; requestId: string }
  | { source: typeof CAD_HOST_SOURCE; type: "cancel" }
  | { source: typeof CAD_HOST_SOURCE; type: "clear" };

export function isCadEmbedMessage(data: unknown): data is CadEmbedToParent {
  if (!data || typeof data !== "object") return false;
  const msg = data as { source?: unknown; type?: unknown };
  return msg.source === CAD_EMBED_SOURCE && typeof msg.type === "string";
}

export function isCadHostMessage(data: unknown): data is CadParentToEmbed {
  if (!data || typeof data !== "object") return false;
  const msg = data as { source?: unknown; type?: unknown };
  return msg.source === CAD_HOST_SOURCE && typeof msg.type === "string";
}
