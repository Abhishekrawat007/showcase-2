const productList = document.getElementById("productList");
const roundedRow1 = document.getElementById("roundedRow1");
const roundedRow2 = document.getElementById("roundedRow2");
let filteredProducts;
function generateProductCard(product) {
  let buttonsHTML = '';

  if (product.inStock) {
    buttonsHTML = `
      <div class="button-group">
        <button class="btn btn-primary add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
        <div class="quantity-controls" style="display:none;" data-id="${product.id}">
          <button class="btn qty-btn minus" data-id="${product.id}">−</button>
          <span class="qty-count" id="qty-${product.id}">1</span>
          <button class="btn qty-btn plus" data-id="${product.id}">+</button>
        </div>
        <button class="btn btn-buy buy-now-btn" onclick="buyNowFunction()" data-id="${product.id}">Buy Now</button>
      </div>`;
  } else {
    buttonsHTML = `
      <div class="button-group">
        <a href="tel:+918868839446" class="btn btn-call call-btn">Call Now</a>
        <a href="https://wa.me/918868839446" class="btn btn-whatsapp whatsapp-btn">WhatsApp</a>
      </div>`;
  }

  const cardContent = `
    <div class="image-container">
      <img src="${product.images[0]}" class="product-img" alt="${product.name}" loading="lazy" />
      ${!product.inStock ? '<span class="stock-label">Out of Stock</span>' : ''}
      <span class="wishlist ${isInWishlist(product.id) ? 'active' : ''}" data-id="${product.id}">&#10084;</span>
    </div>
    <div class="card-body">
      ${product.tags?.includes('bestseller') ? '<span class="tag">BESTSELLER</span>' : ''}
      <h3 class="product-title">${product.name}</h3>
      <div class="price-block">
        <span class="new-price">₹${product.newPrice}</span>
        <span class="old-price">₹${product.oldPrice}</span>
        <span class="discount">(${product.discount} off)</span>
      </div>
      ${product.offerPrice ? `<div class="offer-price">Get it for ₹${product.offerPrice}</div>` : ''}
      ${product.colors?.length ? `
        <div class="color-dots">
          ${product.colors.map(color => `<span class="dot" style="background:${color}"></span>`).join('')}
        </div>` : ''}
      ${buttonsHTML}
    </div>
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "product-card";
  if (!product.inStock) wrapper.classList.add("out-of-stock");
  wrapper.innerHTML = cardContent;

  wrapper.querySelector('.product-img')?.addEventListener('click', () => {
    window.location.href = `product-detail.html?id=${product.id}`;
  });
  wrapper.querySelector('.product-title')?.addEventListener('click', () => {
    window.location.href = `product-detail.html?id=${product.id}`;
  });

  if (productList) productList.appendChild(wrapper);

  wrapper.querySelector('.wishlist')?.addEventListener('click', function (e) {
    e.stopPropagation();
   const productId = this.dataset.id;
toggleWishlist(productId);
this.classList.toggle('active');
  });
}
function getWishlist() {
  return JSON.parse(localStorage.getItem("wishlist") || "[]");
}

function saveWishlist(wishlist) {
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
}

function isInWishlist(productId) {
  return getWishlist().includes(productId);
}

function toggleWishlist(productId) {
  let wishlist = getWishlist();
  if (wishlist.includes(productId)) {
    wishlist = wishlist.filter(id => id !== productId);
    showToast("Removed from wishlist 💔");
  } else {
    wishlist.push(productId);
    showToast("Added to wishlist 💖");
  }
  saveWishlist(wishlist);
}
function generateTrendingCard(product)  {
  const div = document.createElement("div");
  div.className = "style-card trending";
  div.innerHTML = 
    `<div class="rect-img-wrapper" onclick="window.location.href='product-detail.html?id=${product.id}'">
      <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
      <span class="flame-icon">🔥</span>
    </div>
    <p>${product.name2 || product.name}</p>`
  ;
  return div;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getCachedShuffle(key, hours) {
  const cached = localStorage.getItem(key);
  if (cached) {
    const { timestamp, data } = JSON.parse(cached);
    const age = (Date.now() - timestamp) / 1000 / 60 / 60;
    if (age < hours) return data;
  }
  return null;
}

function cacheShuffle(key, data) {
  localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
}

document.addEventListener("DOMContentLoaded", () => {
  const stylesRow1 = document.getElementById("stylesRow1");
  const stylesRow2 = document.getElementById("stylesRow2");
  if (!stylesRow1 || !stylesRow2) return;

  stylesRow1.innerHTML = "";
  stylesRow2.innerHTML = "";

  const shuffled = shuffleArray(products).slice(0, 14); // Always reshuffles

  const row1 = shuffled.slice(0, 7);
  const row2 = shuffled.slice(7, 14);

 row1.forEach(product => stylesRow1.appendChild(generateTrendingCard(product)));
row2.forEach(product => stylesRow2.appendChild(generateTrendingCard(product)));

});
  /*const cachedProductOrder = getCachedShuffle("productShuffle", 24);
const productOrder = cachedProductOrder || shuffleArray(products);
if (!cachedProductOrder) cacheShuffle("productShuffle", productOrder);
renderProducts(productOrder);  // ✅ THIS LINE renders all product cards
 */
// 👉 Always use fresh shuffled data
const productOrder = shuffleArray(products);
renderProducts(productOrder);
filteredProducts = [...productOrder];
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("buy-now-btn")) {
    const productId = e.target.dataset.id;
    sessionStorage.setItem("buyNowProduct", productId); // store selected product
    window.location.href = "buynow.html"; // navigate
  }
});
const $ = id => document.getElementById(id);
  const desktopInput = $("desktopSearchInput");
  const mobileInput = $("mobileSearchInput");

  const elementsToToggle = [
    $("slideshow-container"),
    $("welcomeContainer"),
    $("roundedCards"),
    $("filterContainer")
  ];

  const toggleUI = hide => {
    const display = hide ? "none" : "block";
    elementsToToggle.forEach(el => el && (el.style.display = display));
  };

  function searchHandler(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter(p => p.name.toLowerCase().includes(q))
    : [...products];

  toggleUI(!!q);
  // ✅ Also hide banners and stylish sections
const bannerSlider = document.querySelector(".banner-slider");
const stylesSection = document.getElementById("stylesSection");
const stylishCollage = document.getElementById("stylishCollage");
const trustBadges = document.querySelector(".trust-badges");
if (trustBadges) trustBadges.style.display = q ? "none" : "flex";

if (bannerSlider) bannerSlider.style.display = q ? "none" : "block";
if (stylesSection) stylesSection.style.display = q ? "none" : "block";
if (stylishCollage) stylishCollage.style.display = q ? "none" : "grid"; // or "flex" if needed

  // ✅ Hide or show stylish cards depending on search
  const stylesRow1 = document.getElementById("stylesRow1");
  const stylesRow2 = document.getElementById("stylesRow2");

  if (stylesRow1 && stylesRow2) {
    const shouldHideStylish = q.length > 0;
    stylesRow1.style.display = shouldHideStylish ? "none" : "flex";
    stylesRow2.style.display = shouldHideStylish ? "none" : "flex";
  }

  if (productList) renderProducts(filtered);
}
  const sessionTerm = sessionStorage.getItem("liveSearch");
  if (sessionTerm) {
    if (desktopInput) desktopInput.value = sessionTerm;
    if (mobileInput) mobileInput.value = sessionTerm;
    searchHandler(sessionTerm);
    sessionStorage.removeItem("liveSearch");
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlSearch = urlParams.get("search");
  if (urlSearch) {
    if (desktopInput) desktopInput.value = urlSearch;
    if (mobileInput) mobileInput.value = urlSearch;
    searchHandler(urlSearch);
    history.replaceState({}, "", window.location.pathname);
  }

  document.addEventListener("liveSearch", e => {
    const term = e.detail;
    if (desktopInput) desktopInput.value = term;
    if (mobileInput) mobileInput.value = term;
    searchHandler(term);
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim().toLowerCase();
      if (label === "all") {
        filteredProducts = [...products];
      } else if (label === "on sale") {
        filteredProducts = products.filter(p => p.oldPrice > p.newPrice);
      } else if (label === "in stock") {
        filteredProducts = products.filter(p => p.inStock);
      }
      renderFilteredProducts();
    });
  });

  // Optional: also adjust on window resize
  window.addEventListener('resize', adjustDropdownHeight);

// load stylishPages (fall back to small default if missing)
// 🖼️ Generate Stylish Collage Cards (for stylish-collage section)
function generateStylishCard(page) {
  const div = document.createElement("div");
  div.className = "stylish-card";
  const imgSrc =
    page.previewImage ||
    (page.productIds?.length
      ? (products.find(p => String(p.id) === String(page.productIds[0]))?.images?.[0])
      : "images/default.jpg");

  div.innerHTML = `
    <img src="${imgSrc}" alt="${page.title}" loading="lazy">
    <div class="overlay">
      <h3>${page.title}</h3>
      <p>${page.desc || page.shortDesc || ""}</p>
    </div>
  `;
  
  // Clicking navigates to its stylish page
  const slug = page.slug || page.title.toLowerCase().replace(/\s+/g, "-");
  div.addEventListener("click", () => {
    window.location.href = "/stylish/" + slug + ".html";
  });
  
  return div;
}

// 🧠 Load & Render Stylish Collage
// ---- Robust renderStylishCollage (replace existing) ----
async function renderStylishCollage() {
  const collage = document.getElementById("stylishCollage");
  if (!collage) {
    console.warn('stylishCollage container not found.');
    return;
  }

  // 1) Try window.stylishPages
  let pages = window.stylishPages;
  if (!pages) {
    // 2) Try localStorage preview saved by editor
    try {
      const raw = localStorage.getItem('stylishPages');
      if (raw) {
        pages = JSON.parse(raw);
        console.info('Loaded stylishPages from localStorage (preview).');
      }
    } catch (e) {
      console.warn('Failed to parse localStorage stylishPages:', e);
    }
  }

  // 3) Try fetching the file directly (helps during local testing)
  if (!pages) {
    try {
      const res = await fetch('/js/stylishPages.js', { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        // Attempt to locate an assignment to stylishPages inside file
        // We'll create a sandboxed function so "const stylishPages = ..." still works.
        try {
          const wrapper = `(function(){ ${text}; return (typeof window !== 'undefined' && window.stylishPages) ? window.stylishPages : (typeof stylishPages !== 'undefined' ? stylishPages : null); })()`;
          pages = (0, eval)(wrapper); // eslint-disable-line no-eval
          if (pages) {
            window.stylishPages = pages;
            console.info('Loaded stylishPages from /js/stylishPages.js via fetch+eval.');
          }
        } catch (e) {
          console.warn('eval failed for stylishPages.js:', e);
        }
      } else {
        console.info('/js/stylishPages.js not found (status ' + res.status + ').');
      }
    } catch (err) {
      console.warn('Fetch of /js/stylishPages.js failed:', err);
    }
  }

  // 4) Give up gracefully if still missing
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    console.warn('stylishPages data not found — collage will remain empty.');
    collage.innerHTML = ''; // clear it
    return;
  }

  // 5) Render up to 6 cards
  collage.innerHTML = '';
  pages.slice(0, 6).forEach(p => {
    try {
      collage.appendChild(generateStylishCard(p));
    } catch (err) {
      console.error('Error rendering stylish card', p, err);
    }
  });
}
// Run once DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderStylishCollage);
} else {
  renderStylishCollage();
}



// Only run on page load, not during search
document.addEventListener("DOMContentLoaded", () => {
  renderStylishCollage(); // loads from stylishPages.js dynamically
});

function updateCartIconBadge() {
  const cartBadge = document.getElementById("cartCountBadge");
  if (!cartBadge) return;

  const itemCount = Object.values(cart || {}).reduce((sum, item) => {
    return sum + (item?.qty || 0);
  }, 0);

  if (itemCount > 0) {
    cartBadge.textContent = itemCount;
    cartBadge.style.display = "inline-block";
  } else {
    cartBadge.style.display = "none";
  }
}

function showToast(message) {
  let toast = document.createElement("div");
  toast.className = "cart-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100); // let it render first

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3000);
}
// sliding banner starts here
document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".banner-track");
  const slides = document.querySelectorAll(".banner-slide");
  const prev = document.querySelector(".prev-btn");
  const next = document.querySelector(".next-btn");

  // Defensive check in case slides are not found
  if (!track || slides.length === 0) {
    console.warn("No slides found for the banner!");
    return;
  }

  let index = 0;

  function updateSlider() {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  next?.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    updateSlider();
  });

  prev?.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    updateSlider();
  });

  setInterval(() => {
    index = (index + 1) % slides.length;
    updateSlider();
  }, 4000);
  updateCartIconBadge();
});

  // filter button starts here
  const allFilterBtns = document.querySelectorAll('.filter-btn');
  allFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      allFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  $("open-price-filter")?.addEventListener("click", () =>
    $("price-filter-panel")?.classList.add("open")
  );
  $("close-price-filter")?.addEventListener("click", () =>
    $("price-filter-panel")?.classList.remove("open")
  );

  $("apply-price-filter")?.addEventListener("click", () => {
    const inputs = document.querySelectorAll('#price-filter-panel input');
    const min = parseInt(inputs[0].value) || 0;
    const max = parseInt(inputs[1].value) || Infinity;

    const priceFiltered = filteredProducts.filter(p => p.newPrice >= min && p.newPrice <= max);
    renderProducts(priceFiltered);
    updatePriceTag(min, max);
    $("price-filter-panel").classList.remove("open");
  });

  function updatePriceTag(min, max) {
    const container = $("active-filters");
    if (!container) return;
    container.innerHTML = '';

    if (!isNaN(min) && !isNaN(max)) {
      const tag = document.createElement('div');
      tag.className = 'filter-tag';
      tag.innerHTML = `Price: ₹${min} - ₹${max} <span>&times;</span>`;
      tag.querySelector('span').addEventListener('click', () => {
        document.querySelector('#price-filter-panel input:nth-child(1)').value = '';
        document.querySelector('#price-filter-panel input:nth-child(2)').value = '';
        filteredProducts = [...products];
        renderProducts(filteredProducts);
        container.innerHTML = '';
        allFilterBtns.forEach(b => b.classList.remove('active'));
      });
      container.appendChild(tag);
    }
  }

  function renderProducts(list) {
  if (!productList) return;

  productList.innerHTML = '';

  const noResults = document.getElementById("noResultsMessage");
  if (list.length === 0) {
    if (noResults) noResults.style.display = "block";
  } else {
    if (noResults) noResults.style.display = "none";
    list.forEach(generateProductCard);
  }
}

  function renderFilteredProducts() {
    renderProducts(filteredProducts);
  }
 document.querySelectorAll(".category-item").forEach(item => {
  item.addEventListener("click", () => {
    const selectedCategory = item.dataset.category.toLowerCase();

    // Highlight the selected item
    document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
    item.classList.add("active");

    // Close the dropdown
    document.getElementById("categoryMenu").classList.add("hidden");

    // Update the dropdown button text
    const toggleBtn = document.getElementById("categoryToggle");
    if (selectedCategory === "all") {
      toggleBtn.innerHTML = `Categories <svg class="dropdown-icon" width="18" height="18" viewBox="0 0 24 24" fill="maroon" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 10l5 5 5-5H7z"/></svg>`;
      filteredProducts = [...products];
    } else {
      toggleBtn.innerHTML = `${item.innerHTML}`;
      // Filter logic
      filteredProducts = products.filter(p => {
        const catList = [];

        if (typeof p.category === "string") catList.push(p.category.toLowerCase());
        if (Array.isArray(p.categories)) {
          p.categories.forEach(c => catList.push(c.toLowerCase()));
        }

        return catList.includes(selectedCategory);
      });
    }

    renderFilteredProducts();
  });
});



function toggleBadge() {
  const badge = document.getElementById("topBadge");
  badge.style.display = "none";
}

window.onscroll = function () {
  const btn = document.getElementById("scrollToTopBtn");
  if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
};

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}
// ✅ Open/close category menu
const categoryToggle = document.getElementById("categoryToggle");
const categoryMenu = document.getElementById("categoryMenu");

if (categoryToggle && categoryMenu) {
  categoryToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent global click listener from firing
    categoryMenu.classList.toggle("hidden");
    adjustDropdownHeight();
  });

  // Close only if clicking outside BOTH menu and toggle
  document.addEventListener("click", (e) => {
    if (!categoryMenu.contains(e.target) && !categoryToggle.contains(e.target)) {
      categoryMenu.classList.add("hidden");
    }
  });
}

  function adjustDropdownHeight() {
    const button = document.getElementById('categoryToggle');
    const dropdown = document.getElementById('categoryMenu');

    if (!button || !dropdown) return;

    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 20; // leave 20px margin
    const maxDropdownHeight = 350; // your preferred max height

    dropdown.style.maxHeight = Math.min(spaceBelow, maxDropdownHeight) + 'px';
    dropdown.style.overflowY = 'auto';
  }

  // Run when opening dropdown
  document.getElementById('categoryToggle').addEventListener('click', () => {
    adjustDropdownHeight();
  });
function showToast(message) {
  let toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 10);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}