import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  findConsultantByPhone,
  findConsultantByRegistrationNumber,
} from "@/app/utils/consultantLookupServer";
import { normalizePhone, normalizeRegNo } from "@/app/utils/consultantRegistrationShared";

/**
 * Lookup consultant by phone and/or registration number.
 * POST body: { phone?: string, registrationNumber?: string, consultantType?: string }
 * Returns: { status: 'not_found' | 'incomplete' | 'complete', user_id?, email?, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const registrationNumber = normalizeRegNo(body.registrationNumber);
    const consultantType =
      typeof body.consultantType === "string" ? body.consultantType.trim() : "";

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
      const match = await findConsultantByPhone(admin, phone);
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

    const match = await findConsultantByRegistrationNumber(
      admin,
      registrationNumber,
      consultantType || undefined
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
    console.error("[consultants/lookup]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to lookup consultant",
      },
      { status: 500 }
    );
  }
}
