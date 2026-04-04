import { NextRequest, NextResponse } from "next/server";
import {
  DP2034_MAPSERVER_LAYER_13,
  escapeArcSqlString,
  wardDisplayToDp2034Api,
} from "@/app/utils/dp2034MapServer";

type QueryType = "tps" | "fp";

function sortFpLike(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Proxies ArcGIS MapServer/13 queries used by dpremarks.mcgm.gov.in for FP search:
 * - type=tps: distinct TPS_NAME for TYPE='TPS' and WARD
 * - type=fp: distinct FP_NO for TPS_NAME and WARD
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as QueryType | null;
  const wardParam = request.nextUrl.searchParams.get("ward")?.trim();

  if (!wardParam || (type !== "tps" && type !== "fp")) {
    return NextResponse.json({ error: "Missing or invalid type/ward", values: [] }, { status: 400 });
  }

  const apiWard = escapeArcSqlString(wardDisplayToDp2034Api(wardParam));

  let where: string;
  let outFields: string;

  if (type === "tps") {
    where = `TYPE='TPS' AND WARD='${apiWard}'`;
    outFields = "TPS_NAME";
  } else {
    const tps = request.nextUrl.searchParams.get("tps")?.trim();
    if (!tps) {
      return NextResponse.json({ error: "Missing tps for type=fp", values: [] }, { status: 400 });
    }
    where = `TPS_NAME='${escapeArcSqlString(tps)}' AND WARD='${apiWard}'`;
    outFields = "FP_NO";
  }

  const params = new URLSearchParams({
    f: "json",
    where,
    outFields,
    returnGeometry: "false",
    returnDistinctValues: "true",
  });

  const url = `${DP2034_MAPSERVER_LAYER_13}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DP2034-Portal-Proxy/1.0)" },
      next: { revalidate: 3600 },
    });

    const json = (await res.json()) as {
      error?: { message?: string };
      features?: { attributes: Record<string, string | null | undefined> }[];
    };

    if (json.error) {
      return NextResponse.json(
        { error: json.error.message ?? "MapServer error", values: [] },
        { status: 502 }
      );
    }

    const field = type === "tps" ? "TPS_NAME" : "FP_NO";
    const raw =
      json.features?.map((f) => f.attributes?.[field]).filter((v): v is string => !!v && String(v).length > 0) ??
      [];
    const values = [...new Set(raw.map(String))].sort(sortFpLike);

    return NextResponse.json({ values });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message, values: [] }, { status: 502 });
  }
}
