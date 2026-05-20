import { collection, getDocs } from "firebase/firestore";
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