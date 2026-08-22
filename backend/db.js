// db.js — lightweight JSON-file "database" layer.
// Swap this for a real database (MongoDB/Postgres/etc.) later without
// touching the routes: just keep the same function signatures.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readAll(collection) {
  const raw = fs.readFileSync(filePath(collection), "utf-8");
  return JSON.parse(raw || "[]");
}

function writeAll(collection, data) {
  fs.writeFileSync(filePath(collection), JSON.stringify(data, null, 2), "utf-8");
}

function findById(collection, id) {
  return readAll(collection).find((item) => item.id === id) || null;
}

function insert(collection, item) {
  const all = readAll(collection);
  all.push(item);
  writeAll(collection, all);
  return item;
}

function update(collection, id, patch) {
  const all = readAll(collection);
  const idx = all.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll(collection, all);
  return all[idx];
}

function remove(collection, id) {
  const all = readAll(collection);
  const next = all.filter((item) => item.id !== id);
  if (next.length === all.length) return false;
  writeAll(collection, next);
  return true;
}

function nextId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

function formatDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readAllOrdersWithArchive() {
  const current = readAll("orders");
  const files = fs.readdirSync(DATA_DIR)
    .filter((name) => /^orders-archive-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse();

  const archived = files.flatMap((fileName) => {
    const filePath = path.join(DATA_DIR, fileName);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  return [...archived, ...current];
}

function buildSalesHistory() {
  const historyMap = new Map();

  for (const order of readAllOrdersWithArchive()) {
    if (!order || !order.createdAt || typeof order.total !== "number") continue;
    const key = formatDateKey(order.createdAt);
    if (!historyMap.has(key)) {
      historyMap.set(key, { date: key, total: 0, ordersCount: 0 });
    }
    const item = historyMap.get(key);
    item.total += Number(order.total) || 0;
    item.ordersCount += 1;
  }

  return [...historyMap.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => ({
      ...item,
      total: Number(item.total.toFixed(2)),
    }));
}

// Archive orders at midnight
function archiveOrdersIfMidnight() {
  const archiveMarkerFile = path.join(DATA_DIR, ".last-archive-date");
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  let lastArchiveDate = "";
  try {
    lastArchiveDate = fs.readFileSync(archiveMarkerFile, "utf-8").trim();
  } catch {
    lastArchiveDate = "";
  }

  // Only archive if the date has changed (new day)
  if (lastArchiveDate !== today) {
    const orders = readAll("orders");
    if (orders.length > 0) {
      const archiveDate = new Date().toISOString().split("T")[0];
      const archiveFileName = `orders-archive-${archiveDate}.json`;
      const archiveFilePath = path.join(DATA_DIR, archiveFileName);
      fs.writeFileSync(archiveFilePath, JSON.stringify(orders, null, 2), "utf-8");
      console.log(`✅ Orders archived to ${archiveFileName}`);
    }
    // Reset orders.json to empty array
    writeAll("orders", []);
    fs.writeFileSync(archiveMarkerFile, today, "utf-8");
    console.log(`🔄 Orders reset for new day: ${today}`);
  }
}

module.exports = {
  readAll,
  writeAll,
  findById,
  insert,
  update,
  remove,
  nextId,
  readAllOrdersWithArchive,
  buildSalesHistory,
  archiveOrdersIfMidnight,
};
