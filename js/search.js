// search.js
document.addEventListener("DOMContentLoaded", () => {
  const desktopInput = document.getElementById("desktopSearchInput");
  const mobileInput = document.getElementById("mobileSearchInput");

  [desktopInput, mobileInput].forEach(input => {
    input?.addEventListener("input", e => {
      const term = e.target.value.trim();
      if (!term) return;

      // Store in sessionStorage
      sessionStorage.setItem("liveSearch", term);

      // Redirect to index.html if not there
      if (!location.pathname.includes("index.html") && location.pathname !== "/") {
        window.location.href = "index.html";
      } else {
        // Already on index.html → trigger event
        document.dispatchEvent(new CustomEvent("liveSearch", { detail: term }));
      }
    });
  });
});
