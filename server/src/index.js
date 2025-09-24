import express from "express";
import logger from "./logger.js";
import { fetchMandiData, toBoxPrice } from "./scraper.js";

const app = express();
// Basic CORS for local dev frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
const PORT = process.env.PORT || 4000;

app.get("/health", (_req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

// Helper to format only required fields and ensure numeric output
function formatResponse(rows) {
  return rows.map((r) => ({
    variety: r.variety,
    avgPerQuintal: r.avgPerQuintal,
    pricePerBox: r.avgPerQuintal != null ? toBoxPrice(r.avgPerQuintal) : null,
  }));
}

async function handleMandi(req, res) {
  const mandi = req.params.mandi;
  const fresh = req.query.fresh === "1" || req.query.fresh === "true";
  const mock = req.query.mock === "1" || req.query.mock === "true";
  try {
    const data = await fetchMandiData(mandi, { fresh, mock });
    res.json({
      mandi,
      fresh,
      mock,
      rows: formatResponse(data),
      updated: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err: err.message }, "failed to fetch mandi data");
    res.status(500).json({ error: "Failed to fetch data" });
  }
}

// Map user-friendly URL segments to internal mandi tokens if needed
const ALIAS = {
  shopian: "Shopian",
  sopore: "Sopore",
  srinagar: "Srinagar",
  azadpur: "Azadpur",
  mumbai: "Mumbai",
};

app.get(
  "/api/prices/:mandi",
  (req, res, next) => {
    const key = req.params.mandi.toLowerCase();
    if (!ALIAS[key]) return res.status(404).json({ error: "Unknown mandi" });
    req.params.mandi = ALIAS[key];
    next();
  },
  handleMandi
);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
});
