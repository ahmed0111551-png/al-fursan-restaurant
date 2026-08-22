// server.js — Al Fursan Restaurant backend.
// Plain Node.js (no Express) so the project runs with zero installs:
//     node backend/server.js
// Serves the REST API under /api/* and the static frontend from /public.

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const db = require("./db");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Ahmed";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ahmed010";
const DELIVERY_FEE = 20;

// Simple token storage (in-memory for demo)
const validTokens = new Set();

// ---------- helpers ----------

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 — الصفحة غير موجودة");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

// ---------- route handlers ----------

async function handleApi(req, res, pathname, query) {
  const segments = pathname.split("/").filter(Boolean); // ["api","products",":id"]
  const resource = segments[1];
  const id = segments[2];
  const sub = segments[3];

  try {
    // ----- AUTHENTICATION -----
    if (resource === "auth" && req.method === "POST") {
      const body = await readBody(req);
      if (body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD) {
        const token = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        validTokens.add(token);
        // Token expires after 24 hours
        setTimeout(() => validTokens.delete(token), 24 * 60 * 60 * 1000);
        return sendJSON(res, 200, { success: true, token });
      }
      return sendJSON(res, 401, { error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Check which actions require admin auth.
    // Public checkout orders should be allowed without a token, while product/category
    // administration and order status changes remain protected.
    const requiresAdminAuth =
      (["products", "categories"].includes(resource) &&
        (req.method === "POST" || req.method === "PUT" || req.method === "DELETE" || req.method === "PATCH")) ||
      (resource === "orders" && (req.method === "PATCH" || req.method === "DELETE"));

    if (requiresAdminAuth) {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token || !validTokens.has(token)) {
        return sendJSON(res, 403, { error: "غير مصرح. يرجى تسجيل الدخول" });
      }
    }

    // ----- PRODUCTS -----
    if (resource === "products") {
      if (req.method === "GET" && !id) {
        let products = db.readAll("products");
        if (query.category && query.category !== "الكل") {
          products = products.filter((p) => p.category === query.category);
        }
        if (query.search) {
          const q = query.search.trim().toLowerCase();
          products = products.filter((p) => p.name.toLowerCase().includes(q));
        }
        if (query.featured === "true") {
          products = products.filter((p) => p.featured);
        }
        return sendJSON(res, 200, products);
      }
      if (req.method === "GET" && id) {
        const product = db.findById("products", id);
        if (!product) return sendJSON(res, 404, { error: "المنتج غير موجود" });
        return sendJSON(res, 200, product);
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (!body.name || body.price == null) {
          return sendJSON(res, 400, { error: "الاسم والسعر مطلوبان" });
        }
        const product = {
          id: db.nextId("p"),
          name: body.name,
          description: body.description || "",
          price: Number(body.price),
          image: body.image || "",
          category: body.category || "",
          available: body.available !== false,
          featured: !!body.featured,
          createdAt: new Date().toISOString(),
        };
        db.insert("products", product);
        return sendJSON(res, 201, product);
      }
      if (req.method === "PUT" && id) {
        const body = await readBody(req);
        const updated = db.update("products", id, body);
        if (!updated) return sendJSON(res, 404, { error: "المنتج غير موجود" });
        return sendJSON(res, 200, updated);
      }
      if (req.method === "DELETE" && id) {
        const ok = db.remove("products", id);
        if (!ok) return sendJSON(res, 404, { error: "المنتج غير موجود" });
        return sendJSON(res, 200, { success: true });
      }
    }

    // ----- CATEGORIES -----
    if (resource === "categories") {
      if (req.method === "GET") {
        return sendJSON(res, 200, db.readAll("categories"));
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (!body.name) return sendJSON(res, 400, { error: "اسم التصنيف مطلوب" });
        const category = { id: db.nextId("c"), name: body.name };
        db.insert("categories", category);
        return sendJSON(res, 201, category);
      }
    }

    // ----- ORDERS -----
    if (resource === "orders") {
      if (req.method === "GET" && !id) {
        let orders = db.readAll("orders").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (query.status) orders = orders.filter((o) => o.status === query.status);
        return sendJSON(res, 200, orders);
      }
      if (req.method === "GET" && id) {
        const order = db.findById("orders", id);
        if (!order) return sendJSON(res, 404, { error: "الطلب غير موجود" });
        return sendJSON(res, 200, order);
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (!body.customerName || !body.phone || !Array.isArray(body.items) || body.items.length === 0) {
          return sendJSON(res, 400, { error: "بيانات الطلب غير مكتملة" });
        }
        const subtotal = body.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        const deliveryFee = body.fulfillment === "delivery" ? DELIVERY_FEE : 0;
        const order = {
          id: db.nextId("o"),
          customerName: body.customerName,
          phone: body.phone,
          address: body.address || "",
          fulfillment: body.fulfillment || "delivery",
          items: body.items,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          status: "Pending",
          createdAt: new Date().toISOString(),
        };
        db.insert("orders", order);
        return sendJSON(res, 201, order);
      }
      if (req.method === "PATCH" && id && sub === "status") {
        const body = await readBody(req);
        const validStatuses = ["Pending", "Confirmed", "Preparing", "Ready", "Out for Delivery", "Delivered", "Cancelled"];
        if (!validStatuses.includes(body.status)) {
          return sendJSON(res, 400, { error: "حالة غير صحيحة" });
        }
        const updated = db.update("orders", id, { status: body.status });
        if (!updated) return sendJSON(res, 404, { error: "الطلب غير موجود" });
        return sendJSON(res, 200, updated);
      }
      if (req.method === "DELETE" && id) {
        const ok = db.remove("orders", id);
        if (!ok) return sendJSON(res, 404, { error: "الطلب غير موجود" });
        return sendJSON(res, 200, { success: true });
      }
    }

    // ----- DASHBOARD -----
    if (resource === "dashboard" && id === "stats") {
      const orders = db.readAll("orders");
      const products = db.readAll("products");
      const salesHistory = db.buildSalesHistory();
      const today = new Date().toDateString();
      const todaysOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
      return sendJSON(res, 200, {
        todaysOrdersCount: todaysOrders.length,
        todaysSales: todaysOrders.reduce((sum, o) => sum + o.total, 0),
        pendingOrders: orders.filter((o) => o.status === "Pending").length,
        productsCount: products.length,
        salesHistory,
      });
    }

    return sendJSON(res, 404, { error: "Endpoint غير موجود" });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: "خطأ في الخادم" });
  }
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname, parsed.query);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`🛡️  Al Fursan server running → http://localhost:${PORT}`);
  console.log(`   Admin dashboard        → http://localhost:${PORT}/admin.html`);
  
  // Check if orders need to be archived (new day)
  db.archiveOrdersIfMidnight();
  
  // Check every minute if we need to archive (in case server runs 24/7)
  setInterval(() => {
    db.archiveOrdersIfMidnight();
  }, 60000); // Check every 60 seconds
});
