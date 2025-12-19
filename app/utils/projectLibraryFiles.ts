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


