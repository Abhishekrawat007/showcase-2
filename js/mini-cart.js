// js/mini-cart.js
function initMiniCartBadges() {
  function readCart() {
    try { return JSON.parse(localStorage.getItem("cart")) || {}; } catch { return {}; }
  }

  function updateBadges() {
    const cart = readCart();
    const count = Object.values(cart).reduce((sum, i) => sum + (i.qty || 0), 0);
    const badges = [
      document.getElementById("cartCountBadge"),
      document.getElementById("cartCountBadgeMobile")
    ];
    badges.forEach(b => {
      if (!b) return;
      if (count > 0) {
        b.textContent = count > 99 ? "99+" : count;
        b.style.opacity = 1;
        b.style.transform = "scale(1.1)";
        setTimeout(() => (b.style.transform = "scale(1)"), 150);
      } else {
        b.textContent = "";
        b.style.opacity = 0;
      }
    });
  }

  // Initial update when navbar is loaded
  updateBadges();

  // Listen for updates from anywhere in the app
  document.addEventListener("cart:maybeUpdated", updateBadges);
  document.addEventListener("cart:cleared", updateBadges);
  window.addEventListener("storage", (e) => {
    if (e.key === "cart") updateBadges();
  });
}

// ✅ Run it automatically AFTER navbar is injected
document.addEventListener("DOMContentLoaded", () => {
  const navbarContainer = document.getElementById("navbar");
  if (!navbarContainer) return;

  const observer = new MutationObserver(() => {
    const hasBadge = navbarContainer.querySelector("#cartCountBadge, #cartCountBadgeMobile");
    if (hasBadge) {
      initMiniCartBadges();
      observer.disconnect(); // stop watching
    }
  });

  observer.observe(navbarContainer, { childList: true, subtree: true });
});
