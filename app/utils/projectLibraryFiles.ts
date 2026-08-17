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

const keyForIndex = (index: number) => `slot:${index}`;
const keyForExtraPr = (slotId: string) => `extra-pr:${slotId}`;

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


