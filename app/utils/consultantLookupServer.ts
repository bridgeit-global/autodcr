import { createHash, randomBytes } from "crypto";
import { createClient, type User } from "@supabase/supabase-js";
import {
  COMPLETION_TOKEN_EXPIRES_META_KEY,
  COMPLETION_TOKEN_HASH_META_KEY,
  COMPLETION_TOKEN_TTL_DAYS,
  getCompletionTokenExpiryIso,
  getPhoneFromMetadata,
  getRegistrationCompleteness,
  getRegistrationNumberFromMetadata,
  isCompletionTokenExpired,
  normalizePhone,
  normalizeRegNo,
  REGISTRATION_NUMBER_META_BY_TYPE,
} from "@/app/utils/consultantRegistrationShared";
import {
  getOwnerRegistrationNumberFromMetadata,
  OWNER_REGISTRATION_META_BY_TYPE,
} from "@/app/utils/ownerRegistrationShared";
import { getSupabasePublicUrl } from "@/app/utils/supabaseEnv";

export type ConsultantLookupMatch = {
  user_id: string;
  email: string;
  metadata: Record<string, unknown>;
  status: "incomplete" | "complete";
};

export function createServiceRoleClient() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(getSupabasePublicUrl(), serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listAllAuthUsers(
  admin: ReturnType<typeof createServiceRoleClient>
): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

function toMatch(user: User): ConsultantLookupMatch {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  return {
    user_id: user.id,
    email: user.email || String(metadata.email || ""),
    metadata,
    status: getRegistrationCompleteness(metadata),
  };
}

export async function findConsultantByPhone(
  admin: ReturnType<typeof createServiceRoleClient>,
  phone: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 10) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const role = String(meta.role || "");
    if (role && role !== "Consultant") continue;

    const metaPhone = getPhoneFromMetadata(meta);
    const authPhone = normalizePhone(user.phone || "");
    if (metaPhone === normalized || authPhone === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export async function findConsultantByRegistrationNumber(
  admin: ReturnType<typeof createServiceRoleClient>,
  registrationNumber: string,
  consultantType?: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = normalizeRegNo(registrationNumber);
  if (!normalized) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const role = String(meta.role || "");
    if (role && role !== "Consultant") continue;

    if (consultantType) {
      const mapping = REGISTRATION_NUMBER_META_BY_TYPE[consultantType];
      if (!mapping) continue;
      const value = normalizeRegNo(String(meta[mapping.metaKey] || ""));
      if (value && value === normalized) {
        return toMatch(user);
      }
      continue;
    }

    const anyReg = getRegistrationNumberFromMetadata(meta);
    if (anyReg && anyReg === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export async function findConsultantByEmail(
  admin: ReturnType<typeof createServiceRoleClient>,
  email: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const userEmail = (user.email || "").trim().toLowerCase();
    const metaEmail = String(
      ((user.user_metadata || {}) as Record<string, unknown>).email || ""
    )
      .trim()
      .toLowerCase();
    if (userEmail === normalized || metaEmail === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export async function findOwnerByPhone(
  admin: ReturnType<typeof createServiceRoleClient>,
  phone: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 10) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const role = String(meta.role || "");
    if (role && role !== "Owner") continue;

    const metaPhone = getPhoneFromMetadata(meta);
    const authPhone = normalizePhone(user.phone || "");
    if (metaPhone === normalized || authPhone === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export async function findOwnerByRegistrationNumber(
  admin: ReturnType<typeof createServiceRoleClient>,
  registrationNumber: string,
  entityType?: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = normalizeRegNo(registrationNumber);
  if (!normalized) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const role = String(meta.role || "");
    if (role && role !== "Owner") continue;

    if (entityType) {
      const mapping = OWNER_REGISTRATION_META_BY_TYPE[entityType];
      if (!mapping) continue;
      const value = normalizeRegNo(String(meta[mapping.metaKey] || ""));
      if (value && value === normalized) {
        return toMatch(user);
      }
      continue;
    }

    const anyReg = getOwnerRegistrationNumberFromMetadata(meta);
    if (anyReg && anyReg === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export async function findOwnerByEmail(
  admin: ReturnType<typeof createServiceRoleClient>,
  email: string
): Promise<ConsultantLookupMatch | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const role = String(meta.role || "");
    if (role && role !== "Owner") continue;

    const userEmail = (user.email || "").trim().toLowerCase();
    const metaEmail = String(meta.email || "")
      .trim()
      .toLowerCase();
    if (userEmail === normalized || metaEmail === normalized) {
      return toMatch(user);
    }
  }
  return null;
}

export function generateCompletionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCompletionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findConsultantByCompletionToken(
  admin: ReturnType<typeof createServiceRoleClient>,
  token: string
): Promise<
  | (ConsultantLookupMatch & { reason?: never })
  | { reason: "invalid" | "expired" | "complete" }
> {
  const normalized = String(token || "").trim();
  if (!normalized) return { reason: "invalid" };

  const tokenHash = hashCompletionToken(normalized);
  const users = await listAllAuthUsers(admin);

  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const storedHash = String(meta[COMPLETION_TOKEN_HASH_META_KEY] || "").trim();
    if (!storedHash || storedHash !== tokenHash) continue;

    const status = getRegistrationCompleteness(meta);
    if (status === "complete") {
      return { reason: "complete" };
    }

    const expiresAt = String(meta[COMPLETION_TOKEN_EXPIRES_META_KEY] || "");
    if (isCompletionTokenExpired(expiresAt)) {
      return { reason: "expired" };
    }

    return toMatch(user);
  }

  return { reason: "invalid" };
}

export function buildCompletionTokenMetadata(
  token: string,
  ttlDays = COMPLETION_TOKEN_TTL_DAYS
): Record<string, string> {
  return {
    [COMPLETION_TOKEN_HASH_META_KEY]: hashCompletionToken(token),
    [COMPLETION_TOKEN_EXPIRES_META_KEY]: getCompletionTokenExpiryIso(ttlDays),
  };
}

/** Finds the login User ID for a registered email address (username recovery). */
export async function findLoginUserIdByEmail(
  admin: ReturnType<typeof createServiceRoleClient>,
  email: string
): Promise<{ login_user_id: string; email: string } | null> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const users = await listAllAuthUsers(admin);
  for (const user of users) {
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const userEmail = (user.email || "").trim().toLowerCase();
    const metaEmail = String(meta.email || "")
      .trim()
      .toLowerCase();
    if (userEmail !== normalizedEmail && metaEmail !== normalizedEmail) continue;

    const loginUserId = String(meta.user_id || "").trim();
    if (!loginUserId) continue;

    return {
      login_user_id: loginUserId,
      email: user.email || normalizedEmail,
    };
  }
  return null;
}
