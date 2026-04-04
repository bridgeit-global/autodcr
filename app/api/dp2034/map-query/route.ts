import { NextRequest, NextResponse } from "next/server";
import ctsMappingData from "@/app/utils/villageToCtsMapping.json";
import { isDp2034GisTpsMappingKey } from "@/app/utils/dp2034FpWards";

type QueryType = "tps" | "fp";

type CtsMapping = Record<string, Record<string, string[]>>;

const DATA = ctsMappingData as unknown as CtsMapping;

function sortFpLike(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * TPS names and FP numbers from `villageToCtsMapping.json` (GIS rows merged by
 * `scripts/fetch-dp2034-fp-static.mjs` under keys starting with "TPS ").
 * No outbound calls to agsmaps.mcgm.gov.in.
 *
 * - type=tps: TPS_NAME labels for WARD
 * - type=fp: FP_NO list for WARD + TPS_NAME
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as QueryType | null;
  const wardParam = request.nextUrl.searchParams.get("ward")?.trim();

  if (!wardParam || (type !== "tps" && type !== "fp")) {
    return NextResponse.json({ error: "Missing or invalid type/ward", values: [] }, { status: 400 });
  }

  const wardBlock = DATA[wardParam];
  if (!wardBlock) {
    return NextResponse.json({ values: [] });
  }

  if (type === "tps") {
    const values = Object.keys(wardBlock)
      .filter(isDp2034GisTpsMappingKey)
      .sort(sortFpLike);
    return NextResponse.json({ values });
  }

  const tps = request.nextUrl.searchParams.get("tps")?.trim();
  if (!tps) {
    return NextResponse.json({ error: "Missing tps for type=fp", values: [] }, { status: 400 });
  }

  const fps = wardBlock[tps];
  const values = fps ? [...fps].sort(sortFpLike) : [];
  return NextResponse.json({ values });
}
