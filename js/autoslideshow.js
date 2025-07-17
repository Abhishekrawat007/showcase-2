window.addEventListener("DOMContentLoaded", () => {
  const isMobile = window.innerWidth <= 768;
  const currentWrapper = document.querySelector(
    isMobile ? ".mobile-slideshow" : ".desktop-slideshow"
  );

  if (!currentWrapper) return;

  let slides = currentWrapper.querySelectorAll(".auto-slide");
  if (!slides.length) return;

  let slideIndex = 0;
  slides[0].classList.add("active");

  const dotsContainer = document.querySelector(".dots-container");
  if (dotsContainer) dotsContainer.innerHTML = "";

  function createDots() {
    if (!dotsContainer) return;
    slides.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot";
      if (i === 0) dot.classList.add("active");
      dot.addEventListener("click", () => {
        showSlide(i);
      });
      dotsContainer.appendChild(dot);
    });
  }

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.remove("active");
      if (dotsContainer?.children[i]) {
        dotsContainer.children[i].classList.remove("active");
      }
    });
    slides[index].classList.add("active");
    if (dotsContainer?.children[index]) {
      dotsContainer.children[index].classList.add("active");
    }
    slideIndex = index;
  }

  function nextSlide() {
    slideIndex = (slideIndex + 1) % slides.length;
    showSlide(slideIndex);
  }

  function autoSlideShow() {
    setInterval(() => {
      nextSlide();
    }, 5000); // 5 seconds
  }

  createDots();
  autoSlideShow();
});