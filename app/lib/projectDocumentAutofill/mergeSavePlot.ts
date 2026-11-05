import { POA_STRIP_KEYS, type ProjectLibraryExtraction, type SavePlotDraftPatch } from "./types";
import {
  defaultPlotBelongsForRegion,
  enrichSavePlotLocation,
  hasLocationData,
  isKnownVillageForWard,
  normalizeDpZoneForForm,
  normalizePlanningAuthority,
  normalizeRegion,
  normalizeVillageForWard,
  normalizeWard,
  normalizeZone,
  inferVillageFromCts,
  parseAddressHints,
  parseExtractsJson,
  pickString,
  sanitizeCtsNumbers,
  splitCtsNumbers,
  sanitizeSacNumbers,
  splitSacNumbers,
  villageDivisionLetterFromCts,
} from "./utils";

function savePlotPatchFromExtracted(
  extracted: Record<string, string | null>,
  includeLocation: boolean
): SavePlotDraftPatch {
  const patch: SavePlotDraftPatch = {};

  const assign = (key: string, value: string) => {
    if (value) patch[key] = value;
  };

  const wardRaw = pickString(extracted.ward);
  const regionRaw = pickString(extracted.region);
  const wardFromRegion = /\bward\b/i.test(regionRaw) ? normalizeWard(regionRaw) : "";
  const ward = normalizeWard(wardRaw || wardFromRegion);

  if (includeLocation) {
    const region = ward ? "" : normalizeRegion(regionRaw);

    assign("planningAuthority", normalizePlanningAuthority(extracted.planningAuthority));
    assign("region", region);
    assign("zone", normalizeZone(extracted.zone));
    assign("ward", ward);
    if (region) {
      const plotBelongs = defaultPlotBelongsForRegion(region);
      if (plotBelongs) patch.plotBelongsTo = plotBelongs;
    }
  }

  const villageCandidate = pickString(extracted.villageName, extracted.plotName);
  const village = normalizeVillageForWard(ward, villageCandidate);
  if (village && (!ward || isKnownVillageForWard(ward, village) || /^bandra$/i.test(village))) {
    assign("villageName", village);
  }

  const villageLetter = villageDivisionLetterFromCts(
    [extracted.proposedCtsNumber, extracted.villageName, extracted.plotName, extracted.propertyAddress]
      .filter(Boolean)
      .join(", ")
  );
  if (villageLetter && /^bandra$/i.test(String(patch.villageName || ""))) {
    assign("villageName", normalizeVillageForWard(ward, `BANDRA-${villageLetter}`));
  }
  assign("grossPlotArea", pickString(extracted.grossPlotArea));
  assign("dpZone", normalizeDpZoneForForm(extracted.dpZone));

  const cts = splitCtsNumbers(extracted.proposedCtsNumber);
  if (cts.length) patch.proposedCtsNumber = cts;

  return patch;
}

function stripPoaLocationKeys(patch: SavePlotDraftPatch): SavePlotDraftPatch {
  const next = { ...patch };
  for (const key of POA_STRIP_KEYS) {
    delete next[key];
  }
  return next;
}

function pickFromExtractions(
  extractions: ProjectLibraryExtraction[],
  selector: (extracted: Record<string, string | null>) => string | null | undefined
): string {
  return pickString(...extractions.map((e) => selector(e.extracted)));
}

/** Primary DigiSatbara / library PR only — extras must not flood Save Plot CTS. */
function primaryPrExtractions(
  extractions: ProjectLibraryExtraction[]
): ProjectLibraryExtraction[] {
  const prCards = extractions.filter((e) => e.documentType === "pr-card");
  const primary =
    prCards.find((e) => e.slot === "pr-primary" || e.fixedIndex === 0) ||
    prCards[0];
  return primary ? [primary] : [];
}

function ctsFromPrExtractions(extractions: ProjectLibraryExtraction[]): string[] {
  const numbers = new Set<string>();

  for (const extraction of primaryPrExtractions(extractions)) {
    for (const cts of splitCtsNumbers(extraction.extracted.proposedCtsNumber)) {
      numbers.add(cts);
    }
    for (const row of parseExtractsJson(extraction.extracted.extractsJson)) {
      const no = pickString(row.extractNo);
      if (!no) continue;
      numbers.add(no);
      const root = no.split("/")[0]?.trim();
      if (root) numbers.add(root);
    }
  }

  return [...numbers];
}

function sacFromAssessmentExtractions(
  extractions: ProjectLibraryExtraction[]
): string[] {
  const numbers = new Set<string>();
  for (const extraction of extractions.filter(
    (e) =>
      e.documentType === "assessment-department" ||
      e.documentType === "property-tax-bill"
  )) {
    for (const sac of splitSacNumbers(extraction.extracted.sacNo)) {
      numbers.add(sac);
    }
  }
  return [...numbers];
}

function supplementSavePlot(
  merged: SavePlotDraftPatch,
  extractions: ProjectLibraryExtraction[]
): SavePlotDraftPatch {
  const docs = extractions.filter(Boolean);
  const next: SavePlotDraftPatch = { ...merged };

  const assignIfEmpty = (key: string, value: string) => {
    if (!value) return;
    if (next[key] != null && String(next[key]).trim()) return;
    next[key] = value;
  };

  assignIfEmpty(
    "planningAuthority",
    normalizePlanningAuthority(
      pickFromExtractions(docs, (e) => e.planningAuthority)
    )
  );

  assignIfEmpty(
    "ward",
    normalizeWard(pickFromExtractions(docs, (e) => e.ward))
  );

  assignIfEmpty(
    "zone",
    normalizeZone(pickFromExtractions(docs, (e) => e.zone))
  );

  assignIfEmpty(
    "region",
    normalizeRegion(pickFromExtractions(docs, (e) => e.region))
  );

  const locationDocs = docs.filter(
    (e) => e.documentType !== "power-of-attorney"
  );

  assignIfEmpty(
    "villageName",
    normalizeVillageForWard(
      pickString(next.ward as string | undefined),
      pickFromExtractions(locationDocs, (e) => e.villageName)
    )
  );

  const villageLetter = villageDivisionLetterFromCts(
    pickFromExtractions(
      docs,
      (e) =>
        [e.proposedCtsNumber, e.villageName, e.plotName, e.propertyAddress, e.landmark]
          .filter(Boolean)
          .join(", ")
    )
  );
  if (
    villageLetter &&
    /^bandra$/i.test(pickString(next.villageName as string | undefined))
  ) {
    next.villageName = normalizeVillageForWard(
      pickString(next.ward as string | undefined),
      `BANDRA-${villageLetter}`
    );
  }

  assignIfEmpty(
    "dpZone",
    normalizeDpZoneForForm(pickFromExtractions(docs, (e) => e.dpZone))
  );
  assignIfEmpty("grossPlotArea", pickFromExtractions(docs, (e) => e.grossPlotArea));

  const hints = parseAddressHints(
    pickFromExtractions(docs, (e) => e.propertyAddress),
    pickFromExtractions(docs, (e) => e.landmark),
    pickFromExtractions(docs, (e) => e.addressOfApplicant)
  );

  assignIfEmpty("ward", hints.ward);
  assignIfEmpty(
    "villageName",
    normalizeVillageForWard(
      pickString(next.ward as string | undefined),
      hints.village
    )
  );

  /*
   * CTS: keep value from location PR / earlier patch (previous behaviour).
   * Only fall back when empty — never union every DigiSatbara extra PR card.
   * SAC: full replace from current assessment set so deleted numbers do not stick.
   */
  if (
    !next.proposedCtsNumber ||
    !(next.proposedCtsNumber as string[]).length
  ) {
    const cts = [
      ...splitCtsNumbers(
        pickFromExtractions(primaryPrExtractions(docs), (e) => e.proposedCtsNumber)
      ),
      ...ctsFromPrExtractions(docs),
      ...hints.cts,
    ];
    if (cts.length) {
      next.proposedCtsNumber = sanitizeCtsNumbers([...new Set(cts)]);
    }
  } else {
    next.proposedCtsNumber = sanitizeCtsNumbers(next.proposedCtsNumber);
  }
  next.sacNo = sacFromAssessmentExtractions(docs);

  const ward = pickString(next.ward as string | undefined);
  const village = pickString(next.villageName as string | undefined);
  const ctsList = sanitizeCtsNumbers(next.proposedCtsNumber);
  if (ward && !village && ctsList.length) {
    const fromCts = inferVillageFromCts(ward, ctsList);
    if (fromCts) next.villageName = fromCts;
  }

  return next;
}

/** Save Plot priority: PRC-with-location → DP → CRZ (POC applyNewLogicFill). */
export function mergeSavePlot(extractions: ProjectLibraryExtraction[]): SavePlotDraftPatch {
  const prWithLocation = extractions.find(
    (e) => e.documentType === "pr-card" && hasLocationData(e.extracted)
  );
  const dp = extractions.find((e) => e.documentType === "dp-remarks");
  const crz = extractions.find((e) => e.documentType === "crz-remarks");
  const poa = extractions.find((e) => e.documentType === "power-of-attorney");

  let merged: SavePlotDraftPatch = {};

  if (prWithLocation) {
    merged = {
      ...merged,
      ...savePlotPatchFromExtracted(prWithLocation.extracted, true),
    };
  }

  if (dp) {
    merged = {
      ...merged,
      ...savePlotPatchFromExtracted(dp.extracted, true),
    };
  }

  if (crz) {
    merged = {
      ...merged,
      ...savePlotPatchFromExtracted(crz.extracted, true),
    };
  }

  if (poa) {
    merged = {
      ...merged,
      ...stripPoaLocationKeys(savePlotPatchFromExtracted(poa.extracted, false)),
    };
  }

  merged = supplementSavePlot(merged, extractions);

  // DigiSatbara date → {{DATE_OF_PRC}}: prefer primary PR, else any remaining PR card.
  const primaryPr =
    extractions.find(
      (e) =>
        e.documentType === "pr-card" &&
        (e.slot === "pr-primary" || e.fixedIndex === 0)
    ) || null;
  const anyPrWithDate = extractions.find(
    (e) =>
      e.documentType === "pr-card" &&
      Boolean(pickString(e.extracted.downloadDate))
  );
  merged.prcDownloadDate =
    pickString(primaryPr?.extracted.downloadDate) ||
    pickString(anyPrWithDate?.extracted.downloadDate) ||
    "";

  // Pure PR cards (no planning location) fill Area Details only — not Save Plot location fields.
  return enrichSavePlotLocation(merged);
}
