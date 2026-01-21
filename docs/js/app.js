/* =========================================================
   SNOW MARKET APP.JS
   Premium JS for add-to-cart + dynamic UI
   ========================================================= */

// Initialize cart from localStorage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Save cart to localStorage
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Add item to cart
function addToCart(product) {
    // Prefer centralized cart handler if available
    if (window.addToCart) {
        window.addToCart({
            id: product.id,
            title: product.title || product.name,
            price: product.price,
            imageURL: product.img || product.image || product.imageURL
        });
        return;
    }

    // Fallback (legacy) behavior
    let exists = cart.find(item => item.id === product.id);

    if (exists) {
        exists.quantity = (exists.quantity || exists.qty || 0) + 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart();
    showToast((product.title || product.name) + " added to cart");
}

// Event listener for all product buttons
document.addEventListener("click", function (e) {
    if (e.target.classList.contains("btn")) {

        // Extract product from card
        let card = e.target.closest(".product-card");

        let product = {
            id: card.getAttribute("data-id") || card.querySelector("h3").innerText.replace("Product ", ""),
            title: card.querySelector("h3").innerText,
            price: parseFloat(card.querySelector(".price").innerText.replace(/[^0-9.-]+/g, "")) || 0,
            imageURL: card.querySelector("img").src
        };

        addToCart(product);
    }
});

// Toast message
function showToast(message) {
    let toast = document.createElement("div");
    toast.className = "toast-message";
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    }, 100);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-20px)";
    }, 2500);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Inject toast CSS
const toastStyle = document.createElement("style");
toastStyle.innerHTML = `
.toast-message {
  position: fixed;
  top: 25px;
  right: 25px;
  background: teal;
  color: #fff;
  padding: 15px 25px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  opacity: 0;
  transform: translateY(-20px);
  transition: 0.4s ease;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}`;
document.head.appendChild(toastStyle);

// Mobile Menu Toggle
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("show-nav");
  });
}



// Update cart count from localStorage (prefer global implementation if present)
function updateCartCountLocal() {
    // prefer the central cart module's updater if present
    if (window.updateCartCount && window.updateCartCount !== updateCartCountLocal) {
        try { window.updateCartCount(); return; } catch(e) { /* fallback below */ }
    }

    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    let count = cart.reduce((sum, item) => {
        return sum + (Number(item.quantity) || Number(item.qty) || 0);
    }, 0);

    const cartCount = document.getElementById("cartCount") || document.getElementById("cart-count");
    const cartLink = document.getElementById('cart-link');
    if (cartCount) {
        if (count > 0) {
            cartCount.textContent = count;
            cartCount.style.display = 'inline-block';
            cartCount.setAttribute('aria-hidden', 'false');
        } else {
            cartCount.textContent = '';
            cartCount.style.display = 'none';
            cartCount.setAttribute('aria-hidden', 'true');
        }
    }
    if (cartLink) {
        const aria = count > 0 ? `View cart (${count} item${count === 1 ? '' : 's'})` : 'View cart';
        cartLink.setAttribute('aria-label', aria);
        cartLink.setAttribute('title', aria);
    }
}

// expose unified updateCartCount to window (if not already set by cart module)
window.updateCartCount = window.updateCartCount || updateCartCountLocal;

updateCartCountLocal();
