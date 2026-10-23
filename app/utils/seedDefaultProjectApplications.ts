import { fetchApplicationCatalogTypes } from "@/app/utils/applicationCatalog";
import {
  createApplicationForOwner,
  getAuthUserId,
} from "@/app/utils/ownerApplicationRpc";

const DEFAULT_DEPARTMENTS = new Set([
  "maharera",
  "airport authority of india",
  "lift",
]);

export type SeedDefaultProjectApplicationsResult = {
  failedTitles: string[];
  error?: string;
};

function applicationLabel(department: string, title: string): string {
  return `${department} — ${title}`;
}

/** Draft applications created the first time a project is submitted. */
export async function seedDefaultProjectApplications(input: {
  projectId: string;
  projectTitle: string;
}): Promise<SeedDefaultProjectApplicationsResult> {
  const ownerId = await getAuthUserId();
  if (!ownerId) {
    return {
      failedTitles: [],
      error: "You must be signed in to create the default applications.",
    };
  }

  const catalogTypes = await fetchApplicationCatalogTypes();
  const defaults = catalogTypes.filter((type) =>
    DEFAULT_DEPARTMENTS.has(type.department.trim().toLowerCase())
  );

  if (defaults.length === 0) {
    return {
      failedTitles: [],
      error:
        "Default applications for MahaRERA, Airport Authority of India, and Lift could not be found.",
    };
  }

  const results = await Promise.all(
    defaults.map(async (type) => {
      const label = applicationLabel(type.department, type.application_title);
      const result = await createApplicationForOwner(ownerId, {
        projectId: input.projectId,
        projectTitle: input.projectTitle,
        department: type.department,
        permissionType: type.application_title,
        workflowStage: "draft",
      });
      if ("applicationId" in result) return null;
      if (result.code === "23505") return null;
      return label;
    })
  );

  return { failedTitles: results.filter((title): title is string => Boolean(title)) };
}
