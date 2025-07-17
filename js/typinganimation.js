const row1 = document.getElementById("roundedRow1");
const row2 = document.getElementById("roundedRow2");

const featuredIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const featuredProducts = products.filter(p => featuredIds.includes(p.id));
const split1 = featuredProducts.slice(0, 7);
const split2 = featuredProducts.slice(7, 14);

function renderRow(row, data) {
  data.forEach(product => {
    const card = document.createElement("a");
    card.className = "rounded-card";
    card.href = `product-detail.html?id=${product.id}`;
    card.innerHTML = 
      `<img src="${product.images[0]}" alt="${product.name}">
      <p>${product.name2 || product.name}</p>`
    ;
    row.appendChild(card);
  });
}

renderRow(row1, split1);
renderRow(row2, split2);

  
  const sentences = [
    "Hi, Welcome to Sublime...",
    "Use Sublime to elevate your Homestyle.",
    "Use Sublime to get design as unique as you.",
    "Use Sublime to make your life easy.",
    "Use Sublime to turn boring into bold.",
    "Use Sublime to turn 'meh' into 'heck yeah!'",
    "Use Sublime to tech-up your vibe.",
    "Use Sublime-because ordinary is overrated.",
    "We really hope you have a Sublime 😉 time here..."
  ];

  const typingText = document.getElementById("typingText");
  let sentenceIndex = 0;
  let charIndex = 0;
  let typing = true;

  function typeSentence() {
    if (typing) {
      if (charIndex < sentences[sentenceIndex].length) {
        typingText.textContent += sentences[sentenceIndex][charIndex];
        charIndex++;
        setTimeout(typeSentence, 70);
      } else {
        typing = false;
        setTimeout(typeSentence, 1000);
      }
    } else {
      if (charIndex > 0) {
        typingText.textContent = sentences[sentenceIndex].substring(0, charIndex - 1);
        charIndex--;
        setTimeout(typeSentence, 40);
      } else {
        typing = true;
        sentenceIndex = (sentenceIndex + 1) % sentences.length; // loop forever
        setTimeout(typeSentence, 500);
      }
    }
  }

  window.onload = typeSentence;