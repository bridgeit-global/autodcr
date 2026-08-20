import { NextRequest, NextResponse } from "next/server";
import { lookupReadyReckonerRatesFromSupabase } from "@/app/utils/readyReckonerServer";

export async function GET(request: NextRequest) {
  const village = request.nextUrl.searchParams.get("village")?.trim() ?? "";
  const survey = request.nextUrl.searchParams.get("survey")?.trim() ?? "";

  if (!village || !survey) {
    return NextResponse.json(
      { error: "Query params 'village' and 'survey' are required." },
      { status: 400 }
    );
  }

  try {
    const result = await lookupReadyReckonerRatesFromSupabase(village, survey);

    if (!result) {
      return NextResponse.json(
        {
          found: false,
          village,
          surveyNo: survey,
          message: "No ready reckoner rate found for this village and survey number.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      village: result.village,
      surveyNo: result.surveyNo,
      requestedSurveyNo: result.requestedSurveyNo,
      marathiVillage: result.marathiVillage,
      rates: result.entry,
    });
  } catch (err) {
    console.error("ready-reckoner lookup failed:", err);
    return NextResponse.json(
      { error: "Failed to load ready reckoner data." },
      { status: 500 }
    );
  }
}
