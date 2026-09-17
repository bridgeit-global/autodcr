import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CORRESPONDENCE_AUTHORITY_ALL,
  type CorrespondenceOfficesByAuthority,
} from "@/app/utils/resolveBuildingProposalOffice";

export const CORRESPONDENCE_TYPE_BUILDING_PROPOSAL = "building_proposal";
export const CORRESPONDENCE_TYPE_FIRE_CONSULTANT = "fire_consultant";

type OfficeRow = {
  id: string;
  authority: string | null;
  officer_name: string;
  organisation: string | null;
  line1: string;
  line2: string;
  line3: string;
};

/**
 * Load correspondence office blocks for one letter type, grouped by planning
 * authority (`ALL`, `SRA`, …) and then by office slug.
 */
export async function fetchCorrespondenceOffices(
  supabase: SupabaseClient,
  correspondenceType: string
): Promise<CorrespondenceOfficesByAuthority | null> {
  try {
    const { data, error } = await supabase
      .from("building_proposal_offices")
      .select("id, authority, officer_name, organisation, line1, line2, line3")
      .eq("correspondence_type", correspondenceType);

    if (error || !data?.length) return null;

    const byAuthority: CorrespondenceOfficesByAuthority = {};
    for (const row of data as OfficeRow[]) {
      const id = row.id?.trim();
      if (!id) continue;
      const authority =
        row.authority?.trim().toUpperCase() || CORRESPONDENCE_AUTHORITY_ALL;
      const offices = (byAuthority[authority] ??= {});
      offices[id] = {
        authority,
        officerName: row.officer_name?.trim() ?? "",
        organisation: row.organisation?.trim() ?? "",
        line1: row.line1?.trim() ?? "",
        line2: row.line2?.trim() ?? "",
        line3: row.line3?.trim() ?? "",
      };
    }

    return Object.keys(byAuthority).length > 0 ? byAuthority : null;
  } catch {
    return null;
  }
}
