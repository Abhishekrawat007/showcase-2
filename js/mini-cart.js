// js/mini-cart.js

function initMiniCartBadges() {
  // Read cart from safeStorage if available, otherwise from localStorage
  function readCart() {
    let raw = "{}";

    try {
      if (window.safeStorage && typeof window.safeStorage.getItem === "function") {
        raw = window.safeStorage.getItem("cart") || "{}";

        // If wrapper looks empty, fall back to localStorage
        if (!raw || raw === "{}") {
          const lsRaw = localStorage.getItem("cart");
          if (lsRaw && lsRaw !== "{}") raw = lsRaw;
        }
      } else {
        raw = localStorage.getItem("cart") || "{}";
      }
    } catch (e) {
      console.warn("mini-cart: storage read failed, using {}", e);
      raw = "{}";
    }

    let obj;
    try {
      obj = JSON.parse(raw || "{}");
    } catch (e) {
      console.warn("mini-cart: JSON parse failed, using {}", e);
      obj = {};
    }

    if (!obj || typeof obj !== "object") obj = {};

    // 🔒 Clean up any null / broken entries so we never do null.qty
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (!val || typeof val.qty !== "number") {
        delete obj[key];
      }
    });

    return obj;
  }

  function updateBadges() {
    const cart = readCart();

    const items = Object.values(cart); // all entries are now valid objects with number qty
    const count = items.reduce((sum, i) => {
      return sum + (typeof i.qty === "number" ? i.qty : 0);
    }, 0);

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

  // React if some other tab/page changes "cart"
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
