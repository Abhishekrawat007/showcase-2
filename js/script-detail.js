// ----------------------------
// script-detail.js  (SAFE-STORAGE VERSION)
// ----------------------------
// ▸ Uses window.safeStorage for cart + wishlist
// ▸ Floating-cart bar synced to cart
// ▸ Main product cart + media + thumbnails
// ▸ Related-products keep original layout:
//    in-stock ➜ Add + Buy Now (+qty controls)
//    out-of-stock ➜ Call Now + WhatsApp (no qty controls)
// ----------------------------

// Simple toast (used for wishlist messages)
function showToast(msg, duration = 1500) {
  let toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#333";
  toast.style.color = "#fff";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "30px";
  toast.style.fontSize = "14px";
  toast.style.zIndex = 9999;
  toast.style.opacity = 0;
  toast.style.transition = "opacity 0.3s ease";
  document.body.appendChild(toast);
  setTimeout(() => (toast.style.opacity = 1), 10);
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => document.body.removeChild(toast), 300);
  }, duration);
}

/*************  CART HELPERS (safeStorage)  *************/
function getCart() {
  try {
    const stored = window.safeStorage.getItem("cart");
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn("⚠️ Cart parse failed:", e);
    return {};
  }
}

function saveCart(c) {
  try {
    window.safeStorage.setItem("cart", JSON.stringify(c));
  } catch (e) {
    console.warn("⚠️ Cart write failed:", e);
  }
  // Let other scripts/pages know
  document.dispatchEvent(new CustomEvent("cart:maybeUpdated"));
}

function setSS(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn("⚠️ sessionStorage blocked:", key);
  }
}

function updateFloatingCartBar() {
  const bar = document.getElementById("floatingCartBar");
  const count = document.getElementById("cartItemCount");
  const total = document.getElementById("cartTotalAmount");
  if (!bar || !count || !total) return;

  const cart = getCart();
  let itemCount = 0;
  let amount = 0;

  Object.values(cart).forEach((line) => {
    if (!line) return;
    const qty = Number(line.qty) || 0;
    if (!qty) return;

    const prod = products.find((p) => String(p.id) === String(line.id));
    if (prod) {
      const price = Number(prod.newPrice) || 0;
      itemCount += qty;
      amount += qty * price;
    }
  });

  count.textContent = itemCount;
  total.textContent = `₹${amount}`;
  bar.style.display = itemCount ? "flex" : "none";
}

function bindCartUI(id, prod, addBtn, qtyWrap, qtySpan) {
  const key = String(id); // normalize

  let cart = getCart();
  if (cart[key]) {
    addBtn.style.display = "none";
    qtyWrap.style.display = "flex";
    qtySpan.textContent = cart[key].qty;
  }

  // Add
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cart = getCart();
    cart[key] = { id: key, qty: 1 };
    saveCart(cart);
    addBtn.style.display = "none";
    qtyWrap.style.display = "flex";
    qtySpan.textContent = "1";
    updateFloatingCartBar();
  });

  // +
  qtyWrap.querySelector(".increase-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cart = getCart();
    if (!cart[key]) cart[key] = { id: key, qty: 0 };
    cart[key].qty = (Number(cart[key].qty) || 0) + 1;
    saveCart(cart);
    qtySpan.textContent = cart[key].qty;
    updateFloatingCartBar();
  });

  // –
  qtyWrap.querySelector(".decrease-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cart = getCart();
    if (!cart[key]) return;
    cart[key].qty = (Number(cart[key].qty) || 0) - 1;
    if (cart[key].qty <= 0) {
      delete cart[key];
      saveCart(cart);
      addBtn.style.display = "inline-block";
      qtyWrap.style.display = "none";
    } else {
      saveCart(cart);
      qtySpan.textContent = cart[key].qty;
    }
    updateFloatingCartBar();
  });
}

/*************  WISHLIST HELPERS (safeStorage)  *************/
function getWishlist() {
  try {
    const raw = window.safeStorage.getItem("wishlist");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("⚠️ wishlist read blocked:", e);
    return [];
  }
}

function saveWishlist(wishlist) {
  try {
    window.safeStorage.setItem("wishlist", JSON.stringify(wishlist));
  } catch (e) {
    console.warn("⚠️ wishlist write blocked:", e);
  }
}

function toggleWishlist(productId) {
  const idStr = String(productId);
  let wishlist = getWishlist().map(String);

  const index = wishlist.indexOf(idStr);
  let action;
  if (index === -1) {
    wishlist.push(idStr);
    action = "added";
    showToast("Added to wishlist ❤️");
  } else {
    wishlist.splice(index, 1);
    action = "removed";
    showToast("Removed from wishlist 💔");
  }

  saveWishlist(wishlist);
  return action;
}

/*************  MAIN PRODUCT FETCH  *************/
const productId = Number(new URLSearchParams(location.search).get("id"));
const product = products.find((p) => Number(p.id) === productId);

if (!product) {
  const detail = document.getElementById("productDetail");
  if (detail) {
    detail.innerHTML =
      "<p style='text-align:center; padding:40px; color:red;'>Product not found</p>";
  }
  throw new Error("Product not found");
}

let slideIndex = 0,
  player;

function isMobile() {
  return window.innerWidth < 768;
}

const slides = [
  ...product.images,
  ...(!isMobile() && product.video ? ["video"] : []),
];

// Initial renders
renderProduct();
renderRelated();
updateFloatingCartBar();

/*************  RENDER MAIN PRODUCT  *************/
function renderProduct() {
  const detail = document.getElementById("productDetail");
  if (!detail) return;

  const mediaHTML = slides
    .map((m) =>
      m === "video"
        ? `<div class="slide video-thumb">
            <div class="video-thumbnail" onclick="loadVideoOnClick(this,'${product.video}')">
              <img src="https://img.youtube.com/vi/${vidId(
                product.video
              )}/hqdefault.jpg"/>
              <div class="play-button">▶️</div>
            </div>
          </div>`
        : `<div class="slide">
             <img src="${m}" class="product-main-img zoomable" />
           </div>`
    )
    .join("");

  const dots = slides
    .map(
      (_, i) => `<span class="dot" onclick="setSlide(${i})"></span>`
    )
    .join("");

  const inCart = getCart()[String(product.id)];

  detail.innerHTML = `
    <div class="slideshow" id="slideshow">
      ${mediaHTML}
      <button class="prev" onclick="prevSlide()">❮</button>
      <button class="next" onclick="nextSlide()">❯</button>
      <div class="dots">${dots}</div>
    </div>
    <h2>${product.name}</h2>
    ${product.descriptionHTML ? `<div class="product-description">${product.descriptionHTML}</div>` : ""}
    <p class="price">
      <span class="old">₹${product.oldPrice}</span>
      <span class="new">₹${product.newPrice}</span>
      <span class="discount">(${product.discount} off)</span>
    </p>
    ${product.inStock ? "" : `<div class="stock-badge">Out of Stock</div>`}
    <div class="button-group">
      ${
        product.inStock
          ? `
        <button class="add-to-cart-btn" style="${
          inCart ? "display:none" : ""
        }">Add to Cart</button>
        <div class="quantity-controls" style="${
          inCart ? "display:flex" : "display:none"
        }">
          <button class="decrease-btn">-</button>
          <span class="qty">${inCart ? inCart.qty : 1}</span>
          <button class="increase-btn">+</button>
        </div>
        <button class="buy-now-btn" data-id="${product.id}">Buy Now</button>
      `
          : `
        <a href="tel:+918868839446" class="call-btn">Call Now</a>
        <a href="https://wa.me/918868839446" class="whatsapp-btn">WhatsApp</a>
      `
      }
    </div>
  `;

  // Inject "Watch Video" button (only on mobile)
  const watchBtnHTML = renderWatchButton(product.video);
  if (watchBtnHTML) {
    detail
      .querySelector(".button-group")
      ?.insertAdjacentHTML("beforebegin", watchBtnHTML);
  }

  // Bind cart for main product
  const addBtn = detail.querySelector(".add-to-cart-btn");
  const qtyWrap = detail.querySelector(".quantity-controls");
  const qtySpan = detail.querySelector(".qty");

  if (addBtn && qtyWrap && qtySpan) {
    bindCartUI(product.id, product, addBtn, qtyWrap, qtySpan);
  }

  initSlides();
  if (product.video) loadYT();
}

/*************  SLIDES / MEDIA  *************/
function initSlides() {
  updateSlides();
  addSwipe();
  renderThumbnails();
}

function updateSlides() {
  const slideEls = document.querySelectorAll(".slide");
  const dotEls = document.querySelectorAll(".dot");

  slideEls.forEach((s, i) => {
    s.style.display = i === slideIndex ? "block" : "none";
  });

  dotEls.forEach((d, i) => {
    d.classList.toggle("active", i === slideIndex);
  });
}

function nextSlide() {
  slideIndex = (slideIndex + 1) % slides.length;
  updateSlides();
}

function prevSlide() {
  slideIndex = (slideIndex - 1 + slides.length) % slides.length;
  updateSlides();
}

function setSlide(i) {
  slideIndex = i;
  updateSlides();
}

function addSwipe() {
  const ss = document.getElementById("slideshow");
  if (!ss) return;

  let xStart = 0;
  ss.addEventListener("touchstart", (e) => {
    xStart = e.touches[0].clientX;
  });

  ss.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - xStart;
    if (dx > 50) prevSlide();
    else if (dx < -50) nextSlide();
  });
}

function renderThumbnails() {
  const slideWrap = document.getElementById("slideshow");
  if (!slideWrap || !product.images || product.images.length <= 1) return;

  const existing = document.querySelector(".thumbnail-row");
  if (existing) existing.remove();

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumbnail-row";

  product.images.forEach((img, idx) => {
    const thumb = document.createElement("img");
    thumb.src = img;
    thumb.className = "thumbnail" + (idx === slideIndex ? " active" : "");
    thumb.onclick = () => {
      setSlide(idx);
      document
        .querySelectorAll(".thumbnail")
        .forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
      document
        .querySelector(".slide")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    thumbWrap.appendChild(thumb);
  });

  slideWrap.insertAdjacentElement("afterend", thumbWrap);
}

function vidId(u) {
  const m = u.match(/[\?&]v=([^&#]*)|youtu\.be\/([^&#]*)/);
  return m ? m[1] || m[2] : "";
}

function loadVideoOnClick(el, url) {
  el.outerHTML = `<iframe src="https://www.youtube.com/embed/${vidId(
    url
  )}?autoplay=1&rel=0&modestbranding=1" width="100%" height="315" allowfullscreen frameborder="0"></iframe>`;
}

function loadYT() {
  const v = vidId(product.video);
  if (!v) return;

  if (window.YT?.Player) {
    player = new YT.Player("player", { videoId: v });
  } else {
    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player("player", { videoId: v });
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(s);
  }
}

// "Watch Video" button for mobile
function renderWatchButton(videoUrl) {
  if (!videoUrl || window.innerWidth >= 768) return "";
  const vId = vidId(videoUrl);
  return `<a href="https://www.youtube.com/watch?v=${vId}" class="watch-video-btn" target="_blank" rel="noopener noreferrer">▶ Watch Video on YouTube</a>`;
}

/*************  RELATED PRODUCTS  *************/
function renderRelated() {
  const wrap = document.getElementById("relatedProducts");
  if (!wrap) return;

  const currentCategories = product.categories || [product.category];
  let rel = products.filter((p) => {
    if (Number(p.id) === productId) return false;
    const prodCats = p.categories || [p.category];
    return prodCats.some((cat) => currentCategories.includes(cat));
  });

  if (rel.length < 25) {
    rel = [
      ...rel,
      ...products
        .filter(
          (p) =>
            Number(p.id) !== productId && p.category !== product.category
        )
        .slice(0, 25 - rel.length),
    ];
  } else {
    rel = rel.slice(0, 25);
  }

  wrap.innerHTML = "";
  const wishlistNow = getWishlist().map(String);

  rel.forEach((prod) => {
    const key = String(prod.id);
    const inCart = getCart()[key];
    const isInWishlist = wishlistNow.includes(key);

    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class='image-container' style="position:relative;">
        <img src='${prod.images[0]}' class='product-img' loading="lazy"/>
        <div class="wishlist-icon" data-id="${prod.id}" style="position:absolute; top:10px; right:10px; font-size:20px; cursor:pointer; color:${
          isInWishlist ? "red" : "#aaa"
        };">
          ${isInWishlist ? "❤️" : "🤍"}
        </div>
      </div>
      <h3>${prod.name}</h3>
      <p class='price'>
        <span class='new'>₹${prod.newPrice}</span>
        <span class='old'>₹${prod.oldPrice}</span>
      </p>
      <div class='button-group'>
        ${
          prod.inStock
            ? `
          <button class='add-to-cart-btn' style='${
            inCart ? "display:none" : ""
          }'>Add to Cart</button>
          <div class='quantity-controls' style='${
            inCart ? "display:flex" : "display:none"
          }'>
            <button class='decrease-btn'>-</button>
            <span class='qty'>${inCart ? inCart.qty : 1}</span>
            <button class='increase-btn'>+</button>
          </div>
          <button class="buy-now-btn" data-id="${prod.id}">Buy Now</button>
        `
            : `
          <a href='tel:+918868839446' class='call-btn'>Call Now</a>
          <a href='https://wa.me/918868839446' class='whatsapp-btn'>WhatsApp</a>
        `
        }
      </div>
    `;

    card.querySelector(".image-container").onclick = () =>
      (location.href = `product-detail.html?id=${prod.id}`);
    card.querySelector("h3").onclick = () =>
      (location.href = `product-detail.html?id=${prod.id}`);

    if (prod.inStock) {
      bindCartUI(
        prod.id,
        prod,
        card.querySelector(".add-to-cart-btn"),
        card.querySelector(".quantity-controls"),
        card.querySelector(".qty")
      );
    }

    wrap.appendChild(card);

    // Wishlist heart handler
    const heart = card.querySelector(".wishlist-icon");
    heart.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = heart.getAttribute("data-id");
      const action = toggleWishlist(id);
      heart.textContent = action === "added" ? "❤️" : "🤍";
      heart.style.color = action === "added" ? "red" : "#aaa";
    });
  });
}

/*************  BUY-NOW HANDLER (safe sessionStorage) *************/
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("buy-now-btn")) {
    const pid = e.target.dataset.id;
    setSS("buyNowProduct", pid);
    window.location.href = "buynow.html";
  }
});
