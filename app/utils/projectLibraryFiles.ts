// Minimal IndexedDB helper to store Project Library files locally until final project submission.
// This avoids uploading to Supabase during selection.

const DB_NAME = "autodcr_local_files";
const DB_VERSION = 1;
const STORE = "project_library_files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      })
  );
}

export type ExtraDpKind = "map" | "rl";
export const EXTRA_DP_KINDS: ExtraDpKind[] = ["map", "rl"];

export type ExtraLibraryDocType =
  | "pr-card"
  | "dp-remarks"
  | "dp-remarks-map"
  | "dp-remarks-rl"
  | "crz-remarks"
  | "power-of-attorney";

const keyForIndex = (index: number) => `slot:${index}`;
const keyForExtraPr = (slotId: string) => `extra-pr:${slotId}`;
const keyForExtraDp = (kind: ExtraDpKind) => `extra-dp:${kind}`;
const keyForExtraDoc = (slotId: string) => `extra-doc:${slotId}`;

export async function saveProjectLibraryFile(index: number, file: File): Promise<void> {
  if (typeof window === "undefined") return;
  // Store as Blob + minimal metadata so we can recreate a File later
  const payload = {
    name: file.name,
    type: file.type || "application/pdf",
    lastModified: file.lastModified,
    blob: file,
  };
  await withStore("readwrite", (store) => store.put(payload, keyForIndex(index)));
}

export async function getProjectLibraryFile(
  index: number
): Promise<{ name: string; type: string; lastModified: number; blob: Blob } | null> {
  if (typeof window === "undefined") return null;
  const res = await withStore<any | undefined>("readonly", (store) => store.get(keyForIndex(index)));
  return res ?? null;
}

export async function deleteProjectLibraryFile(index: number): Promise<void> {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.delete(keyForIndex(index)));
}

export async function countProjectLibraryFilesInIndexedDB(expectedSlots: number): Promise<number> {
  if (typeof window === "undefined") return 0;
  let count = 0;
  for (let i = 0; i < expectedSlots; i++) {
    // eslint-disable-next-line no-await-in-loop
    const v = await getProjectLibraryFile(i);
    if (v?.blob) count += 1;
  }
  return count;
}

export type ProjectLibraryUploadMeta = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  path: string;
};

/** Keep draft metadata only for slots that still have a file in IndexedDB. */
export async function reconcileFixedLibraryUploads(
  draftSlots: (ProjectLibraryUploadMeta | undefined)[],
  slotCount: number
): Promise<(ProjectLibraryUploadMeta | undefined)[]> {
  const next: (ProjectLibraryUploadMeta | undefined)[] = Array(slotCount).fill(undefined);
  for (let i = 0; i < slotCount; i++) {
    // eslint-disable-next-line no-await-in-loop
    const local = await getProjectLibraryFile(i);
    if (!local?.blob) continue;
    const draftSlot = draftSlots[i];
    next[i] =
      draftSlot?.name && draftSlot.name === local.name
        ? draftSlot
        : {
            id: draftSlot?.id ?? `local-${i}-${local.lastModified}`,
            name: local.name,
            url: draftSlot?.url ?? "",
            uploadedAt: draftSlot?.uploadedAt ?? new Date().toISOString(),
            path: draftSlot?.path ?? `document-${i + 1}.pdf`,
          };
  }
  return next;
}

export async function hasAllProjectLibraryFiles(expectedSlots: number): Promise<boolean> {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < expectedSlots; i++) {
    const v = await getProjectLibraryFile(i);
    if (!v?.blob) return false;
  }
  return true;
}

/** True if at least one fixed slot has a file in IndexedDB. */
export async function hasAnyProjectLibraryFiles(expectedSlots: number): Promise<boolean> {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < expectedSlots; i++) {
    const v = await getProjectLibraryFile(i);
    if (v?.blob) return true;
  }
  return false;
}

/** Count fixed slots that have a file, plus extras that exist in IndexedDB. */
export async function countAttachedProjectLibraryFiles(
  expectedSlots: number,
  extraSlotIds: string[]
): Promise<number> {
  if (typeof window === "undefined") return 0;
  let count = await countProjectLibraryFilesInIndexedDB(expectedSlots);
  for (const slotId of extraSlotIds) {
    // eslint-disable-next-line no-await-in-loop
    const v = await getExtraLibraryDoc(slotId);
    if (v?.blob) count += 1;
  }
  return count;
}

export async function clearAllProjectLibraryFiles(expectedSlots: number): Promise<void> {
  if (typeof window === "undefined") return;
  for (let i = 0; i < expectedSlots; i++) {
    // best-effort
    // eslint-disable-next-line no-await-in-loop
    await deleteProjectLibraryFile(i);
  }
}

export async function saveExtraPrCard(slotId: string, file: File): Promise<void> {
  if (typeof window === "undefined") return;
  const payload = {
    name: file.name,
    type: file.type || "application/pdf",
    lastModified: file.lastModified,
    blob: file,
  };
  await withStore("readwrite", (store) => store.put(payload, keyForExtraPr(slotId)));
}

export async function getExtraPrCard(
  slotId: string
): Promise<{ name: string; type: string; lastModified: number; blob: Blob } | null> {
  if (typeof window === "undefined") return null;
  const res = await withStore<any | undefined>("readonly", (store) => store.get(keyForExtraPr(slotId)));
  return res ?? null;
}

export async function deleteExtraPrCard(slotId: string): Promise<void> {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.delete(keyForExtraPr(slotId)));
}

/** Remove optional extra PR/PRC slots from IndexedDB by slot id. */
export async function clearAllExtraPrCards(slotIds: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  for (const slotId of slotIds) {
    // eslint-disable-next-line no-await-in-loop
    await deleteExtraPrCard(slotId);
  }
}

export async function saveExtraDpAttachment(
  kind: ExtraDpKind,
  file: File
): Promise<void> {
  if (typeof window === "undefined") return;
  const payload = {
    name: file.name,
    type: file.type || "application/pdf",
    lastModified: file.lastModified,
    blob: file,
  };
  await withStore("readwrite", (store) => store.put(payload, keyForExtraDp(kind)));
}

export async function getExtraDpAttachment(
  kind: ExtraDpKind
): Promise<{ name: string; type: string; lastModified: number; blob: Blob } | null> {
  if (typeof window === "undefined") return null;
  const res = await withStore<any | undefined>("readonly", (store) =>
    store.get(keyForExtraDp(kind))
  );
  return res ?? null;
}

export async function deleteExtraDpAttachment(kind: ExtraDpKind): Promise<void> {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.delete(keyForExtraDp(kind)));
}

export async function clearAllExtraDpAttachments(): Promise<void> {
  if (typeof window === "undefined") return;
  for (const kind of EXTRA_DP_KINDS) {
    // eslint-disable-next-line no-await-in-loop
    await deleteExtraDpAttachment(kind);
  }
}

export async function saveExtraLibraryDoc(
  slotId: string,
  file: File,
  libraryType?: ExtraLibraryDocType
): Promise<void> {
  if (typeof window === "undefined") return;
  const payload = {
    name: file.name,
    type: file.type || "application/pdf",
    lastModified: file.lastModified,
    blob: file,
    libraryType,
  };
  await withStore("readwrite", (store) => store.put(payload, keyForExtraDoc(slotId)));
}

export async function getExtraLibraryDoc(
  slotId: string
): Promise<{ name: string; type: string; lastModified: number; blob: Blob } | null> {
  if (typeof window === "undefined") return null;
  const fromDoc = await withStore<any | undefined>("readonly", (store) =>
    store.get(keyForExtraDoc(slotId))
  );
  if (fromDoc) return fromDoc;
  if (slotId === "legacy-dp-map") return getExtraDpAttachment("map");
  if (slotId === "legacy-dp-rl") return getExtraDpAttachment("rl");
  return getExtraPrCard(slotId);
}

export async function deleteExtraLibraryDoc(slotId: string): Promise<void> {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.delete(keyForExtraDoc(slotId)));
  await deleteExtraPrCard(slotId);
  if (slotId === "legacy-dp-map") await deleteExtraDpAttachment("map");
  if (slotId === "legacy-dp-rl") await deleteExtraDpAttachment("rl");
}

export async function clearAllExtraLibraryDocs(slotIds: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  for (const slotId of slotIds) {
    // eslint-disable-next-line no-await-in-loop
    await deleteExtraLibraryDoc(slotId);
  }
}


