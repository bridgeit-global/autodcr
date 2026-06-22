import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildingProposalAddressBlock } from "@/app/utils/resolveBuildingProposalOffice";

export const CORRESPONDENCE_TYPE_BUILDING_PROPOSAL = "building_proposal";
export const CORRESPONDENCE_TYPE_FIRE_CONSULTANT = "fire_consultant";

type OfficeRow = {
  id: string;
  officer_name: string;
  line1: string;
  line2: string;
  line3: string;
};

/** Load correspondence office blocks for one letter type, keyed by office slug. */
export async function fetchCorrespondenceOffices(
  supabase: SupabaseClient,
  correspondenceType: string
): Promise<Record<string, BuildingProposalAddressBlock> | null> {
  try {
    const { data, error } = await supabase
      .from("building_proposal_offices")
      .select("id, officer_name, line1, line2, line3")
      .eq("correspondence_type", correspondenceType);

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
