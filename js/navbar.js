async function loadNavbar() {
  const container = document.getElementById("navbar");
  const res = await fetch("navbar.html");
  const html = await res.text();
  container.innerHTML = html;
  bindNavbarEvents();
  highlightActiveLink();

  // Initialize mini-cart now that navbar DOM exists
  if (typeof initMiniCart === 'function') {
    try {
      initMiniCart();
      // console.log('mini cart initialized');
    } catch (err) {
      console.error('initMiniCart error:', err);
    }
  }
}

function bindNavbarEvents() {
  const $ = id => document.getElementById(id);
  const mobileMenu = $("mobileMenu");

  $("openMenu")?.addEventListener("click", () => mobileMenu?.classList.add("active"));
  $("closeMenu")?.addEventListener("click", () => mobileMenu?.classList.remove("active"));

  const darkToggle = $("darkModeToggle");
  const desktopToggle = $("desktopDarkToggle");

  // ✅ Dark Mode Theme Setup
  function applySavedTheme() {
    const isDark = localStorage.getItem("theme") === "dark";
    document.body.classList.toggle("dark-mode", isDark);

    // ✅ Set checkbox state based on theme
    if (darkToggle) darkToggle.checked = isDark;
    if (desktopToggle) desktopToggle.checked = isDark;
  }

  applySavedTheme();

  // ✅ Toggle logic for both desktop & mobile
  function toggleTheme(fromToggle) {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    // Sync both toggles visually
    if (darkToggle && fromToggle !== darkToggle) darkToggle.checked = isDark;
    if (desktopToggle && fromToggle !== desktopToggle) desktopToggle.checked = isDark;
  }

  darkToggle?.addEventListener("change", () => toggleTheme(darkToggle));
  desktopToggle?.addEventListener("change", () => toggleTheme(desktopToggle));

  // Mobile search
  $("openSearch")?.addEventListener("click", () => {
    $("mobileSearch")?.classList.add("active");
    $("navbar")?.classList.add("hidden");
    document.body.classList.add("search-active");
  });

  $("closeSearch")?.addEventListener("click", () => {
    $("mobileSearch")?.classList.remove("active");
    $("navbar")?.classList.remove("hidden");
    document.body.classList.remove("search-active");
    const input = $("mobileSearchInput");
    if (input) {
      input.value = "";
      document.dispatchEvent(new CustomEvent("liveSearch", { detail: "" }));
    }
  });

  // Desktop dropdown
  const openDesktopMenu = $("openDesktopMenu");
  const desktopDropdown = $("desktopDropdown");
  if (openDesktopMenu && desktopDropdown) {
    openDesktopMenu.addEventListener("click", e => {
      e.stopPropagation();
      desktopDropdown.style.display = desktopDropdown.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", e => {
      if (!desktopDropdown.contains(e.target) && !openDesktopMenu.contains(e.target)) {
        desktopDropdown.style.display = "none";
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") desktopDropdown.style.display = "none";
    });
  }

  // Search input handling
  ["desktopSearchInput", "mobileSearchInput"].forEach(id => {
    const input = $(id);
    if (input) {
      const handler = e => {
        const query = e.target.value.trim();
        const isIndex =
          window.location.pathname.endsWith("index.html") ||
          window.location.pathname === "/" ||
          window.location.pathname === "/index";
        if (!isIndex) {
          window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        } else {
          document.dispatchEvent(new CustomEvent("liveSearch", { detail: query }));
        }
      };
      input.addEventListener("input", handler);
      input.addEventListener("keyup", handler);
    }
  });

  // Scroll to Products
  ["allProductsLink", "allProductsLinkMobile"].forEach(id => {
    const link = $(id);
    if (link) {
      link.addEventListener("click", e => {
        const isOnHomePage =
          window.location.pathname.endsWith("index.html") ||
          window.location.pathname === "/";
        if (isOnHomePage) {
          e.preventDefault();
          const target = $("productList");
          if (target) target.scrollIntoView({ behavior: "smooth" });
          mobileMenu?.classList.remove("active");
          if (window.history.replaceState) {
            window.history.replaceState(null, null, "index.html");
          }
        }
      });
    }
  });

  // ✅ Typing Animation
  const searchInputs = ["desktopSearchInput", "mobileSearchInput"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const phrases = ["Sneakers", "Formal Shoes", "Wedding Shoes", "Premium Footwear", "Casual Styles"];
  let phraseIndex = 0, charIndex = 0, isDeleting = false;

  function animateTyping() {
    const current = phrases[phraseIndex];
    const text = isDeleting ? current.slice(0, --charIndex) : current.slice(0, ++charIndex);
    searchInputs.forEach(input => {
      if (!input.matches(":focus")) {
        input.setAttribute("placeholder", `Search for ${text}`);
      }
    });
    if (!isDeleting && charIndex === current.length) {
      isDeleting = true;
      setTimeout(animateTyping, 1000);
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(animateTyping, 500);
    } else {
      setTimeout(animateTyping, isDeleting ? 50 : 100);
    }
  }

  animateTyping();
}

function highlightActiveLink() {
  const isIndexPage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname === "/index";

  if (!isIndexPage) {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll(".nav-center a, .mobile-menu a");
    links.forEach(link => {
      const linkPath = new URL(link.href, window.location.origin).pathname;
      link.classList.toggle("active", linkPath === currentPath);
    });
    return;
  }

  const homeLink = document.getElementById("homeLink");
  const homeLinkMobile = document.getElementById("homeLinkMobile");
  const allProductsLink = document.getElementById("allProductsLink");
  const allProductsLinkMobile = document.getElementById("allProductsLinkMobile");
  const productSection = document.getElementById("productList");

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const inView = entry.isIntersecting;
        if (inView) {
          allProductsLink?.classList.add("active");
          allProductsLinkMobile?.classList.add("active");
          homeLink?.classList.remove("active");
          homeLinkMobile?.classList.remove("active");
        } else {
          allProductsLink?.classList.remove("active");
          allProductsLinkMobile?.classList.remove("active");
          homeLink?.classList.add("active");
          homeLinkMobile?.classList.add("active");
        }
      });
    },
    { threshold: 0.4 }
  );

  if (productSection) observer.observe(productSection);
}

document.addEventListener("DOMContentLoaded", loadNavbar);
