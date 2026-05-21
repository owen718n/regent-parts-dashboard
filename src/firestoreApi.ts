import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

function withId(snapshot: any) {
  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getParts() {
  const snapshot = await getDocs(collection(db, "parts"));
  return withId(snapshot);
}

export async function getBomItems() {
  const snapshot = await getDocs(collection(db, "bomItems"));
  return withId(snapshot);
}

export async function getModels() {
  const snapshot = await getDocs(collection(db, "models"));
  return withId(snapshot);
}

export async function getImports() {
  const snapshot = await getDocs(collection(db, "imports"));
  return withId(snapshot);
}

export type PartManualFields = Partial<{
  location: string | null;
  group: string | null;
  time: number | null;
  standard: "Standard" | "Option";
  status: "Not Start" | "Transfer" | "Keep" | null;
  reason:
    | "Container limitation"
    | "Parts availability"
    | "Compliance"
    | "Quality Risk Control"
    | null;
  hidden: boolean;
}>;

export async function updatePartManualFields(
  partId: string,
  data: PartManualFields
) {
  if (!partId) {
    throw new Error("Missing partId");
  }

  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  const ref = doc(db, "parts", partId);

  await updateDoc(ref, {
    ...cleanData,
    manualUpdatedAt: serverTimestamp(),
  });
}