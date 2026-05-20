import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCY6hgvpyOGJB5ZgZPy6vBXG1TANls5KlM",
  authDomain: "regent-parts-dashboard.firebaseapp.com",
  databaseURL: "https://regent-parts-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "regent-parts-dashboard",
  storageBucket: "regent-parts-dashboard.firebasestorage.app",
  messagingSenderId: "423208259924",
  appId: "1:423208259924:web:cbfbec52d756ac7d6f78c1",
  measurementId: "G-TB8RWRNWGZ"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);