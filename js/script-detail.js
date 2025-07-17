// ----------------------------
// script-detail.js  (PROFESSIONAL FINAL)
// ----------------------------
// ▸ Floating‑cart bar synced to localStorage
// ▸ Main product cart + media
// ▸ Related‑products keep original layout:  
//    in‑stock ➜ Add + WhatsApp (+qty controls)  
//    out‑of‑stock ➜ Call Now + WhatsApp (no qty controls)
// -------------------------------------------------------------

/*************  CART HELPERS  *************/
function getCart() { return JSON.parse(localStorage.getItem("cart")) || {}; }
function saveCart(c) { localStorage.setItem("cart", JSON.stringify(c)); }
function updateFloatingCartBar() {
  const bar = document.getElementById("floatingCartBar");
  const count = document.getElementById("cartItemCount");
  const total = document.getElementById("cartTotalAmount");
  if (!bar || !count || !total) return;
  let itemCount = 0, amount = 0;
  Object.values(getCart()).forEach(i => { itemCount += i.qty; amount += i.qty * (i.newPrice ?? 0); });
  count.textContent = itemCount; total.textContent = `₹${amount}`;
  bar.style.display = itemCount ? "flex" : "none";
}
function bindCartUI(id, prod, addBtn, qtyWrap, qtySpan) {
  let cart = getCart();
  if (cart[id]) { addBtn.style.display = "none"; qtyWrap.style.display = "flex"; qtySpan.textContent = cart[id].qty; }
  // Add
  addBtn.addEventListener("click", e => { e.stopPropagation(); cart = getCart(); cart[id] = { ...prod, qty: 1 }; saveCart(cart); addBtn.style.display = "none"; qtyWrap.style.display = "flex"; qtySpan.textContent = "1"; updateFloatingCartBar(); });
  // +
  qtyWrap.querySelector(".increase-btn").addEventListener("click", e => { e.stopPropagation(); cart = getCart(); cart[id].qty++; saveCart(cart); qtySpan.textContent = cart[id].qty; updateFloatingCartBar(); });
  // –
  qtyWrap.querySelector(".decrease-btn").addEventListener("click", e => { e.stopPropagation(); cart = getCart(); cart[id].qty--; if (cart[id].qty <= 0) { delete cart[id]; saveCart(cart); addBtn.style.display = "inline-block"; qtyWrap.style.display = "none"; } else { saveCart(cart); qtySpan.textContent = cart[id].qty; } updateFloatingCartBar(); });
}

/*************  MAIN PRODUCT  *************/
const productId = +new URLSearchParams(location.search).get("id");
const product = products.find(p => p.id === productId);
if (!product) { document.getElementById("productDetail").innerHTML = "<p>Product not found</p>"; throw new Error(); }

let slideIndex = 0, player;
function isMobile() {
  return window.innerWidth < 768;
}
const slides = [...product.images, ...(!isMobile() && product.video ? ["video"] : [])];

renderProduct(); renderRelated(); updateFloatingCartBar();

function renderProduct() {
  const detail = document.getElementById("productDetail");
  const mediaHTML = slides.map(m => m === "video"
    ? `<div class="slide video-thumb">
        <div class="video-thumbnail" onclick="loadVideoOnClick(this,'${product.video}')">
          <img src="https://img.youtube.com/vi/${vidId(product.video)}/hqdefault.jpg"/>
          <div class="play-button">▶️</div>
        </div>
      </div>`
    : `<div class="slide"><img src="${m}" /></div>`
  ).join("");

  const dots = slides.map((_, i) =>
    `<span class="dot" onclick="setSlide(${i})"></span>`
  ).join("");

  const inCart = getCart()[product.id];
  detail.innerHTML = `
    <div class="slideshow" id="slideshow">
      ${mediaHTML}
      <button class="prev" onclick="prevSlide()">❮</button>
      <button class="next" onclick="nextSlide()">❯</button>
      <div class="dots">${dots}</div>
    </div>
    <h2>${product.name}</h2>
    <p class="price">
      <span class="old">₹${product.oldPrice}</span>
      <span class="new">₹${product.newPrice}</span>
      <span class="discount">(${product.discount} off)</span>
    </p>
    ${product.inStock ? "" : `<div class="stock-badge">Out of Stock</div>`}
    <div class="button-group">
  ${product.inStock
    ? `
      <button class="add-to-cart-btn" style="${inCart ? "display:none" : ""}">Add to Cart</button>
      <div class="quantity-controls" style="${inCart ? "display:flex" : "display:none"}">
        <button class="decrease-btn">-</button>
        <span class="qty">${inCart ? inCart.qty : 1}</span>
        <button class="increase-btn">+</button>
      </div>
      <button class="buy-now-btn" data-id="${product.id}">Buy Now</button>
    `
    : `
      <a href="tel:+918868839446" class="call-btn">Call Now</a>
      <a href="https://wa.me/918868839446" class="whatsapp-btn">WhatsApp</a>
    `}
</div>`;

  // ✅ Inject Watch Video button (only on mobile)
  const watchBtnHTML = renderWatchButton(product.video);
  detail.querySelector(".button-group")?.insertAdjacentHTML("beforebegin", watchBtnHTML);

  // cart bind
  const addBtn = detail.querySelector(".add-to-cart-btn");
  if (addBtn) {
    bindCartUI(
      product.id,
      product,
      addBtn,
      detail.querySelector(".quantity-controls"),
      detail.querySelector(".qty")
    );
  }

  initSlides();
  if (product.video) loadYT();
}


/*************  SLIDES / MEDIA  *************/
function initSlides() { updateSlides(); addSwipe(); }
function updateSlides() { document.querySelectorAll(".slide").forEach((s, i) => s.style.display = i === slideIndex ? "block" : "none"); document.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === slideIndex)); }
function nextSlide() { slideIndex = (slideIndex + 1) % slides.length; updateSlides(); }
function prevSlide() { slideIndex = (slideIndex - 1 + slides.length) % slides.length; updateSlides(); }
function setSlide(i) { slideIndex = i; updateSlides(); }
function addSwipe() { const ss = document.getElementById("slideshow"); let x = 0; ss.addEventListener("touchstart", e => x = e.touches[0].clientX); ss.addEventListener("touchend", e => { const dx = e.changedTouches[0].clientX - x; if (dx > 50) prevSlide(); else if (dx < -50) nextSlide(); }); }
function vidId(u) { const m = u.match(/[\?&]v=([^&#]*)|youtu\.be\/([^&#]*)/); return m ? m[1] || m[2] : ""; }
function loadVideoOnClick(el, url) { el.outerHTML = `<iframe src='https://www.youtube.com/embed/${vidId(url)}?autoplay=1&rel=0&modestbranding=1' width='100%' height='315' allowfullscreen frameborder='0'></iframe>`; }
function loadYT() { const v = vidId(product.video); if (!v) return; if (window.YT?.Player) { player = new YT.Player("player", { videoId: v }); } else { window.onYouTubeIframeAPIReady = () => player = new YT.Player("player", { videoId: v }); const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(s); } }


// 📍 Create "Watch Video" button (only on mobile)
function renderWatchButton(videoUrl) {
  if (!videoUrl || window.innerWidth >= 768) return "";
  const vId = vidId(videoUrl);
  return `<a href="https://www.youtube.com/watch?v=${vId}" class="watch-video-btn" target="_blank" rel="noopener noreferrer">▶ Watch Video on YouTube</a>`;
}


// 📍 Inject Watch Button into renderProduct()
// Inside renderProduct(), after detail.innerHTML = `...`, add:





/*************  RELATED PRODUCTS  *************/
function renderRelated() {
  const wrap = document.getElementById("relatedProducts");
  const currentCategories = product.categories || [product.category];
let rel = products.filter(p => {
  if (p.id === productId) return false;
  const prodCats = p.categories || [p.category];
  return prodCats.some(cat => currentCategories.includes(cat));
});
  if (rel.length < 25) rel = [...rel, ...products.filter(p => p.id !== productId && p.category !== product.category).slice(0, 25 - rel.length)]; else rel = rel.slice(0, 25);
  wrap.innerHTML = "";
  rel.forEach(prod => {
    const inCart = getCart()[prod.id];
    const card = document.createElement("div"); card.className = "product-card";
    card.innerHTML = `<div class='image-container'><img src='${prod.images[0]}' class='product-img' loading="lazy"/></div>
      <h3>${prod.name}</h3>
      <p class='price'><span class='new'>₹${prod.newPrice}</span> <span class='old'>₹${prod.oldPrice}</span></p>
      <div class='button-group'>
  ${prod.inStock ? `
     <button class='add-to-cart-btn' style='${inCart ? "display:none" : ""}'>Add to Cart</button>
     <div class='quantity-controls' style='${inCart ? "display:flex" : "display:none"}'>
       <button class='decrease-btn'>-</button>
       <span class='qty'>${inCart ? inCart.qty : 1}</span>
       <button class='increase-btn'>+</button>
     </div>
     <button class="buy-now-btn" data-id="${prod.id}">Buy Now</button>
  ` : `
     <a href='tel:+918868839446' class='call-btn'>Call Now</a>
     <a href='https://wa.me/918868839446' class='whatsapp-btn'>WhatsApp</a>
  `}
</div>
`;
    card.querySelector(".image-container").onclick = () => location.href = `product-detail.html?id=${prod.id}`;
    card.querySelector("h3").onclick = () => location.href = `product-detail.html?id=${prod.id}`;
    if (prod.inStock) { bindCartUI(prod.id, prod, card.querySelector(".add-to-cart-btn"), card.querySelector(".quantity-controls"), card.querySelector(".qty")); }
    wrap.appendChild(card);
  });
}
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("buy-now-btn")) {
    const productId = e.target.dataset.id;
    sessionStorage.setItem("buyNowProduct", productId);
    window.location.href = "buynow.html";
  }
});
