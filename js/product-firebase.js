// js/product-firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGt7uPfeLVinT31xQkbs2y-LR7K4ZfZ7k",
  authDomain: "sublimestore-a0252.firebaseapp.com",
  projectId: "sublimestore-a0252",
  storageBucket: "sublimestore-a0252.appspot.com",
  messagingSenderId: "460519742193",
  appId: "1:460519742193:web:92b91dc5ee963cc371e750"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productRef = collection(db, "products");

// Define global products variable for other scripts
window.products = [];

async function fetchAndSetProducts() {
  const snapshot = await getDocs(productRef);
  window.products = snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id
  }));

  // Dispatch a custom event so other scripts know it's ready
  window.dispatchEvent(new Event("productsReady"));
}

fetchAndSetProducts();