import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildingProposalAddressBlock } from "@/app/utils/resolveBuildingProposalOffice";

type OfficeRow = {
  id: string;
  officer_name: string;
  line1: string;
  line2: string;
  line3: string;
};

/** Load all Building Proposal office blocks keyed by slug (`city`, `western_i`, etc.). */
export async function fetchBuildingProposalOffices(
  supabase: SupabaseClient
): Promise<Record<string, BuildingProposalAddressBlock> | null> {
  try {
    const { data, error } = await supabase
      .from("building_proposal_offices")
      .select("id, officer_name, line1, line2, line3");

    if (error || !data?.length) return null;

    const map: Record<string, BuildingProposalAddressBlock> = {};
    for (const row of data as OfficeRow[]) {
      const id = row.id?.trim();
      if (!id) continue;
      map[id] = {
        officerName: row.officer_name?.trim() ?? "",
        line1: row.line1?.trim() ?? "",
        line2: row.line2?.trim() ?? "",
        line3: row.line3?.trim() ?? "",
      };
    }

    return Object.keys(map).length > 0 ? map : null;
  } catch {
    return null;
  }
}
