

// --- Cart Logic ---
let cart = JSON.parse(localStorage.getItem("cart")) || {};

function updateCartStorage() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateFloatingCartBar();
}

function updateFloatingCartBar() {
  const bar = document.getElementById("floatingCartBar");
  const countEl = document.getElementById("cartItemCount");
  const totalEl = document.getElementById("cartTotalAmount");
  if (!bar || !countEl || !totalEl) return;

  const itemCount = Object.values(cart).reduce((sum, item) => {
  if (!item || typeof item.qty !== "number") return sum;
  return sum + item.qty;
}, 0);;
  const totalAmount = Object.values(cart).reduce((sum, item) => {
  if (!item || typeof item.qty !== "number") return sum;
  const product = products.find(p => p.id == item.id);
  return sum + (product ? product.newPrice * item.qty : 0);
}, 0);

  bar.style.display = itemCount > 0 ? "flex" : "none";
  countEl.textContent = itemCount;
  totalEl.textContent = totalAmount;
}

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
if (qtyElement) {
  qtyElement.textContent = cart[id].qty;
};
  }

  if (e.target.classList.contains("plus")) {
    if (!cart[id]) cart[id] = { id, qty: 1 };
    cart[id].qty++;
    updateCartStorage();
    document.getElementById(`qty-${id}`).textContent = cart[id].qty;
  }

  if (e.target.classList.contains("minus")) {
    if (cart[id].qty > 1) {
      cart[id].qty--;
      document.getElementById(`qty-${id}`).textContent = cart[id].qty;
    } else {
      delete cart[id];
      document.querySelector(`.add-to-cart-btn[data-id="${id}"]`).style.display = "inline-block";
      document.querySelector(`.quantity-controls[data-id="${id}"]`).style.display = "none";
    }
    updateCartStorage();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  updateFloatingCartBar();

  // Show correct quantity if page reloads
  for (const id in cart) {
    const qty = cart[id].qty;
    const addBtn = document.querySelector( `.add-to-cart-btn[data-id="${id}"]`);
    const qtyDiv = document.querySelector(`.quantity-controls[data-id="${id}"]`);
    const qtySpan = document.getElementById(`qty-${id}`);

    if (addBtn) addBtn.style.display = "none";
    if (qtyDiv) qtyDiv.style.display = "flex";
    if (qtySpan) qtySpan.textContent = qty;
  }
});