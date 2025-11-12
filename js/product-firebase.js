// js/product-firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBfvlFpfG21SpMpyjmjM-EP_Dt54kYfAI",
  authDomain: "showcase-2-24f0a.firebaseapp.com",
  projectId: "showcase-2-24f0a",
  storageBucket: "showcase-2-24f0a.firebasestorage.app",
  messagingSenderId: "894978656187",
  appId: "1:894978656187:web:2c17a99781591a91c6a69e"
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