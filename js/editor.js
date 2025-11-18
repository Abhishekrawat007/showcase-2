// 🌩️ Cloudinary config
// 🌩️ Cloudinary config (read from window.__CONFIG when available)
let CLOUDINARY_URL = window.__CONFIG?.cloudinary?.url || "";
let CLOUDINARY_PRESET = window.__CONFIG?.cloudinary?.preset || "";

if (!CLOUDINARY_URL || !CLOUDINARY_PRESET) {
  console.warn('Cloudinary config missing. window.__CONFIG.cloudinary:', window.__CONFIG?.cloudinary);
}

// defensive: if window.__CONFIG arrives slightly later
try {
  if (window.__CONFIG && window.__CONFIG.cloudinary) {
    CLOUDINARY_URL = window.__CONFIG.cloudinary.url || CLOUDINARY_URL;
    CLOUDINARY_PRESET = window.__CONFIG.cloudinary.preset || CLOUDINARY_PRESET;
  }
} catch (e) {
  console.warn('Could not read cloudinary config from window.__CONFIG', e);
}


// at top of editor.js — auth check on script load
(async function ensureAuth() {
  const token = sessionStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "kunnu.html";
    return;
  }
  try {
    const res = await fetch("/.netlify/functions/verify", {
      method: "GET",
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      sessionStorage.removeItem("adminToken");
      window.location.href = "kunnu.html";
    }
  } catch (e) {
    console.error("Auth verify error:", e);
    sessionStorage.removeItem("adminToken");
    window.location.href = "kunnu.html";
  }
})();

let originalProducts = JSON.parse(JSON.stringify(products));
const productHistory = new Map();
let filteredProducts = [...products];
let currentPage = 1;
const perPage = 30;
const productList = document.getElementById("productList");

function removeImage(productIndex, imageIndex) {
  showModal({
    title: "Delete Image?",
    message: "Are you sure you want to delete this image?",
    onConfirm: () => {
      products[productIndex].images.splice(imageIndex, 1);
      renderProducts();
    }
  });
}

function openImageModal(url) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const closeBtn = document.getElementById('modalCloseBtn');

  modalImg.src = url;
  modal.style.display = 'flex';

  // Close when clicking ✖
  closeBtn.onclick = () => {
    modal.style.display = 'none';
    modalImg.src = '';
  };

  // Close when clicking outside the image
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modalImg.src = '';
    }
  };
}
function debouncedSearch() {
  clearTimeout(window.searchDebounce);
  window.searchDebounce = setTimeout(() => {
    const q = document.getElementById("searchInput").value.toLowerCase().trim();
    filteredProducts = !q
      ? [...products]
      : products.filter(p => {
          const name = p.name?.toLowerCase() || "";
          const name2 = p.name2?.toLowerCase() || "";
          const category = p.category?.toLowerCase() || "";
          const tags = (p.categories || []).map(t => t.toLowerCase());
          return (
            name.includes(q) ||
            name2.includes(q) ||
            category.includes(q) ||
            tags.some(tag => tag.includes(q))
          );
        });
    currentPage = 1;
    renderProducts();
  }, 200);
}

function renderProducts() {
  // Add New Product button at the bottom (will be placed again later before pagination)
const bottomAddBtn = document.createElement("button");
bottomAddBtn.textContent = "➕ Add New Product";
bottomAddBtn.className = "bottom-add-btn";
bottomAddBtn.style.margin = "30px auto";
bottomAddBtn.style.display = "block";
bottomAddBtn.onclick = addProduct;
  productList.innerHTML = "";
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageProducts = filteredProducts.slice(start, end);

  if (pageProducts.length === 0) {
    productList.innerHTML = "<p style='text-align:center;'>No products found.</p>";
    return;
  }

  pageProducts.forEach((product, i) => {
    const actualIndex = products.findIndex(p => p.id === product.id); // ✅ Find actual index

    const card = document.createElement("div");
    card.className = "product-card";

    const previewImages = (product.images || []).map((img, imageIndex) =>
      `<div class="image-preview-wrapper" style="position:relative; display:inline-block;">
        <img src="${img}" height="60" style="object-fit:cover;border-radius:6px;margin:5px;cursor:pointer" onclick="openImageModal('${img}')" />
        <button onclick="removeImage(${actualIndex}, ${imageIndex})"
          style="position: absolute; top: 2px; right: 2px; background-color: red; border: none; border-radius: 50%; color: white; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ✖️
        </button>
      </div>`).join("");

    card.innerHTML = `
      <label>ID:</label>
<input 
  type="text" 
  value="${product.id ?? ''}" 
  onchange="updateField(${actualIndex}, 'id', this.value)" 
  style="${String(product.id).startsWith('temp-') ? 'border: 2px solid red;' : ''}" 
/>
${String(product.id).startsWith('temp-') 
  ? `<div style="color: red; font-size: 12px; margin-top: 2px;">
       ⚠️ This product has a temporary ID. Please set a valid unique ID before publishing.
     </div>` 
  : ''}
      <label>Product Name:</label><input type="text" value="${product.name || ''}" onchange="updateField(${actualIndex}, 'name', this.value)" />
      <label>Subtitle:</label><input type="text" value="${product.name2 || ''}" onchange="updateField(${actualIndex}, 'name2', this.value)" />
      <label>Main Category:</label><input type="text" value="${product.category || ''}" onchange="updateField(${actualIndex}, 'category', this.value)" />
      <label>Tags:</label><input type="text" value="${(product.categories || []).join(', ')}" onchange="updateTags(${actualIndex}, this.value)" />
      <label>Images:</label><textarea onchange="updateImages(${actualIndex}, this.value)">${(product.images || []).join(', ')}</textarea>
      <div class="preview-images" id="sortable-${actualIndex}">${previewImages}</div>

      <label>Upload Images:</label>
      <div style="margin: 0px 0;">
        <label for="upload-btn-${actualIndex}" style="display:inline-block; background:#444; color:#fff; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:500; transition: background 0.3s, box-shadow 0.3s;" onmouseover="this.style.background='#666'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)'" onmouseout="this.style.background='#444'; this.style.boxShadow='none'">
          📤 Upload Images
        </label>
        <input type="file" accept="image/*" multiple id="upload-btn-${actualIndex}" onchange="handleImageUpload(this.files, ${actualIndex})" style="display:none;" />
        <span id="upload-spinner-${actualIndex}" class="spinner" style="display:none;">⏳</span>
      </div>

      <label>Video URL:</label><input type="text" value="${product.video || ''}" onchange="updateField(${actualIndex}, 'video', this.value); renderProducts();" />
      ${getYouTubeEmbedURL(product.video)
        ? `<button onclick="window.open('${product.video}', '_blank')" class="watch-video-btn" style="margin-top: 6px; padding: 6px 12px; border: none; background: #d62828; color: white; border-radius: 5px; cursor: pointer;">▶️ Watch Product Video</button>`
        : ""}
      <label>Product Description (HTML allowed)</label>
<textarea onchange="updateField(${actualIndex}, 'descriptionHTML', this.value)">${product.descriptionHTML || ''}</textarea>
      <label>Price:</label><input type="number" value="${product.newPrice || 0}" onchange="updateField(${actualIndex}, 'newPrice', this.value)" />
      <label>Old Price:</label><input type="number" value="${product.oldPrice || 0}" onchange="updateField(${actualIndex}, 'oldPrice', this.value)" />
      <label>Discount:</label><input type="text" value="${product.discount || ''}" onchange="updateField(${actualIndex}, 'discount', this.value)" />
      <label>Media Count:</label><input type="text" value="${product.mediaCount || ''}" onchange="updateField(${actualIndex}, 'mediaCount', this.value)" />

      <label>In Stock:</label>
      <select onchange="updateField(${actualIndex}, 'inStock', this.value === 'true')">
        <option value="true" ${product.inStock ? 'selected' : ''}>Yes</option>
        <option value="false" ${!product.inStock ? 'selected' : ''}>No</option>
      </select>

      <div class="actions" gap:10px;">
        <button class="delete" onclick="undoProduct(${actualIndex})" style="background:#6c757d; color:white;">↩️ Undo</button>
        <button class="delete" onclick="deleteProduct(${actualIndex})" style="background:#d62828; color:white;">🗑 Delete</button>
      </div>`;

    productList.appendChild(card);

    const sortableEl = document.getElementById(`sortable-${actualIndex}`);
    if (sortableEl) {
      new Sortable(sortableEl, {
        animation: 150,
        onEnd: function (evt) {
          const oldIndex = evt.oldIndex;
          const newIndex = evt.newIndex;
          const movedItem = products[actualIndex].images.splice(oldIndex, 1)[0];
          products[actualIndex].images.splice(newIndex, 0, movedItem);
        },
      });
    }
  });

  productList.appendChild(bottomAddBtn);
renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredProducts.length / perPage);
  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.marginTop = "1.5rem";
  const prev = document.createElement("button");
  prev.textContent = "⬅️ Previous";
  prev.disabled = currentPage === 1;
  prev.className = "export";
  prev.onclick = () => {
    currentPage--;
    renderProducts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = document.createElement("button");
  next.textContent = "Next ➡️";
  next.disabled = currentPage === totalPages;
  next.className = "export";
  next.onclick = () => {
    currentPage++;
    renderProducts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  container.appendChild(prev);
  container.appendChild(document.createTextNode(` Page ${currentPage} of ${totalPages}`));
  container.appendChild(next);
  productList.appendChild(container);
}

function updateField(index, key, value) {
  if (!productHistory.has(index)) {
    productHistory.set(index, { ...products[index] });
  }
  products[index][key] = value;
}

function updateTags(index, value) {
  if (!productHistory.has(index)) {
    productHistory.set(index, { ...products[index] });
  }
  products[index].categories = value.split(',').map(t => t.trim());
}

function updateImages(index, value) {
  if (!productHistory.has(index)) {
    productHistory.set(index, { ...products[index] });
  }
  products[index].images = value.split(',').map(t => t.trim());
}

function undoProduct(index) {
  if (productHistory.has(index)) {
    products[index] = { ...productHistory.get(index) };
    productHistory.delete(index);
    renderProducts();
  } else {
    alert("No recent changes to undo for this product.");
  }
}
async function handleImageUpload(files, index) {
  
  const uploadBtn = document.querySelector(`#upload-btn-${index}`);
  const spinner = document.querySelector(`#upload-spinner-${index}`);
  uploadBtn.disabled = true;
  spinner.style.display = "inline-block";

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    try {
      const res = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!products[index].images) products[index].images = [];
      products[index].images.push(data.secure_url);
    } catch (err) {
      console.error("❌ Upload error:", err);
      alert("Upload failed. Try again.");
    }
  }

  uploadBtn.disabled = false;
  spinner.style.display = "none";
  renderProducts();
}

function deleteProduct(index) {
  showModal({
    title: "Delete Product?",
    message: "Are you sure you want to delete this product?",
    onConfirm: () => {
      products.splice(index, 1);
      filteredProducts = [...products];
      renderProducts();
    }
  });
}
function getYouTubeEmbedURL(url) {
  try {
    const ytRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(ytRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  } catch (e) {
    console.warn("Invalid YouTube URL:", url);
  }
  return null;
}
function generateTempId() {
  return `temp-${Math.random().toString(36).substr(2, 6)}-${Date.now()}`;
}
function addProduct() {
  const newProduct = {
    id: generateTempId(), // Use helper here
    name: "New Product",
    name2: "",
    category: "",
    categories: [],
    images: [],
    video: "",
    newPrice: 0,
    oldPrice: 0,
    discount: "",
    mediaCount: "",
    inStock: true
  };

  products.push(newProduct);
  filteredProducts = [...products];
  currentPage = Math.ceil(filteredProducts.length / perPage);
  renderProducts();

  setTimeout(() => {
    const cards = document.querySelectorAll(".product-card");
    cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function undoChanges() {
  products = JSON.parse(JSON.stringify(originalProducts));
  filteredProducts = [...products];
  currentPage = 1;
  renderProducts();
}

function exportProducts() {
  const blob = new Blob([`const products = ${JSON.stringify(products, null, 2)};\nexport default products;`], {
    type: "application/javascript"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product.js";
  a.click();
  URL.revokeObjectURL(url);
}

function showModal({ title, message, onConfirm }) {
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-message").innerText = message;
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  document.getElementById("modal-confirm").onclick = () => {
    modal.classList.add("hidden");
    onConfirm?.();
  };
  document.getElementById("modal-cancel").onclick = () => {
    modal.classList.add("hidden");
  };
}

function logout() {
  showModal({
    title: "Logout?",
    message: "Are you sure you want to log out of the admin panel?",
    onConfirm: () => {
      localStorage.removeItem("isAdmin");
      window.location.href = "admin.html";
    }
  });
}

function exitEditor() {
  showModal({
    title: "Exit Editor?",
    message: "Unsaved changes will be lost.",
    onConfirm: () => {
      window.location.href = "index.html";
    }
  });
}

window.addProduct = addProduct;
window.exportProducts = exportProducts;
window.undoChanges = undoChanges;
window.logout = logout;
window.exitEditor = exitEditor;
window.updateField = updateField;
window.updateImages = updateImages;
window.updateTags = updateTags;
window.handleImageUpload = handleImageUpload;
window.deleteProduct = deleteProduct;
window.debouncedSearch = debouncedSearch;

window.onload = () => renderProducts();

async function submitChanges(products) {
  // Check for any products with a temporary ID
  const tempProducts = products.filter(p => typeof p.id === 'string' && p.id.startsWith('temp-'));
  if (tempProducts.length > 0) {
    alert(`⚠️ ${tempProducts.length} product(s) have temporary IDs. Please set a valid unique ID before publishing.`);
    return; // Stop submission
  }

  const productArray = JSON.stringify(products, null, 2);

  const fileContent = 
`const products = ${productArray};

// Works in browser
if (typeof window !== 'undefined') {
  window.products = products;
}

// Works in Node.js / Netlify
if (typeof module !== 'undefined') {
  module.exports = products;
}
`.trim();

  try {
    const token = sessionStorage.getItem("adminToken");
const res = await fetch("/.netlify/functions/updateProduct", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + (token || "")
  },
  body: JSON.stringify({ owner: "Abhishekrawat007", repo: "my-ecommerce-site", path: "js/product.js", content: fileContent }),
});


    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid JSON returned:\n" + text);
    }

    if (res.ok) {
      const modalEl = document.querySelector("#successModal");
      modalEl.classList.add("show");
      modalEl.style.display = "flex";
      console.log("✅ Response:", data);
    } else {
      throw new Error(data.error || "❌ Unknown error from server.");
    }
  } catch (err) {
    showModal({
      title: "Publish Failed",
      message: "❌ " + err.message,
    });
    console.error("Full error:", err);
  }
  // inside submitChanges after product.js publish success:
await fetch('/.netlify/functions/updateProduct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({
    owner: "...",
    repo: "...",
    path: "js/stylishPages.js",
    content: localStorage.getItem('stylishPages') ? `const stylishPages = ${localStorage.getItem('stylishPages')};\nif(typeof window!=='undefined') window.stylishPages = stylishPages;` : 'const stylishPages = []; if(typeof window!=="undefined") window.stylishPages = stylishPages;'
  })
});

}

// ---------- Save New Arrivals to repo (creates js/newArrivals.js) ----------
async function saveNewArrivalsToRepo(idArray) {
  const fileContent =
`const newArrivals = ${JSON.stringify(idArray, null, 2)};

export default newArrivals;
`;

  try {
    const token = sessionStorage.getItem("adminToken") || "";
    const res = await fetch("/.netlify/functions/updateProduct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        owner: "Abhishekrawat007",
        repo: "my-ecommerce-site",
        path: "js/newArrivals.js",
        content: fileContent
      })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON: " + text); }
    if (!res.ok) throw new Error(data.error || "Failed to save newArrivals.js");
    console.log("✅ newArrivals.js saved:", data);
    return data;
  } catch (err) {
    console.error("saveNewArrivalsToRepo error:", err);
    throw err;
  }
}
// Put near top of editor.js (or below saveNewArrivalsToRepo)
function persistNewArrivalsLocally(idArray){
  try {
    const csv = idArray.map(String).join(',');
    localStorage.setItem('newArrivalsIds', csv);       // cross-tab preview
    try { sessionStorage.setItem('newArrivalsIds', csv); } catch(_) {}
    // also set a runtime global for immediate preview in same window
    window.newArrivals = idArray.map(String);
    console.log('Local new arrivals saved:', idArray);
  } catch (err) {
    console.warn('Failed to persist new arrivals locally', err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const submitBtn = document.getElementById("submitBtn");
  const modal = document.getElementById("confirmModal");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");
  const confirmClose = document.getElementById("confirmClose");
  const successModal = document.getElementById("successModal");
  const successClose = document.getElementById("successClose");
  const successOk = document.getElementById("successOk");

  // Open confirm modal
  submitBtn.addEventListener("click", () => {
    modal.classList.add("show");
    modal.style.display = "flex";
  });

  // Close confirm modal
  [confirmNo, confirmClose].forEach(el =>
    el?.addEventListener("click", () => {
      modal.classList.remove("show");
      modal.style.display = "none";
    })
  );

  // Confirm publish
  confirmYes?.addEventListener("click", async () => {
    modal.classList.remove("show");
    modal.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "🚀 Publishing...";

    try {
      await submitChanges(products);
    } catch (err) {
      alert("❌ Failed to publish: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "🚀 Submit & Publish";
    }
  });

  // Close success modal
  [successClose, successOk].forEach(el =>
    el?.addEventListener("click", () => {
      successModal.classList.remove("show");
      successModal.style.display = "none";
    })
  );
});
/* ---------- Broadcast UI & logic (append to editor.js) ---------- */
(function () {
  const btn = document.getElementById('btn-broadcast');
  const modal = document.getElementById('broadcast-modal');
  const backdrop = document.getElementById('broadcast-backdrop');
  const inTitle = document.getElementById('broadcast-input-title');
  const inBody = document.getElementById('broadcast-input-body');
  const inUrl = document.getElementById('broadcast-input-url');
  const sendBtn = document.getElementById('broadcast-send');
  const cancelBtn = document.getElementById('broadcast-cancel');
  const resultEl = document.getElementById('broadcast-result');

  if (!btn || !modal) return; // nothing to do if missing

  function openModal() {
    // apply theme quickly (editor uses body.dark-mode)
    // show modal and backdrop
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    inTitle.value = '';
    inBody.value = '';
    inUrl.value = '/';
    resultEl.textContent = '';
    inTitle.focus();
    // stop page scroll
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    resultEl.textContent = '';
    // restore scrolling
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // When Broadcast button clicked: prompt for secret, store in sessionStorage for session
  btn.addEventListener('click', () => {
    // quick check that admin is logged in (you already check adminToken earlier)
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      alert('You must be logged in as admin to send broadcasts.');
      return;
    }

    // Ask for secret (so we do not store it in code)
    let secret = sessionStorage.getItem('broadcast_secret');
    if (!secret) {
      secret = prompt('Enter broadcast secret (admin only):');
      if (!secret) return;
      sessionStorage.setItem('broadcast_secret', secret);
    }
    openModal();
  });

  // Cancel
  cancelBtn?.addEventListener('click', () => {
    closeModal();
  });

  // Send
  // Replace current sendBtn click handler with this
sendBtn?.addEventListener('click', async () => {
  const title = inTitle.value.trim();
  const body = inBody.value.trim();
  const url = (inUrl.value || '/').trim() || '/';

  if (!title || !body) {
    resultEl.textContent = 'Title and message are required.';
    resultEl.className = 'broadcast-result error';
    return;
  }

  let secret = sessionStorage.getItem('broadcast_secret');
  if (!secret) {
    secret = prompt('Enter broadcast secret (admin only):');
    if (!secret) { resultEl.textContent = 'Broadcast cancelled.'; resultEl.className = 'broadcast-result error'; return; }
    sessionStorage.setItem('broadcast_secret', secret);
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  resultEl.textContent = '';

  try {
    const adminToken = sessionStorage.getItem('adminToken') || '';
    const res = await fetch('/.netlify/functions/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-broadcast-secret': secret,
        'Authorization': adminToken ? ('Bearer ' + adminToken) : ''
      },
      body: JSON.stringify({ title, body, url, topic: 'all', secret })
    });

    let data;
    try { data = await res.json(); } catch (e) { data = { rawText: await res.text() }; }

    if (!res.ok) {
      if (res.status === 401) {
        resultEl.textContent = 'Unauthorized — secret is incorrect.';
        sessionStorage.removeItem('broadcast_secret');
      } else {
        resultEl.textContent = 'Server error: ' + (data.error || res.statusText || JSON.stringify(data));
      }
      resultEl.className = 'broadcast-result error';
    } else {
      // Show server JSON (very helpful for debugging)
      resultEl.innerHTML = '<pre style="white-space:pre-wrap;">' + JSON.stringify(data, null, 2) + '</pre>';
      resultEl.className = 'broadcast-result success';

      // Helpful hints
      if (data.successCount === 0) {
        resultEl.innerHTML += '<div style="color:orange;">Note: successCount is 0 — tokens may not be subscribed to topic "all" or tokens are invalid.</div>';
      }
      setTimeout(() => closeModal(), 1200);
    }
  } catch (err) {
    console.error('Broadcast send error', err);
    resultEl.textContent = 'Network error sending broadcast.';
    resultEl.className = 'broadcast-result error';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send to all';
  }
});

  // Block backdrop clicks so user must click buttons
  backdrop?.addEventListener('click', (e) => { e.stopPropagation(); });

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

})();
/* ---------- 🆕 New Arrival Management UI & Logic ---------- */
(function () {
  const btn = document.getElementById('btn-newarrival');
  const modal = document.getElementById('newarrival-modal');
  const backdrop = document.getElementById('newarrival-backdrop');
  const input = document.getElementById('newarrival-input');
  const saveBtn = document.getElementById('newarrival-save');
  const publishBtn = document.getElementById('newarrival-publish');
  const cancelBtn = document.getElementById('newarrival-cancel');
  const resultEl = document.getElementById('newarrival-result');

  if (!btn || !modal) return;

  function openModal() {
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    input.value = '';
    resultEl.textContent = '';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);

  // --- Save newArrivals.js only ---
  saveBtn?.addEventListener('click', async () => {
    const ids = input.value.trim();
    if (!ids) {
      resultEl.textContent = 'Please enter at least one product ID.';
      resultEl.className = 'broadcast-result error';
      return;
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(Boolean);
    try {
      await saveNewArrivalsToRepo(idArray);
      resultEl.textContent = '✅ newArrivals.js saved successfully!';
      resultEl.className = 'broadcast-result success';
      setTimeout(closeModal, 1200);
    } catch (err) {
      resultEl.textContent = '❌ ' + err.message;
      resultEl.className = 'broadcast-result error';
    }
  });

  // --- Save + Publish (same as main Submit & Publish) ---
  publishBtn?.addEventListener('click', async () => {
    const ids = input.value.trim();
    if (!ids) {
      resultEl.textContent = 'Please enter at least one product ID.';
      resultEl.className = 'broadcast-result error';
      return;
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(Boolean);
    try {
      await saveNewArrivalsToRepo(idArray);
      resultEl.textContent = '🚀 Publishing updates...';
      await submitChanges(products);
      resultEl.textContent = '✅ New Arrivals published successfully!';
      resultEl.className = 'broadcast-result success';
      setTimeout(closeModal, 1200);
    } catch (err) {
      resultEl.textContent = '❌ ' + err.message;
      resultEl.className = 'broadcast-result error';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
})();
/* ===== Stylish Pages Editor ===== */
(function(){
  const btn = document.getElementById('btn-stylish');
  if (!btn) return;

  // Build modal HTML on-the-fly (simple)
  const modalHtml = `
  <div id="stylish-backdrop" style="position:fixed; inset:0; display:none; z-index:1200; background:rgba(0,0,0,0.45)"></div>
  <div id="stylish-modal" style="position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); width:96%; max-width:980px; background:#fff; z-index:1201; border-radius:10px; padding:16px; display:none;">
    <h3>Stylish Pages (6 collections)</h3>
    <div id="stylish-editor-area" style="max-height:60vh; overflow:auto; margin-top:10px;"></div>
    <div style="text-align:right; margin-top:12px;">
      <button id="stylish-cancel" style="margin-right:8px;">Cancel</button>
      <button id="stylish-save" style="background:#0A84FF;color:#fff;">Save Locally</button>
      <button id="stylish-publish" style="background:#28a745;color:#fff; margin-left:8px;">Save & Publish</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  function openModal(){
    document.getElementById('stylish-backdrop').style.display = 'block';
    document.getElementById('stylish-modal').style.display = 'block';
    buildEditor();
    document.body.style.overflow = 'hidden';
  }
  function closeModal(){
    document.getElementById('stylish-backdrop').style.display = 'none';
    document.getElementById('stylish-modal').style.display = 'none';
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  document.getElementById('stylish-cancel').addEventListener('click', closeModal);
  document.getElementById('stylish-backdrop').addEventListener('click', closeModal);

  // Build editor rows for 6 pages
  function buildEditor(){
    // attempt to read existing mapping from window or localStorage
    const pages = window.stylishPages ? JSON.parse(JSON.stringify(window.stylishPages)) : (JSON.parse(localStorage.getItem('stylishPages') || 'null') || []);
    const area = document.getElementById('stylish-editor-area');
    area.innerHTML = '';

    for (let i = 0; i < 6; i++){
      const p = pages[i] || { slug:`collection-${i+1}`, title:`Collection ${i+1}`, descriptionHTML:'', productIds:[], previewImage: '' };
      const html = `
        <div style="border:1px dashed #ddd; padding:10px; margin-bottom:12px; border-radius:8px;">
          <label style="font-weight:700;">Title</label>
          <input data-idx="${i}" class="stylish-title" value="${escapeHtml(p.title)}" style="width:100%; padding:8px; margin:6px 0;" />
          <label style="font-weight:700;">Slug (url friendly)</label>
          <input data-idx="${i}" class="stylish-slug" value="${escapeHtml(p.slug)}" style="width:100%; padding:8px; margin:6px 0;" />
          <label style="font-weight:700;">Preview Image URL</label>
          <input data-idx="${i}" class="stylish-preview" value="${escapeHtml(p.previewImage||'')}" style="width:100%; padding:8px; margin:6px 0;" />
          <label style="font-weight:700;">Product IDs (comma separated)</label>
          <input data-idx="${i}" class="stylish-ids" value="${(p.productIds||[]).join(',')}" style="width:100%; padding:8px; margin:6px 0;" />
          <label style="font-weight:700;">Description (HTML allowed — appears only on stylish page)</label>
          <textarea data-idx="${i}" class="stylish-desc" style="width:100%; min-height:100px; padding:8px;">${escapeHtml(p.descriptionHTML||'')}</textarea>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
    }
  }

  function escapeHtml(str=''){ return (''+str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // save locally (for preview)
  document.getElementById('stylish-save').addEventListener('click', () => {
    const arr = collect();
    localStorage.setItem('stylishPages', JSON.stringify(arr, null, 2));
    // set runtime
    window.stylishPages = arr;
    alert('Saved locally (preview ready). Published file not updated yet.');
    // refresh home page style grid if open in same window
  if (document.getElementById('stylesRow1')) {
  // rebuild
  const stylesRow1 = document.getElementById('stylesRow1');
  const stylesRow2 = document.getElementById('stylesRow2');
  stylesRow1.innerHTML = '';
  stylesRow2.innerHTML = '';
  const row1 = arr.slice(0,3);
  const row2 = arr.slice(3,6);
  row1.forEach(p => {
    try { stylesRow1.appendChild(window.generateStylishCard ? generateStylishCard(p) : generateStylishCard(p)); }
    catch(e) { console.error('render style row1 error', e, p); }
  });
  row2.forEach(p => {
    try { stylesRow2.appendChild(window.generateStylishCard ? generateStylishCard(p) : generateStylishCard(p)); }
    catch(e) { console.error('render style row2 error', e, p); }
  });
}
  });

  // publish (save js/stylishPages.js via same update API)
  document.getElementById('stylish-publish').addEventListener('click', async () => {
    const arr = collect();
    // build fileContent
    const content = `const stylishPages = ${JSON.stringify(arr, null, 2)};\nif(typeof window!=='undefined') window.stylishPages = stylishPages;\nif(typeof module!=='undefined') module.exports = stylishPages;\n`;
    try {
      const token = sessionStorage.getItem('adminToken') || '';
      const res = await fetch('/.netlify/functions/updateProduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          owner: "Abhishekrawat007",
          repo: "my-ecommerce-site",
          path: "js/stylishPages.js",
          content
        })
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e){ throw new Error("Invalid server response: " + text); }
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      // update runtime
      window.stylishPages = arr;
      localStorage.setItem('stylishPages', JSON.stringify(arr));
      alert('Stylish pages published successfully!');
      closeModal();
    } catch (err) {
      alert('Publish failed: ' + err.message);
    }
  });

  function collect(){
    const area = document.getElementById('stylish-editor-area');
    const arr = [];
    const items = area.querySelectorAll('div[style]');
    items.forEach((div, idx) => {
      const title = (div.querySelector('.stylish-title')||{value:''}).value.trim();
      const slug = (div.querySelector('.stylish-slug')||{value:''}).value.trim();
      const previewImage = (div.querySelector('.stylish-preview')||{value:''}).value.trim();
      const ids = (div.querySelector('.stylish-ids')||{value:''}).value.trim().split(',').map(x=>x.trim()).filter(Boolean);
      const descriptionHTML = (div.querySelector('.stylish-desc')||{value:''}).value;
      arr.push({ title, slug, previewImage, productIds: ids, descriptionHTML });
    });
    return arr;
  }

  // small helper escapeHtml used earlier
  function escapeHtml(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
})();
