import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  findOwnerByPhone,
  findOwnerByRegistrationNumber,
} from "@/app/utils/consultantLookupServer";
import { normalizePhone, normalizeRegNo } from "@/app/utils/ownerRegistrationShared";

/**
 * Lookup owner by phone and/or registration number.
 * POST body: { phone?: string, registrationNumber?: string, entityType?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const registrationNumber = normalizeRegNo(body.registrationNumber);
    const entityType =
      typeof body.entityType === "string" ? body.entityType.trim() : "";

    if (!phone && !registrationNumber) {
      return NextResponse.json(
        { error: "phone or registrationNumber is required" },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();

    if (phone) {
      if (phone.length !== 10) {
        return NextResponse.json(
          { error: "Enter a valid 10-digit phone number" },
          { status: 400 }
        );
      }
      const match = await findOwnerByPhone(admin, phone);
      if (!match) {
        return NextResponse.json({ status: "not_found" });
      }
      return NextResponse.json({
        status: match.status,
        user_id: match.user_id,
        email: match.email,
        metadata: match.metadata,
        match_by: "phone",
      });
    }

    const match = await findOwnerByRegistrationNumber(
      admin,
      registrationNumber,
      entityType || undefined
    );
    if (!match) {
      return NextResponse.json({ status: "not_found" });
    }
    return NextResponse.json({
      status: match.status,
      user_id: match.user_id,
      email: match.email,
      metadata: match.metadata,
      match_by: "registration_number",
    });
  } catch (err) {
    console.error("[owners/lookup]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to lookup owner",
      },
      { status: 500 }
    );
  }
}
