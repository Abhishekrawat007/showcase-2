// ✅ Always apply saved theme early
(function applyDarkModeEarly() {
  const theme = localStorage.getItem("theme");
  if (theme === "dark") {
    document.documentElement.classList.add("dark-mode");
  }
})();

const productList = document.getElementById("productList");
const roundedRow1 = document.getElementById("roundedRow1");
const roundedRow2 = document.getElementById("roundedRow2");
let filteredProducts;
function generateProductCard(product) {
  let buttonsHTML = '';

  if (product.inStock) {
    buttonsHTML = 
      `<div class="button-group">
        <button class="add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
        <div class="quantity-controls" style="display:none;" data-id="${product.id}">
          <button class="qty-btn minus" data-id="${product.id}">-</button>
          <span class="qty-count" id="qty-${product.id}">1</span>
          <button class="qty-btn plus" data-id="${product.id}">+</button>
        </div>
       <button class="buy-now-btn" onclick="buyNowFunction()" data-id="${product.id}">Buy Now</button>
      </div>`;
  } else {
    buttonsHTML = 
      `<div class="button-group">
        <a href="tel:+918868839446" class="call-btn">Call Now</a> 
        <a href="https://wa.me/918868839446" class="whatsapp-btn">WhatsApp</a>
      </div>`;
  }

  const cardContent = 
    `<div class="image-container">
      <img src="${product.images[0]}" class="product-img" alt="${product.name}"  loading="lazy"/>
      ${!product.inStock ? '<span class="stock-label">Out of Stock</span>' : ''}
      <span class="media-info">${product.mediaCount}</span>
    </div>
    <h3 class="product-title">${product.name}</h3>
    <div class="details">
      <p class="price">
        <span class="old">₹${product.oldPrice}</span>
        <span class="new">₹${product.newPrice}</span>
        <span class="discount">(${product.discount} off)</span>
      </p>
      ${buttonsHTML}
    </div>`;

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
}

function generateRoundedCard(product) {
  const div = document.createElement("div");
  div.className = "rounded-card";
  div.innerHTML = 
    `<div class="rounded-img" onclick="window.location.href='product-detail.html?id=${product.id}'">
      <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
    </div>
    <p class="rounded-title">${product.name2 || product.name}</p>`
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
  const roundedContainer1 = roundedRow1;
  const roundedContainer2 = roundedRow2;

 // Get shuffled rounded cards from cache or shuffle now
function renderRoundedCards() {
  const roundedRow1 = document.getElementById("roundedRow1");
  const roundedRow2 = document.getElementById("roundedRow2");
  if (!roundedRow1 || !roundedRow2) return;

  roundedRow1.innerHTML = "";
  roundedRow2.innerHTML = "";

  let rounded = shuffleArray(products).slice(0, 14);

  const row1 = rounded.slice(0, 7);
  const row2 = rounded.slice(7, 14);
  row1.map(generateRoundedCard).forEach(card => roundedRow1.appendChild(card));
  row2.map(generateRoundedCard).forEach(card => roundedRow2.appendChild(card));
}
renderRoundedCards();

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
document.getElementById("categoryToggle")?.addEventListener("click", () => {
  document.getElementById("categoryMenu")?.classList.toggle("hidden");
});

// Optional: Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const toggle = document.getElementById("categoryToggle");
  const menu = document.getElementById("categoryMenu");
  if (!toggle.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

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

  // Optional: also adjust on window resize
  window.addEventListener('resize', adjustDropdownHeight);


