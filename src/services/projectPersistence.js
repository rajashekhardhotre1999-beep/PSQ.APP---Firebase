// ─── PROJECT PERSISTENCE (Firestore + Storage, localStorage fallback) ──────
import { db, storage } from "../firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const COLLECTION = "projects";
const LOCAL_KEY  = "paintpro_v9";

const isFirebaseReady = () => Boolean(db);

function readLocalAll() {
  try {
    const s = localStorage.getItem(LOCAL_KEY);
    if (s) return JSON.parse(s);
  } catch (e) {
    console.error("[projectPersistence] Error reading localStorage:", e);
  }
  return [];
}

function writeLocalAll(arr) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.error("[projectPersistence] Error writing localStorage:", e);
    return false;
  }
}

function upsertLocal(project) {
  const all = readLocalAll();
  const idx = all.findIndex(p => String(p.id) === String(project.id));
  if (idx >= 0) all[idx] = project; else all.unshift(project);
  writeLocalAll(all);
}

function removeLocal(projectId) {
  writeLocalAll(readLocalAll().filter(p => String(p.id) !== String(projectId)));
}

async function uploadPhotoIfNeeded(projectId, photo) {
  if (!photo?.image || !photo.image.startsWith("data:")) return photo;
  if (!storage) return photo;
  try {
    const path = `projects/${projectId}/photos/${photo.id || Date.now()}`;
    const sref = ref(storage, path);
    await uploadString(sref, photo.image, "data_url");
    const url = await getDownloadURL(sref);
    return { ...photo, image: url };
  } catch (err) {
    console.warn("[projectPersistence] Photo upload failed, keeping base64:", err);
    return photo;
  }
}

async function migratePhotoArray(projectId, photos) {
  if (!photos || photos.length === 0) return photos;
  return Promise.all(photos.map(p => uploadPhotoIfNeeded(projectId, p)));
}

async function migrateProjectPhotos(project) {
  const floors = project.floors
    ? await Promise.all(project.floors.map(async fl => ({
        ...fl,
        rooms: await Promise.all((fl.rooms || []).map(async r => ({
          ...r,
          conditionPhotos: await migratePhotoArray(project.id, r.conditionPhotos),
        }))),
      })))
    : project.floors;

  const exterior = project.exterior
    ? await Promise.all(project.exterior.map(async el => ({
        ...el,
        conditionPhotos: await migratePhotoArray(project.id, el.conditionPhotos),
      })))
    : project.exterior;

  return { ...project, floors, exterior };
}

const sanitizeForFirestore = (d) => JSON.parse(JSON.stringify(d, (k, v) => v === undefined ? null : v));

function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Firestore operation timed out after 8s")), ms)
  );
  return Promise.race([promise, timeout]);
}

function stripLargeBlobs(project) {
  if (storage) return project;
  const p = { ...project };
  if (p.floors) {
    p.floors = p.floors.map(fl => ({
      ...fl,
      rooms: (fl.rooms || []).map(r => ({ ...r, conditionPhotos: [] }))
    }));
  }
  if (p.exterior) {
    p.exterior = p.exterior.map(el => ({ ...el, conditionPhotos: [] }));
  }
  return p;
}

export async function saveProject(project) {
  console.log("--> SAVE_PROJECT CALLED WITH:", project);
  if (!project || !project.id) {
    const errorMsg = "saveProject: invalid project object or missing project.id";
    console.error("[projectPersistence]", errorMsg);
    return { ok: false, synced: false, error: errorMsg };
  }

  upsertLocal(project);

  if (!isFirebaseReady()) {
    console.warn("[projectPersistence] Firebase DB not ready — saved to localStorage only.");
    return { ok: true, synced: false, project };
  }

  const firestoreDoc = sanitizeForFirestore({
    id: String(project.id),
    clientName: project.clientName || project.customer?.name || "Unnamed",
    clientMobile: project.clientMobile || project.customer?.mobile || "",
    location: project.location || project.customer?.location || "",
    projectCategory: project.projectCategory || project.category || "Residential",
    projectType: project.projectType || "Fresh",
    scope: project.scope || "Both",
    quoteMode: project.quoteMode || "with_material",
    grandTotal: Number(project.grandTotal || project.totalAmount || 0),
    totalArea: Number(project.totalArea || 0),
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),

    customer: project.customer || {},
    floors: project.floors || [],
    exterior: project.exterior || [],
    doorWindowItems: project.doorWindowItems || [],
    wpItems: project.wpItems || [],
    textureItems: project.textureItems || [],
    polishItems: project.polishItems || [],

    interiorCharges: project.interiorCharges || {},
    exteriorCharges: project.exteriorCharges || {},
    summary: project.summary || {}
  });

  try {
    console.log("--> WRITING TO FIRESTORE...");
    await withTimeout(
      setDoc(
        doc(db, COLLECTION, String(project.id)),
        firestoreDoc,
        { merge: true }
      ),
      8000
    );

    upsertLocal(project);
    console.log("--> 🚀 SUCCESS FIRESTORE WRITE:", project.id);
    return { ok: true, synced: true, project };

  } catch (error) {
    console.error("--> FIRESTORE WRITE FAILED:", error);
    return { ok: false, synced: false, project, error: error.message };
  }
}

export const updateProject   = saveProject;
export const saveProjectData = saveProject;

export async function loadProject(projectId) {
  if (isFirebaseReady()) {
    try {
      const snap = await withTimeout(getDoc(doc(db, COLLECTION, String(projectId))), 8000);
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...data,
          clientName: data.clientName || data.customer?.name || "Unnamed",
          clientMobile: data.clientMobile || data.customer?.mobile || "",
          location: data.location || data.customer?.location || "",
          grandTotal: data.grandTotal || data.totalAmount || 0,
          totalArea: data.totalArea || 0,
        };
      }
    } catch (e) {
      console.error("FIRESTORE LOAD ERROR:", e);
    }
  }
  return readLocalAll().find(p => String(p.id) === String(projectId)) || null;
}

export const getProjectData = loadProject;

export async function loadAllProjects() {
  const local = readLocalAll();

  if (isFirebaseReady()) {
    try {
      const snap = await withTimeout(getDocs(collection(db, COLLECTION)), 8000);
      const remote = snap.docs
        .filter(d => !d.data().isDeleted)
        .map(d => {
          const data = d.data();
          return {
            ...data,
            clientName: data.clientName || data.customer?.name || "Unnamed",
            clientMobile: data.clientMobile || data.customer?.mobile || "",
            location: data.location || data.customer?.location || "",
            grandTotal: data.grandTotal || data.totalAmount || 0,
            totalArea: data.totalArea || 0,
          };
        });

      const mergedMap = new Map();
      [...remote, ...local].forEach(p => {
        if (!p.id) return;
        const existing = mergedMap.get(p.id);
        if (!existing) {
          mergedMap.set(p.id, p);
        } else {
          mergedMap.set(p.id, { ...existing, ...p });
        }
      });

      const merged = Array.from(mergedMap.values());
      writeLocalAll(merged);
      console.log(`[projectPersistence] Loaded ${merged.length} project(s) from Firestore + local cache.`);
      return merged;
    } catch (e) {
      console.error("FIRESTORE LOAD ALL ERROR:", e);
      console.error("[projectPersistence] error.code:", e?.code);
      console.log(`[projectPersistence] Firestore failed/timed out — returning ${local.length} local project(s).`);
      return local;
    }
  }

  console.log(`[projectPersistence] Firebase unavailable — returning ${local.length} local project(s).`);
  return local;
}

export async function deleteProject(projectId) {
  removeLocal(projectId);
  if (!isFirebaseReady()) return { ok: true, synced: false };
  try {
    await withTimeout(
      setDoc(
        doc(db, COLLECTION, String(projectId)),
        {
          isDeleted: true,
          deletedAt: new Date().toISOString()
        },
        { merge: true }
      ),
      8000
    );
    console.log("[projectPersistence] Soft-deleted project from Firestore:", projectId);
    return { ok: true, synced: true };
  } catch (error) {
    console.error("FIRESTORE DELETE ERROR:", error);
    return { ok: false, synced: false, error: error.message };
  }
}
