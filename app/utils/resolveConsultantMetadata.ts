import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from "@/app/utils/supabaseEnv";

function isAuthUserUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim()
  );
}

export type ResolveConsultantMetadataOptions = {
  lookupUserIds?: string[];
};

/**
 * Loads merged consultant `user_metadata` for the current session (Auth + optional admin + RPC).
 * Used by preview PDF / DOCX so COA fields match `auth.users` / `raw_user_meta_data`.
 */
export async function resolveConsultantMetadata(
  access_token: string,
  options?: ResolveConsultantMetadataOptions
): Promise<Record<string, unknown> | null> {
  const url = getSupabasePublicUrl();
  const anonKey = getSupabasePublicAnonKey();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${access_token}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();

  if (userErr || !user) return null;

  let meta: Record<string, unknown> = {
    ...(typeof user.user_metadata === "object" && user.user_metadata !== null
      ? (user.user_metadata as Record<string, unknown>)
      : {}),
  };

  let adminClient: ReturnType<typeof createClient> | null = null;
  if (serviceRole) {
    adminClient = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminData, error: adminErr } = await adminClient.auth.admin.getUserById(user.id);
    if (
      !adminErr &&
      adminData?.user?.user_metadata &&
      typeof adminData.user.user_metadata === "object"
    ) {
      meta = {
        ...meta,
        ...(adminData.user.user_metadata as Record<string, unknown>),
      };
    }
  }

  const rpcClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function nonEmptyMeta(key: string): boolean {
    const v = meta[key];
    if (v === null || v === undefined) return false;
    return String(v).trim().length > 0;
  }

  function mergeNeedsCoa(): boolean {
    return !nonEmptyMeta("coa_reg_no") || !nonEmptyMeta("coa_expiry_date");
  }

  function mergeRpcRows(rows: unknown): void {
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    if (!list.length) return;
    const row = list[0] as Record<string, unknown>;
    let raw: unknown =
      row.raw_user_meta_data ??
      row.user_metadata ??
      row.metadata ??
      row.Raw_User_Meta_Data;

    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw) as unknown;
      } catch {
        raw = null;
      }
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      meta = { ...meta, ...(raw as Record<string, unknown>) };
    }
  }

  function inferMissingCoa(): void {
    const entries = Object.entries(meta);
    const strVals = entries.filter(([, v]) => typeof v === "string").map(([, v]) => String(v).trim());

    if (!nonEmptyMeta("coa_reg_no")) {
      for (const [, v] of entries) {
        if (typeof v !== "string") continue;
        const t = v.trim();
        if (/^CA\/\d{4}\//i.test(t)) {
          meta.coa_reg_no = t;
          break;
        }
      }
      if (!nonEmptyMeta("coa_reg_no")) {
        for (const s of strVals) {
          if (/^CA\/\d{4}\//i.test(s)) {
            meta.coa_reg_no = s;
            break;
          }
        }
      }
    }

    if (!nonEmptyMeta("coa_expiry_date")) {
      for (const [k, v] of entries) {
        if (typeof v !== "string") continue;
        const kl = k.toLowerCase();
        const t = v.trim();
        if (
          (/expiry|expir|valid|coa/i.test(kl) && /^\d{4}-\d{2}-\d{2}$/.test(t)) ||
          (/^\d{4}-\d{2}-\d{2}$/.test(t) && kl.includes("coa"))
        ) {
          meta.coa_expiry_date = t;
          break;
        }
      }
    }
  }

  const preferredLookupIds = [
    ...new Set(
      (options?.lookupUserIds ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean)
    ),
  ];

  /**
   * Directory often stores `auth.users.id` (UUID). RPC may return an incomplete row; Admin API returns full `user_metadata` (COA keys).
   */
  if (adminClient && mergeNeedsCoa()) {
    for (const lookupId of preferredLookupIds) {
      if (!isAuthUserUuid(lookupId)) continue;
      const { data: consultantAdmin, error: consultantErr } =
        await adminClient.auth.admin.getUserById(lookupId);
      if (
        consultantErr &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn(
          "[resolveConsultantMetadata] admin.getUserById(preferred) failed:",
          lookupId,
          consultantErr.message
        );
      }
      if (
        !consultantErr &&
        consultantAdmin?.user?.user_metadata &&
        typeof consultantAdmin.user.user_metadata === "object"
      ) {
        meta = {
          ...meta,
          ...(consultantAdmin.user.user_metadata as Record<string, unknown>),
        };
      }
      if (!mergeNeedsCoa()) break;
    }
  }

  if (mergeNeedsCoa()) {
    for (const lookupId of preferredLookupIds) {
      const { data: rows, error: rpcErr } = await rpcClient.rpc("get_user_email_by_user_id", {
        lookup_user_id: lookupId,
      });
      if (!rpcErr) mergeRpcRows(rows);
      if (!mergeNeedsCoa()) break;
    }
  }

  if (mergeNeedsCoa()) {
    const portalId = typeof meta.user_id === "string" ? meta.user_id.trim() : "";
    if (portalId && !preferredLookupIds.includes(portalId)) {
      const { data: rows, error: rpcErr } = await rpcClient.rpc("get_user_email_by_user_id", {
        lookup_user_id: portalId,
      });
      if (!rpcErr) mergeRpcRows(rows);
    }
  }

  if (mergeNeedsCoa() && !preferredLookupIds.includes(user.id)) {
    const { data: rowsByUuid, error: rpcErr2 } = await rpcClient.rpc("get_user_email_by_user_id", {
      lookup_user_id: user.id,
    });
    if (!rpcErr2) mergeRpcRows(rowsByUuid);
  }

  inferMissingCoa();

  return meta;
}
