// admin.js — Al Fursan admin dashboard
(() => {
  const API = "/api";
  const STATUS_LABELS = {
    Pending: "قيد الانتظار",
    Confirmed: "مؤكد",
    Preparing: "قيد التحضير",
    Ready: "جاهز",
    "Out for Delivery": "في الطريق",
    Delivered: "تم التسليم",
    Cancelled: "ملغي",
  };
  const STATUSES = Object.keys(STATUS_LABELS);

  let categories = [];
  let orderStatusFilter = "";

  async function api(path, opts) {
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${API}${path}`, {
      headers: { 
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
      },
      ...opts,
    });
    if (res.status === 403) {
      localStorage.removeItem("admin_token");
      window.location.href = "/login.html";
      return;
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }
  function money(n) { return `\u2066${n} ج.م\u2069`; }
  function ltrIsolate(text) { return `\u2066${text}\u2069`; }
  function statusClass(s) { return `status-${s.replace(/ /g, "-")}`; }

  // ---------- tabs ----------
  function bindTabs() {
    document.querySelectorAll("[data-tab]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll("[data-tab]").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        document.querySelectorAll(".admin-tab").forEach((t) => (t.style.display = "none"));
        document.getElementById(`tab-${link.dataset.tab}`).style.display = "block";
        if (link.dataset.tab === "dashboard") loadDashboard();
        if (link.dataset.tab === "orders") loadOrders();
        if (link.dataset.tab === "products") loadProducts();
      });
    });
  }

  // ---------- dashboard ----------
  async function loadDashboard() {
    const [stats, orders] = await Promise.all([api("/dashboard/stats"), api("/orders")]);
    document.getElementById("stat-orders").textContent = stats.todaysOrdersCount;
    document.getElementById("stat-sales").textContent = money(stats.todaysSales);
    document.getElementById("stat-pending").textContent = stats.pendingOrders;
    document.getElementById("stat-products").textContent = stats.productsCount;

    const salesHistoryBody = document.getElementById("sales-history-body");
    const history = Array.isArray(stats.salesHistory) ? stats.salesHistory : [];
    if (history.length === 0) {
      salesHistoryBody.innerHTML = `<tr><td colspan="3" class="empty-note">لا توجد مبيعات مسجلة بعد</td></tr>`;
    } else {
      salesHistoryBody.innerHTML = history
        .slice(0, 10)
        .map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          const label = date.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
          return `
            <tr>
              <td>${label}</td>
              <td>${day.ordersCount}</td>
              <td>${money(day.total)}</td>
            </tr>`;
        })
        .join("");
    }

    const body = document.getElementById("recent-orders-body");
    const recent = orders.slice(0, 6);
    if (recent.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="empty-note">لا توجد طلبات بعد</td></tr>`;
      return;
    }
    body.innerHTML = recent
      .map(
        (o) => `
        <tr>
          <td>#${ltrIsolate(o.id)}</td>
          <td>${o.customerName}</td>
          <td>${money(o.total)}</td>
          <td><span class="status-pill ${statusClass(o.status)}">${STATUS_LABELS[o.status]}</span></td>
        </tr>`
      )
      .join("");
  }

  // ---------- orders ----------
  async function loadOrders() {
    const query = orderStatusFilter ? `?status=${encodeURIComponent(orderStatusFilter)}` : "";
    const orders = await api(`/orders${query}`);
    const body = document.getElementById("orders-body");
    if (orders.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="empty-note">لا توجد طلبات مطابقة</td></tr>`;
      return;
    }
    body.innerHTML = orders
      .map((o) => {
        const itemsSummary = o.items.map((it) => `${it.quantity}× ${it.name}`).join("، ");
        const options = STATUSES.map(
          (s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${STATUS_LABELS[s]}</option>`
        ).join("");
        return `
        <tr>
          <td>#${ltrIsolate(o.id)}</td>
          <td>${o.customerName}</td>
          <td>${ltrIsolate(o.phone)}</td>
          <td style="max-width:220px">${itemsSummary}</td>
          <td>${money(o.total)}</td>
          <td><select class="status-select" data-order-id="${o.id}">${options}</select></td>
        </tr>`;
      })
      .join("");
  }

  function bindOrderEvents() {
    document.getElementById("order-filters").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-status]");
      if (!chip) return;
      document.querySelectorAll("#order-filters .filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      orderStatusFilter = chip.dataset.status;
      loadOrders();
    });

    document.getElementById("orders-body").addEventListener("change", async (e) => {
      const select = e.target.closest("[data-order-id]");
      if (!select) return;
      await api(`/orders/${select.dataset.orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value }),
      });
      loadOrders();
    });
  }

  // ---------- products ----------
  async function loadProducts() {
    const [products, cats] = await Promise.all([api("/products"), api("/categories")]);
    categories = cats;
    document.getElementById("category-list").innerHTML = cats.map((c) => `<option value="${c.name}">`).join("");

    const body = document.getElementById("products-body");
    if (products.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="empty-note">لا توجد منتجات</td></tr>`;
      return;
    }
    body.innerHTML = products
      .map(
        (p) => `
        <tr>
          <td>${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</td>
          <td>${p.name}${p.featured ? " ⭐" : ""}</td>
          <td>${p.category}</td>
          <td>${money(p.price)}</td>
          <td>${p.available ? "✅" : "❌"}</td>
          <td>
            <button class="icon-action" data-edit="${p.id}">✏️</button>
            <button class="icon-action danger" data-delete="${p.id}">🗑️</button>
          </td>
        </tr>`
      )
      .join("");
  }

  function openProductModal(product) {
    document.getElementById("product-modal-title").textContent = product ? "تعديل منتج" : "إضافة منتج";
    document.getElementById("pf-id").value = product ? product.id : "";
    document.getElementById("pf-name").value = product ? product.name : "";
    document.getElementById("pf-description").value = product ? product.description : "";
    document.getElementById("pf-price").value = product ? product.price : "";
    document.getElementById("pf-category").value = product ? product.category : "";
    document.getElementById("pf-image").value = product ? product.image : "";
    document.getElementById("pf-available").checked = product ? product.available : true;
    document.getElementById("pf-featured").checked = product ? !!product.featured : false;
    document.getElementById("product-modal").classList.add("show");
  }
  function closeProductModal() {
    document.getElementById("product-modal").classList.remove("show");
  }

  function bindProductEvents() {
    document.getElementById("add-product-btn").addEventListener("click", () => openProductModal(null));
    document.getElementById("product-modal-cancel").addEventListener("click", closeProductModal);

    document.getElementById("products-body").addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit]");
      const delBtn = e.target.closest("[data-delete]");
      if (editBtn) {
        const product = await api(`/products/${editBtn.dataset.edit}`);
        openProductModal(product);
      }
      if (delBtn) {
        if (!confirm("هل تريد حذف هذا المنتج؟")) return;
        await api(`/products/${delBtn.dataset.delete}`, { method: "DELETE" });
        loadProducts();
      }
    });

    document.getElementById("product-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("pf-id").value;
      const payload = {
        name: document.getElementById("pf-name").value.trim(),
        description: document.getElementById("pf-description").value.trim(),
        price: Number(document.getElementById("pf-price").value),
        category: document.getElementById("pf-category").value.trim(),
        image: document.getElementById("pf-image").value.trim(),
        available: document.getElementById("pf-available").checked,
        featured: document.getElementById("pf-featured").checked,
      };
      if (id) {
        await api(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        // ensure category exists
        if (payload.category && !categories.find((c) => c.name === payload.category)) {
          await api("/categories", { method: "POST", body: JSON.stringify({ name: payload.category }) });
        }
        await api("/products", { method: "POST", body: JSON.stringify(payload) });
      }
      closeProductModal();
      loadProducts();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTabs();
    bindOrderEvents();
    bindProductEvents();
    loadDashboard();
    
    // Logout button
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (confirm("هل تريد تسجيل الخروج؟")) {
          localStorage.removeItem("admin_token");
          window.location.href = "/login.html";
        }
      });
    }
  });
})();
