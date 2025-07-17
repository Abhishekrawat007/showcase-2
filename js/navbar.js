
async function loadNavbar() {
  const container = document.getElementById("navbar");
  const res = await fetch("navbar.html");
  const html = await res.text();
  container.innerHTML = html;

  bindNavbarEvents(); // ✅ Call after injecting HTML
  highlightActiveLink();
}

function bindNavbarEvents() {
  const $ = id => document.getElementById(id);

  const mobileMenu = $("mobileMenu");

  $("openMenu")?.addEventListener("click", () => {
    mobileMenu?.classList.add("active");
  });

  $("closeMenu")?.addEventListener("click", () => {
    mobileMenu?.classList.remove("active");
  });

  // ✅ DARK MODE BUTTON WORKING
  const darkToggle = $("darkModeToggle");
  const desktopToggle = $("desktopThemeToggle");
function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  const isDark = saved === "dark";

  document.body.classList.toggle("dark-mode", isDark);

  if (darkToggle) darkToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  if (desktopToggle) desktopToggle.textContent = isDark ? "☀️" : "🌙";
}

// Run on initial load
applySavedTheme();

// Toggle dark mode on click
darkToggle?.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  darkToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";

  // ✅ Close mobile menu if open
  const menu = $("mobileMenu");
  if (menu?.classList.contains("active")) {
    menu.classList.remove("active");
  }
});
desktopToggle?.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  if (darkToggle) darkToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  if (desktopToggle) desktopToggle.textContent = isDark ? "☀️" : "🌙";
});
  // Mobile search open/close
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
// DESKTOP DROPDOWN LOGIC
const openDesktopMenu = document.getElementById("openDesktopMenu");
const desktopDropdown = document.getElementById("desktopDropdown");

if (openDesktopMenu && desktopDropdown) {
  openDesktopMenu.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent bubbling to document
    const isVisible = desktopDropdown.style.display === "block";
    desktopDropdown.style.display = isVisible ? "none" : "block";
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !desktopDropdown.contains(e.target) &&
      !openDesktopMenu.contains(e.target)
    ) {
      desktopDropdown.style.display = "none";
    }
  });

  // Optional: Close dropdown on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      desktopDropdown.style.display = "none";
    }
  });
}
const desktopDarkToggle = document.getElementById("desktopDarkToggle");
if (desktopDarkToggle) {
  desktopDarkToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  desktopDarkToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";

  // Sync mobile toggle
  const mobileDark = document.getElementById("darkModeToggle");
  if (mobileDark) mobileDark.textContent = desktopDarkToggle.textContent;

  // ✅ Close the desktop dropdown after click
  const desktopDropdown = document.getElementById("desktopDropdown");
  if (desktopDropdown) desktopDropdown.style.display = "none";
});
}
  // Search input
  ["desktopSearchInput", "mobileSearchInput"].forEach(id => {
    const input = document.getElementById(id);
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

  // Smooth scroll for All Products
  ["allProductsLink", "allProductsLinkMobile"].forEach(id => {
    const link = document.getElementById(id);
    if (link) {
      link.addEventListener("click", e => {
        const isOnHomePage =
          window.location.pathname.endsWith("index.html") ||
          window.location.pathname === "/";

        if (isOnHomePage) {
          e.preventDefault();
          const target = document.getElementById("productList");
          if (target) target.scrollIntoView({ behavior: "smooth" });

          // Close mobile menu
          mobileMenu?.classList.remove("active");

          if (window.history.replaceState) {
            window.history.replaceState(null, null, "index.html");
          }
        }
      });
    }
  });

  highlightActiveLink();
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