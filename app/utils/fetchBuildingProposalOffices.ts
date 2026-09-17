import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrespondenceOfficesByAuthority } from "@/app/utils/resolveBuildingProposalOffice";
import {
  CORRESPONDENCE_TYPE_BUILDING_PROPOSAL,
  CORRESPONDENCE_TYPE_FIRE_CONSULTANT,
  fetchCorrespondenceOffices,
} from "@/app/utils/fetchCorrespondenceOffices";

/** Load Building Proposal office blocks by authority, then slug (`city`, `western_i`, …). */
export async function fetchBuildingProposalOffices(
  supabase: SupabaseClient
): Promise<CorrespondenceOfficesByAuthority | null> {
  return fetchCorrespondenceOffices(supabase, CORRESPONDENCE_TYPE_BUILDING_PROPOSAL);
}

/** Load Fire Brigade RCC office blocks by authority, then slug (`rcc_i`, … `rcc_vi`). */
export async function fetchFireConsultantOffices(
  supabase: SupabaseClient
): Promise<CorrespondenceOfficesByAuthority | null> {
  return fetchCorrespondenceOffices(supabase, CORRESPONDENCE_TYPE_FIRE_CONSULTANT);
}
