// app.js — Al Fursan Restaurant storefront
(() => {
  const API = "/api";
  const WHATSAPP_NUMBER = "201212315585"; // 01212315585 in international format
  const DELIVERY_FEE = 20;

  const state = {
    products: [],
    categories: [],
    activeCategory: "الكل",
    searchTerm: "",
    cart: loadCart(),
    activeProduct: null,
  };

  // ---------- cart persistence (in-memory app state; localStorage for continuity) ----------
  function loadCart() {
    try {
      const raw = localStorage.getItem("alfursan_cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem("alfursan_cart", JSON.stringify(state.cart));
    renderCartCount();
  }

  // ---------- fetch helpers ----------
  async function api(path, opts) {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  // ---------- init ----------
  async function init() {
    bindStaticEvents();
    renderCartCount();
    try {
      const [products, categories] = await Promise.all([
        api("/products"),
        api("/categories"),
      ]);
      state.products = products;
      state.categories = categories;
      renderCategoryChips();
      renderFeatured();
      renderMenu();
    } catch (err) {
      console.error(err);
      document.getElementById("menu-grid").innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft)">تعذر تحميل المنيو حاليًا، حاول تحديث الصفحة.</p>';
    }
  }

  // ---------- rendering ----------
  function money(n) {
    // Isolate the number+currency chunk so it can't get reordered when
    // sitting inside Arabic (RTL) text — common cause of "85 ج.م" jumbling.
    return `\u2066${n} ج.م\u2069`;
  }
  function ltrIsolate(text) {
    return `\u2066${text}\u2069`;
  }

  function productCard(p) {
    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-thumb">
          ${p.featured ? '<span class="badge-shield">الأكثر طلبًا</span>' : ""}
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </div>
        <div class="product-body">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <div class="product-foot">
            <span class="price">${money(p.price)}</span>
            <button class="add-btn" aria-label="أضف ${p.name} للسلة" data-quick-add="${p.id}">+</button>
          </div>
        </div>
      </article>`;
  }

  function renderFeatured() {
    const wrap = document.getElementById("featured-grid");
    const featured = state.products.filter((p) => p.featured).slice(0, 8);
    wrap.innerHTML = featured.map(productCard).join("");
  }

  function renderCategoryChips() {
    const names = ["الكل", ...state.categories.map((c) => c.name)];
    const wrap = document.getElementById("cat-scroller");
    wrap.innerHTML = names
      .map(
        (name) =>
          `<button class="cat-chip ${name === state.activeCategory ? "active" : ""}" data-cat="${name}">${name}</button>`
      )
      .join("");
  }

  function renderMenu() {
    const grid = document.getElementById("menu-grid");
    let list = state.products;
    if (state.activeCategory !== "الكل") {
      list = list.filter((p) => p.category === state.activeCategory);
    }
    if (state.searchTerm.trim()) {
      const q = state.searchTerm.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (list.length === 0) {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft)">لا توجد نتائج مطابقة.</p>';
      return;
    }
    grid.innerHTML = list.map(productCard).join("");
  }

  function renderCartCount() {
    const count = state.cart.reduce((sum, l) => sum + l.quantity, 0);
    document.querySelectorAll(".cart-count").forEach((el) => {
      el.textContent = count;
      el.style.display = count > 0 ? "flex" : "none";
    });
  }

  function cartSubtotal() {
    return state.cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  }

  function renderCartDrawer() {
    const body = document.getElementById("cart-body");
    const foot = document.getElementById("cart-foot");
    if (state.cart.length === 0) {
      body.innerHTML = '<div class="cart-empty">🛒<br>سلتك فارغة، ابدأ بإضافة وجبتك المفضلة!</div>';
      foot.innerHTML = "";
      return;
    }
    body.innerHTML = state.cart
      .map(
        (line, idx) => `
        <div class="cart-line">
          <img src="${line.image}" alt="${line.name}">
          <div class="cart-line-info">
            <h4>${line.name}</h4>
            ${line.variant ? `<div style="font-size:0.78rem;color:var(--ink-soft)">${line.variant}</div>` : ""}
            <div class="price">${money(line.price)}</div>
            <div class="qty-control">
              <button data-cart-dec="${idx}">−</button>
              <span>${line.quantity}</span>
              <button data-cart-inc="${idx}">+</button>
              <button data-cart-remove="${idx}" style="margin-inline-start:auto;color:var(--crimson);border:none;background:none;font-size:0.8rem;">إزالة</button>
            </div>
          </div>
        </div>`
      )
      .join("");

    const subtotal = cartSubtotal();
    foot.innerHTML = `
      <div class="cart-summary-row"><span>الإجمالي الفرعي</span><span>${money(subtotal)}</span></div>
      <div class="cart-summary-total"><span>الإجمالي</span><span>${money(subtotal)}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" id="go-checkout">إتمام الطلب</button>
    `;
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ---------- cart actions ----------
  function addToCart(product, quantity = 1, variant = null, extraPrice = 0) {
    const key = `${product.id}::${variant || ""}`;
    const existing = state.cart.find((l) => l.key === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.cart.push({
        key,
        id: product.id,
        name: product.name,
        image: product.image,
        price: product.price + extraPrice,
        quantity,
        variant,
      });
    }
    saveCart();
    showToast("تمت إضافة المنتج إلى السلة ✅");
  }

  function changeQty(idx, delta) {
    const line = state.cart[idx];
    if (!line) return;
    line.quantity += delta;
    if (line.quantity <= 0) state.cart.splice(idx, 1);
    saveCart();
    renderCartDrawer();
  }

  function removeLine(idx) {
    state.cart.splice(idx, 1);
    saveCart();
    renderCartDrawer();
  }

  // ---------- product detail modal ----------
  function openProductModal(product) {
    state.activeProduct = { product, size: "عادي", extras: [], qty: 1 };
    const modal = document.getElementById("pd-modal");
    document.getElementById("pd-image").src = product.image;
    document.getElementById("pd-image").alt = product.name;
    document.getElementById("pd-name").textContent = product.name;
    document.getElementById("pd-desc").textContent = product.description;
    document.getElementById("pd-qty").textContent = "1";
    updatePdPrice();
    renderPdChips();
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function renderPdChips() {
    const sizeRow = document.getElementById("pd-size-row");
    const sizes = [
      { name: "صغير", extra: -10 },
      { name: "عادي", extra: 0 },
      { name: "كبير", extra: 15 },
    ];
    sizeRow.innerHTML = sizes
      .map(
        (s) => `<button class="pd-chip ${state.activeProduct.size === s.name ? "selected" : ""}" data-size="${s.name}" data-extra="${s.extra}">${s.name}</button>`
      )
      .join("");

    const extrasRow = document.getElementById("pd-extras-row");
    const extras = ["جبنة إضافية", "صوص إضافي", "بطاطس إضافية"];
    extrasRow.innerHTML = extras
      .map(
        (e) =>
          `<button class="pd-chip ${state.activeProduct.extras.includes(e) ? "selected" : ""}" data-extra-toggle="${e}">${e}</button>`
      )
      .join("");
  }

  function updatePdPrice() {
    const ap = state.activeProduct;
    if (!ap) return;
    const sizeExtra = { "صغير": -10, "عادي": 0, "كبير": 15 }[ap.size] || 0;
    const extrasExtra = ap.extras.length * 10;
    const unit = ap.product.price + sizeExtra + extrasExtra;
    document.getElementById("pd-price").textContent = money(unit * ap.qty);
  }

  function closeProductModal() {
    document.getElementById("pd-modal").classList.remove("show");
    document.body.style.overflow = "";
  }

  // ---------- checkout ----------
  function openCheckout() {
    if (state.cart.length === 0) {
      showToast("السلة فارغة");
      return;
    }
    closeDrawer("cart");
    document.getElementById("co-subtotal").textContent = money(cartSubtotal());
    updateCheckoutTotal();
    document.getElementById("checkout-overlay").classList.add("show");
    document.getElementById("checkout-drawer").classList.add("show");
  }

  function updateCheckoutTotal() {
    const fulfillment = document.querySelector('input[name="fulfillment"]:checked').value;
    const fee = fulfillment === "delivery" ? DELIVERY_FEE : 0;
    const subtotal = cartSubtotal();
    document.getElementById("co-fee").textContent = fee ? money(fee) : "مجانًا";
    document.getElementById("co-total").textContent = money(subtotal + fee);
    document.getElementById("address-field").style.display = fulfillment === "delivery" ? "block" : "none";
  }

  function buildWhatsAppMessage(order) {
    const lines = order.items
      .map((it) => `${ltrIsolate(it.quantity + " ×")} ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
      .join("\n");
    const msg = [
      "طلب جديد من موقع مطعم الفرسان",
      "",
      `الاسم: ${order.customerName}`,
      `الهاتف: ${ltrIsolate(order.phone)}`,
      order.fulfillment === "delivery" ? `العنوان: ${order.address}` : "الاستلام: من المطعم",
      "",
      lines,
      "",
      `الإجمالي: ${money(order.total)}`,
    ].join("\n");
    return msg;
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    const fulfillment = form.fulfillment.value;
    const payload = {
      customerName: form.customerName.value.trim(),
      phone: form.phone.value.trim(),
      address: fulfillment === "delivery" ? form.address.value.trim() : "",
      fulfillment,
      items: state.cart.map((l) => ({
        name: l.name,
        price: l.price,
        quantity: l.quantity,
        variant: l.variant,
      })),
    };
    if (!payload.customerName || !payload.phone) {
      showToast("من فضلك أدخل الاسم ورقم الهاتف");
      return;
    }
    if (fulfillment === "delivery" && !payload.address) {
      showToast("من فضلك أدخل العنوان");
      return;
    }

    const submitBtn = document.getElementById("submit-order-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري إرسال الطلب...";

    try {
      const order = await api("/orders", { method: "POST", body: JSON.stringify(payload) });
      state.cart = [];
      saveCart();
      closeDrawer("checkout");
      showOrderSuccess(order);
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ، حاول مرة أخرى");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "تأكيد الطلب";
    }
  }

  function showOrderSuccess(order) {
    const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`;
    document.getElementById("success-order-id").textContent = ltrIsolate(order.id);
    document.getElementById("wa-order-link").href = wa;
    document.getElementById("success-overlay").classList.add("show");
    document.getElementById("success-modal").classList.add("show");
  }

  // ---------- drawers ----------
  function openDrawer(name) {
    document.getElementById(`${name}-overlay`).classList.add("show");
    document.getElementById(`${name}-drawer`).classList.add("show");
    if (name === "cart") renderCartDrawer();
  }
  function closeDrawer(name) {
    document.getElementById(`${name}-overlay`).classList.remove("show");
    document.getElementById(`${name}-drawer`).classList.remove("show");
  }

  // ---------- event binding ----------
  function bindStaticEvents() {
    document.querySelectorAll("[data-open-cart]").forEach((el) =>
      el.addEventListener("click", () => openDrawer("cart"))
    );
    document.querySelectorAll("[data-close-cart]").forEach((el) =>
      el.addEventListener("click", () => closeDrawer("cart"))
    );
    document.querySelectorAll("[data-close-checkout]").forEach((el) =>
      el.addEventListener("click", () => closeDrawer("checkout"))
    );

    document.getElementById("cart-body").addEventListener("click", (e) => {
      const inc = e.target.closest("[data-cart-inc]");
      const dec = e.target.closest("[data-cart-dec]");
      const rem = e.target.closest("[data-cart-remove]");
      if (inc) changeQty(Number(inc.dataset.cartInc), 1);
      if (dec) changeQty(Number(dec.dataset.cartDec), -1);
      if (rem) removeLine(Number(rem.dataset.cartRemove));
    });

    document.getElementById("cart-foot").addEventListener("click", (e) => {
      if (e.target.id === "go-checkout") openCheckout();
    });

    document.getElementById("cat-scroller").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (!chip) return;
      state.activeCategory = chip.dataset.cat;
      renderCategoryChips();
      renderMenu();
      document.getElementById("menu").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("menu-search").addEventListener("input", (e) => {
      state.searchTerm = e.target.value;
      renderMenu();
    });

    // delegated quick-add + open product modal
    document.addEventListener("click", (e) => {
      const quickAdd = e.target.closest("[data-quick-add]");
      if (quickAdd) {
        e.stopPropagation();
        const product = state.products.find((p) => p.id === quickAdd.dataset.quickAdd);
        if (product) addToCart(product, 1);
        return;
      }
      const card = e.target.closest(".product-card");
      if (card) {
        const product = state.products.find((p) => p.id === card.dataset.id);
        if (product) openProductModal(product);
      }
    });

    document.getElementById("pd-close").addEventListener("click", closeProductModal);
    document.getElementById("pd-modal").addEventListener("click", (e) => {
      if (e.target.id === "pd-modal") closeProductModal();
    });

    document.getElementById("pd-size-row").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-size]");
      if (!chip) return;
      state.activeProduct.size = chip.dataset.size;
      renderPdChips();
      updatePdPrice();
    });

    document.getElementById("pd-extras-row").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-extra-toggle]");
      if (!chip) return;
      const name = chip.dataset.extraToggle;
      const idx = state.activeProduct.extras.indexOf(name);
      if (idx === -1) state.activeProduct.extras.push(name);
      else state.activeProduct.extras.splice(idx, 1);
      renderPdChips();
      updatePdPrice();
    });

    document.getElementById("pd-qty-minus").addEventListener("click", () => {
      const ap = state.activeProduct;
      ap.qty = Math.max(1, ap.qty - 1);
      document.getElementById("pd-qty").textContent = ap.qty;
      updatePdPrice();
    });
    document.getElementById("pd-qty-plus").addEventListener("click", () => {
      const ap = state.activeProduct;
      ap.qty += 1;
      document.getElementById("pd-qty").textContent = ap.qty;
      updatePdPrice();
    });

    document.getElementById("pd-add-btn").addEventListener("click", () => {
      const ap = state.activeProduct;
      const sizeExtra = { "صغير": -10, "عادي": 0, "كبير": 15 }[ap.size] || 0;
      const extrasExtra = ap.extras.length * 10;
      const variantParts = [];
      if (ap.size !== "عادي") variantParts.push(ap.size);
      if (ap.extras.length) variantParts.push(ap.extras.join("، "));
      addToCart(ap.product, ap.qty, variantParts.join(" + ") || null, sizeExtra + extrasExtra);
      closeProductModal();
    });

    document.querySelectorAll('input[name="fulfillment"]').forEach((r) =>
      r.addEventListener("change", () => {
        document.querySelectorAll(".radio-card").forEach((c) => c.classList.remove("selected"));
        r.closest(".radio-card").classList.add("selected");
        updateCheckoutTotal();
      })
    );

    document.getElementById("checkout-form").addEventListener("submit", submitOrder);

    document.getElementById("success-close").addEventListener("click", () => {
      document.getElementById("success-overlay").classList.remove("show");
      document.getElementById("success-modal").classList.remove("show");
    });

    // mobile menu toggle
    const mobileToggle = document.getElementById("mobile-menu-toggle");
    if (mobileToggle) {
      mobileToggle.addEventListener("click", () => openDrawer("menu-nav"));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
