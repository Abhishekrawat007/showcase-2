// --- Cart Logic ---
let cart = JSON.parse(localStorage.getItem("cart")) || {};

// Resync if user returned via back/forward or another page marked the cart dirty
function resyncIfNeeded() {
  let need = false;
  try {
    if (sessionStorage.getItem('cartDirty') === '1') {
      need = true;
      sessionStorage.removeItem('cartDirty');
    }
  } catch (_) {}

  if (need) {
    refreshCartFromStorage();
    syncProductCardButtons();
  }
}

// Handle BFCache restores and normal back/forward
window.addEventListener('pageshow', (e) => {
  const navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  const isBFCache = e.persisted || (navEntry && navEntry.type === 'back_forward');

  if (isBFCache) {
    refreshCartFromStorage();
    syncProductCardButtons();
  } else {
    resyncIfNeeded();
  }
});

function updateCartStorage() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateFloatingCartBar();
  // lightweight local broadcast
  document.dispatchEvent(new CustomEvent("cart:maybeUpdated"));
}

function updateFloatingCartBar() {
  const bar = document.getElementById("floatingCartBar");
  const countEl = document.getElementById("cartItemCount");
  const totalEl = document.getElementById("cartTotalAmount");
  if (!bar || !countEl || !totalEl) return;

  const itemCount = Object.values(cart).reduce((sum, item) => {
    if (!item || typeof item.qty !== "number") return sum;
    return sum + item.qty;
  }, 0);

  const totalAmount = Object.values(cart).reduce((sum, item) => {
    if (!item || typeof item.qty !== "number") return sum;
    const product = products.find(p => String(p.id) === String(item.id));
    return sum + (product ? Number(product.newPrice) * item.qty : 0);
  }, 0);

  bar.style.display = itemCount > 0 ? "flex" : "none";
  countEl.textContent = itemCount;
  totalEl.textContent = `₹${totalAmount}`;
}

function refreshCartFromStorage() {
  try {
    cart = JSON.parse(localStorage.getItem("cart") || "{}");
  } catch (_) {
    cart = {};
  }
  updateFloatingCartBar();
}

// Keep product-card buttons and qty controls in sync with current `cart`
function syncProductCardButtons() {
  // Re-read cart in case caller forgot
  try { cart = JSON.parse(localStorage.getItem("cart") || "{}"); } catch(_) { cart = {}; }

  // For every product card on the page, toggle its add/qty UI
  document.querySelectorAll('.quantity-controls[data-id]').forEach(qtyDiv => {
    const id = qtyDiv.dataset.id;
    const addBtn = document.querySelector(`.add-to-cart-btn[data-id="${id}"]`);
    const qtySpan = document.getElementById(`qty-${id}`);
    const line = cart[id];

    if (line && Number(line.qty) > 0) {
      if (addBtn) addBtn.style.display = "none";
      qtyDiv.style.display = "flex";
      if (qtySpan) qtySpan.textContent = line.qty;
    } else {
      if (addBtn) addBtn.style.display = "inline-block";
      qtyDiv.style.display = "none";
      if (qtySpan) qtySpan.textContent = "0";
    }
  });

  updateFloatingCartBar();
}

// Listen to our navigation handshakes
document.addEventListener("cart:maybeUpdated", refreshCartFromStorage);
document.addEventListener("cart:cleared", refreshCartFromStorage);

// Also react if the cart changes from another page/tab or PWA navigation
window.addEventListener("storage", (e) => {
  if (e.key === "cart") {
    refreshCartFromStorage();
    syncProductCardButtons();
  }
});

document.addEventListener("click", e => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains("add-to-cart-btn")) {
    cart[id] = { id, qty: 1 };
    updateCartStorage();

    e.target.style.display = "none";
    const qtyDiv = document.querySelector(`.quantity-controls[data-id="${id}"]`);
    if (qtyDiv) qtyDiv.style.display = "flex";

    const qtyElement = document.getElementById(`qty-${id}`);
    if (qtyElement) qtyElement.textContent = cart[id].qty;
  }

  if (e.target.classList.contains("plus")) {
    if (!cart[id]) cart[id] = { id, qty: 1 };
    cart[id].qty++;
    updateCartStorage();
    const el = document.getElementById(`qty-${id}`);
    if (el) el.textContent = cart[id].qty;
  }

  if (e.target.classList.contains("minus")) {
    if (cart[id].qty > 1) {
      cart[id].qty--;
      const el = document.getElementById(`qty-${id}`);
      if (el) el.textContent = cart[id].qty;
    } else {
      delete cart[id];
      const addBtn = document.querySelector(`.add-to-cart-btn[data-id="${id}"]`);
      const qtyDiv = document.querySelector(`.quantity-controls[data-id="${id}"]`);
      if (addBtn) addBtn.style.display = "inline-block";
      if (qtyDiv) qtyDiv.style.display = "none";
    }
    updateCartStorage();
  }
});

// ✅ On page load: sync bar, buttons, and consume cartDirty
window.addEventListener("DOMContentLoaded", () => {
  refreshCartFromStorage();    // re-read from localStorage
  syncProductCardButtons();    // update + / – / Add buttons
  resyncIfNeeded();            // handle navigation return (back)
});
