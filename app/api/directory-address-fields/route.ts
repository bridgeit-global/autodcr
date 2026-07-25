import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicUrl } from "@/app/utils/supabaseEnv";

type AddressFields = {
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  pincode: string;
  address: string;
};

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function addressFieldsFromMeta(meta: Record<string, unknown>): AddressFields {
  const address_line1 = pickText(meta.address_line1, meta.addressLine1);
  const address_line2 = pickText(meta.address_line2, meta.addressLine2);
  const address_line3 = pickText(meta.address_line3, meta.addressLine3);
  const city = pickText(meta.city);
  const pincode = pickText(meta.pincode, meta.pin_code, meta.zip);
  const address = pickText(meta.address);
  return { address_line1, address_line2, address_line3, city, pincode, address };
}

/**
 * Batch-load address lines + city/pincode from auth.users user_metadata.
 * Used by Applicant Details directory because get_owners / get_consultants_by_type
 * only return a combined `address` string.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIds: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : [];
    const userIds: string[] = rawIds
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());

    if (userIds.length === 0) {
      return NextResponse.json({ profiles: {} });
    }

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRole) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 500 }
      );
    }

    const admin = createClient(getSupabasePublicUrl(), serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const uniqueIds: string[] = Array.from(new Set(userIds)).slice(0, 100);
    const profiles: Record<string, AddressFields> = {};

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data?.user?.user_metadata) return;
        const meta = data.user.user_metadata as Record<string, unknown>;
        profiles[userId] = addressFieldsFromMeta(meta);
      })
    );

    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("[directory-address-fields]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
