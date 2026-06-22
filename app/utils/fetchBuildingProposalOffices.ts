import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildingProposalAddressBlock } from "@/app/utils/resolveBuildingProposalOffice";
import {
  CORRESPONDENCE_TYPE_BUILDING_PROPOSAL,
  CORRESPONDENCE_TYPE_FIRE_CONSULTANT,
  fetchCorrespondenceOffices,
} from "@/app/utils/fetchCorrespondenceOffices";

/** Load Building Proposal office blocks keyed by slug (`city`, `western_i`, etc.). */
export async function fetchBuildingProposalOffices(
  supabase: SupabaseClient
): Promise<Record<string, BuildingProposalAddressBlock> | null> {
  return fetchCorrespondenceOffices(supabase, CORRESPONDENCE_TYPE_BUILDING_PROPOSAL);
}

/** Load Fire Brigade RCC office blocks keyed by slug (`rcc_i`, … `rcc_vi`). */
export async function fetchFireConsultantOffices(
  supabase: SupabaseClient
): Promise<Record<string, BuildingProposalAddressBlock> | null> {
  return fetchCorrespondenceOffices(supabase, CORRESPONDENCE_TYPE_FIRE_CONSULTANT);
}
