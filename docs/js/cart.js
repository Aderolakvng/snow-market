// cart.js — FULLY WORKING CART RENDER

function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

const IS_PAGES = location.pathname.includes('/pages/');
const PLACEHOLDER = IS_PAGES ? '../images/products/placeholder.svg' : 'images/products/placeholder.svg';

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// Add a normalized addToCart function available globally
function addToCart(product) {
  const cart = getCart();
  const id = String(product.id);

  // try to find existing by id (loose equality to handle string/number)
  let exists = cart.find(p => p.id == id);

  if (exists) {
    exists.quantity = (exists.quantity || exists.qty || 0) + 1;
  } else {
    const normalized = {
      id: String(product.id),
      title: product.title || product.name || product.name || "",
      price: Number(product.price) || 0,
      imageURL: (product.imageURL || product.img || product.image) ? String(product.imageURL || product.img || product.image) : PLACEHOLDER,
      quantity: product.quantity || product.qty || 1
    };

    cart.push(normalized);
  }

  saveCart(cart);
  renderCart();
  updateCartCount();

  // ensure badge updates even if header is injected slightly later
  setTimeout(() => { try { updateCartCount(); } catch(e) {} }, 120);

  // pulse the badge to give feedback when item added
  setTimeout(() => {
    try {
      const b = document.getElementById('cartCount');
      if (b) {
        b.classList.remove('pulse');
        // force reflow then add
        void b.offsetWidth;
        b.classList.add('pulse');
      }
    } catch(e) {}
  }, 60);

  if (window.showToast) {
    window.showToast((product.title || product.name || "Item") + " added to cart");
  }
}

window.addToCart = addToCart;

// Migrate/normalize existing cart entries in localStorage
function migrateCart() {
  let cart = getCart();
  let changed = false;
  cart = cart.map(item => {
    const normalized = { ...item };
    // unify quantity field
    if (normalized.qty && !normalized.quantity) {
      normalized.quantity = Number(normalized.qty) || 0;
      delete normalized.qty;
      changed = true;
    }
    if (normalized.quantity && typeof normalized.quantity !== 'number') {
      normalized.quantity = Number(normalized.quantity) || 0;
      changed = true;
    }
    // ensure price is number
    if (normalized.price && typeof normalized.price !== 'number') {
      normalized.price = Number(normalized.price) || 0;
      changed = true;
    }
    // ensure imageURL exists
    if (!normalized.imageURL) {
      normalized.imageURL = normalized.img || normalized.image || 'images/products/placeholder.svg';
      changed = true;
    } else {
      // If imageURL is a bare filename (e.g. 'jacket.jpg') or not in images/products,
      // prefer the local placeholder to avoid missing-file 404s in the UI.
      const val = String(normalized.imageURL || '').trim();
      const isRemote = /^(https?:)?\/\//i.test(val);
      const looksLikeLocalFile = /\.(jpg|jpeg|png|gif|webp)$/i.test(val);
      if (!isRemote && looksLikeLocalFile && !/images\/products\//.test(val)) {
        normalized.imageURL = 'images/products/placeholder.svg';
        changed = true;
      }
    }
    return normalized;
  });

  if (changed) {
    saveCart(cart);
  }
}

migrateCart();

function renderCart() {
  const cart = getCart();
  const tbody = document.getElementById("cart-table-body");
  const totalPriceEl = document.getElementById("cart-total-price");

  if (!tbody) return;

  tbody.innerHTML = "";
  let grandTotal = 0;

  if (cart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px;">
          Your cart is empty
        </td>
      </tr>
    `;
    totalPriceEl.textContent = "₦0.00";
    return;
  }

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    grandTotal += itemTotal;

    tbody.innerHTML += `
      <tr>
        <td><img src="${item.imageURL}" class="cart-item-img" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"></td>
        <td>${item.title}</td>
        <td>₦${item.price.toFixed(2)}</td>
        <td>${item.quantity}</td>
        <td>
          <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
        </td>
        <td>₦${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });

  totalPriceEl.textContent = `₦${grandTotal.toFixed(2)}`;
}

function removeItem(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, i) => {
    return sum + (i.quantity || i.qty || 0);
  }, 0);
  const badge = document.getElementById("cartCount") || document.getElementById("cart-count");
  const cartLink = document.getElementById('cart-link');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
      badge.setAttribute('aria-hidden', 'false');
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
      badge.setAttribute('aria-hidden', 'true');
    }
  }
  if (cartLink) {
    const aria = count > 0 ? `View cart (${count} item${count === 1 ? '' : 's'})` : 'View cart';
    cartLink.setAttribute('aria-label', aria);
    cartLink.setAttribute('title', aria);
  }
}

renderCart();
updateCartCount();

// expose updateCartCount globally so injected header and other scripts can call it
window.updateCartCount = updateCartCount;

// expose remove
window.removeItem = removeItem;

// Checkout functionality
document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('.checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
});

async function handleCheckout() {
  const cart = getCart();

  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  window.location.href = 'checkout.html';
}
