const row1 = document.getElementById("stylesRow1");
const row2 = document.getElementById("stylesRow2");

// Shuffle helper function
function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Get shuffled selection of 14 products
function getShuffledFeaturedProducts(count = 14) {
  const inStockProducts = products.filter(p => p.stock !== 0);
  return shuffleArray(inStockProducts).slice(0, count);
}

function generateStyleCard(product) {
  const div = document.createElement("div");
  div.className = "style-card";
  div.innerHTML = 
    `<div class="rect-img-wrapper" onclick="window.location.href='product-detail.html?id=${product.id}'">
      <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
      <span class="flame-icon">🔥</span>
    </div>
    <p>${product.name2 || product.name}</p>`
  ;
  return div;
}

function renderRow(row, data) {
  row.innerHTML = "";
  data.forEach(product => {
    const card = generateStyleCard(product);
    row.appendChild(card);
  });
}

// Call this on load or on reshuffle
function renderStylishCards() {
  const featuredProducts = getShuffledFeaturedProducts();
  const split1 = featuredProducts.slice(0, 7);
  const split2 = featuredProducts.slice(7, 14);
  renderRow(row1, split1);
  renderRow(row2, split2);
}

// Initial render
renderStylishCards();
 