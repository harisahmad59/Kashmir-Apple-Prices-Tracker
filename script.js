const mobileToggle = document.querySelector(".mobile-toggle");
const menu = document.getElementById("primary-menu");
const header = document.querySelector(".site-header");

if (mobileToggle && menu && !menu.children.length) {
  mobileToggle.style.display = "none";
}

let lastScrollY = window.scrollY;

function setScrollShadow() {
  if (!header) return;
  if (window.scrollY > 4) {
    header.classList.add("is-scrolled");
  } else {
    header.classList.remove("is-scrolled");
  }
}

function updateHeaderVisibility() {
  if (!header) return;
  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;
  const menuOpen = menu?.classList.contains("open");

  if (menuOpen || currentY < 20) {
    header.classList.remove("header-hidden");
    lastScrollY = currentY;
    return;
  }

  if (delta > 6 && currentY > 110) {
    header.classList.add("header-hidden");
  } else if (delta < -6) {
    header.classList.remove("header-hidden");
  }

  lastScrollY = currentY;
}

function onScrollHeader() {
  setScrollShadow();
  updateHeaderVisibility();
}

window.addEventListener("scroll", onScrollHeader, { passive: true });
setScrollShadow();
updateHeaderVisibility();

if (mobileToggle && menu) {
  mobileToggle.addEventListener("click", () => {
    const expanded = mobileToggle.getAttribute("aria-expanded") === "true";
    mobileToggle.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("open");
    document.body.classList.toggle("menu-open", !expanded);
  });
}

// Active state simulation
menu?.addEventListener("click", (e) => {
  const link = e.target.closest("a.nav-link");
  if (!link) return;
  menu
    .querySelectorAll(".nav-link.active")
    .forEach((a) => a.classList.remove("active"));
  link.classList.add("active");
  if (window.innerWidth < 940) {
    mobileToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  }
});

// Close menu on resize up
window.addEventListener("resize", () => {
  if (window.innerWidth >= 940 && menu.classList.contains("open")) {
    mobileToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  }
});

// Close menu when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth >= 940) return;
  if (!menu.classList.contains("open")) return;
  if (e.target.closest(".nav-bar")) return; // inside
  mobileToggle.setAttribute("aria-expanded", "false");
  menu.classList.remove("open");
  document.body.classList.remove("menu-open");
});

// Variety bar sizing
function updateVarietyBars() {
  document.querySelectorAll(".variety-bar").forEach((bar) => {
    const up = parseFloat(bar.getAttribute("data-up")) || 0;
    const down = parseFloat(bar.getAttribute("data-down")) || 0;
    const total = up + down || 1;
    const upPct = (up / total) * 100;
    const downPct = 100 - upPct;
    const [upSeg, downSeg] = bar.querySelectorAll(".seg");
    if (upSeg) upSeg.style.width = upPct + "%";
    if (downSeg) downSeg.style.width = downPct + "%";
  });
}
updateVarietyBars();

// -------- Live Mandi Prices Integration --------
const MANDI_SECTIONS = [
  { id: "shopian-mandi", api: "shopian" },
  { id: "sopore-mandi", api: "sopore" },
  { id: "delhi-mandi", api: "azadpur" },
  { id: "mumbai-mandi", api: "mumbai" },
];

function setCardLoading(card) {
  card.classList.add("loading");
  const priceEl = card.querySelector(".price");
  const changeEl = card.querySelector(".change");
  // Store original static content only once so we can restore on failure
  if (!card.dataset.originalPrice && priceEl) {
    card.dataset.originalPrice = priceEl.textContent.trim();
  }
  if (!card.dataset.originalChange && changeEl) {
    card.dataset.originalChange = changeEl.textContent.trim();
  }
  if (priceEl) priceEl.textContent = "Loading…";
  if (changeEl) changeEl.textContent = "";
}

function buildSparkSeries(currentPrice, seedText, days = 6) {
  let seed = 0;
  for (const c of seedText) seed = (seed * 31 + c.charCodeAt(0)) % 1000003;
  let p = Math.max(100, Number(currentPrice) || 1000);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    if (i !== 0) {
      const drift = ((seed % 17) - 8) / 300;
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const noise = ((seed % 1000) / 1000 - 0.5) * 0.02;
      p = Math.max(100, Math.round(p * (1 + drift + noise)));
    }
    out.push(i === 0 ? Number(currentPrice) : p);
  }
  return out;
}

function renderCardSparkline(card, price, seedText) {
  const spark = card.querySelector(".sparkline");
  if (!spark) return;
  const values = buildSparkSeries(price, seedText, 6);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const w = 72;
  const h = 24;
  const padX = 4;
  const padY = 3;

  const points = values.map((v, i) => {
    const x = padX + (i * (w - padX * 2)) / (values.length - 1);
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    return [x, y];
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${(w - padX).toFixed(2)} ${(h - padY).toFixed(2)} ` +
    `L ${padX.toFixed(2)} ${(h - padY).toFixed(2)} Z`;

  const up = values[values.length - 1] >= values[values.length - 2];
  const stroke = up ? "#0f766e" : "#dc2626";
  const gradA = up ? "rgba(15,118,110,0.22)" : "rgba(220,38,38,0.20)";
  const gradB = "rgba(255,255,255,0)";
  spark.classList.toggle("up", up);
  spark.classList.toggle("down", !up);
  spark.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="spark-grad-${seedText.replace(/[^a-z0-9]/gi, "").slice(0, 12)}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${gradA}"/>
        <stop offset="100%" stop-color="${gradB}"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#spark-grad-${seedText.replace(/[^a-z0-9]/gi, "").slice(0, 12)})"></path>
    <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

function updateMandiSection(sectionEl, rows) {
  const cards = sectionEl.querySelectorAll(".stock-card");
  const map = {};
  rows.forEach((r) => {
    map[r.variety.toLowerCase()] = r;
  });
  // Persist the entire rows array for this mandi (section) so variety page can use without refetch
  const sectionId = sectionEl.id;
  const mandiMeta = MANDI_SECTIONS.find((m) => m.id === sectionId);
  if (mandiMeta && Array.isArray(rows) && rows.length) {
    try {
      sessionStorage.setItem(
        "mandiRows:" + mandiMeta.api,
        JSON.stringify(rows)
      );
    } catch (e) {
      console.warn("Failed to store mandi rows for", mandiMeta.api, e);
    }
  }
  cards.forEach((card) => {
    const variety = card
      .querySelector(".stock-name")
      ?.textContent.trim()
      .toLowerCase();
    const priceEl = card.querySelector(".price");
    const changeEl = card.querySelector(".change");
    card.classList.remove("loading", "up", "down");
    let row = null;
    if (variety) {
      row =
        map[variety] ||
        Object.values(map).find((r) =>
          variety.includes(r.variety.toLowerCase().split(" ")[0])
        );
    }
    if (!row || row.avgPerQuintal == null) {
      if (priceEl) priceEl.textContent = "—";
      if (changeEl) changeEl.textContent = "";
      return;
    }
    const boxPrice = row.pricePerBox;
    if (priceEl) priceEl.textContent = `₹${boxPrice}`;
    if (changeEl) {
      changeEl.textContent = "Stable";
      changeEl.classList.remove("up", "down");
    }
    card.classList.add("up");
    renderCardSparkline(
      card,
      boxPrice,
      `${mandiMeta?.api || sectionId}-${row.variety || variety || "v"}`
    );
  });
}

// Determine API base priority: global var -> meta tag -> empty (same origin)
const API_BASE = (() => {
  const meta = document.querySelector('meta[name="api-base"]');
  const injected =
    window.__API_BASE__ || (meta && meta.getAttribute("content")) || "";
  return injected.replace(/\/$/, "");
})();

// Generic fetch with exponential backoff & jitter
async function fetchWithRetry(
  url,
  { attempts = 3, baseDelay = 500, timeoutMs = 8000 } = {}
) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return await res.json();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      const isLast = i === attempts - 1;
      if (isLast) break;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function loadMandiPrices({ mock = false, fresh = false } = {}) {
  for (const { id, api } of MANDI_SECTIONS) {
    const section = document.getElementById(id);
    if (!section) continue;
    const cards = section.querySelectorAll(".stock-card");
    // Only show loading placeholders if this is first population (prices not yet set)
    if (!section.dataset.loaded) {
      cards.forEach(setCardLoading);
    }
    try {
      const url = `${API_BASE}/api/prices/${api}?${mock ? "mock=1&" : ""}${
        fresh ? "fresh=1&" : ""
      }`;
      const data = await fetchWithRetry(url, {
        attempts: 4,
        baseDelay: 400,
        timeoutMs: 7000,
      });
      updateMandiSection(section, data.rows || []);
      // Optional: small source indicator if response includes fallback flag later
      if (data.fallback) {
        section.dataset.source = data.fallback;
      }
      section.dataset.loaded = "1";
    } catch (err) {
      console.warn("Price fetch failed for", api, err.message || err);
      if (!section.dataset.loaded) {
        // Restore original static prices if we never succeeded
        cards.forEach((card) => {
          card.classList.remove("loading");
          const priceEl = card.querySelector(".price");
          const changeEl = card.querySelector(".change");
          if (priceEl) {
            if (card.dataset.originalPrice) {
              priceEl.textContent = card.dataset.originalPrice;
            } else if (!/^[₹0-9]/.test(priceEl.textContent)) {
              priceEl.textContent = "⚠"; // last resort
            }
          }
          if (changeEl) {
            if (card.dataset.originalChange) {
              changeEl.textContent = card.dataset.originalChange;
            }
          }
        });
      }
    }
  }
}

// Immediate mock for UX (only when same-origin assumed); then real fetch
loadMandiPrices({ mock: true });
setTimeout(() => loadMandiPrices({ fresh: false }), 500);

// -------- Live Kashmir Market News (GNews API) --------
function loadKashmirNews(options = { showSpinner: true }) {
  const newsGrid = document.querySelector(".news-grid");
  if (!newsGrid) return;
  const refreshBtn = document.querySelector(".refresh-news");
  const API_KEY = "217015665eaecaed7b51119b299a75be";
  const QUERIES = [
    '"Kashmir apple" OR "Kashmiri apples"',
    "Shopian apple OR Sopore apple OR Pulwama apple",
    "Azadpur apple OR Vashi apple OR Koley market apple",
    "Kashmir horticulture OR Kashmir agriculture OR Kashmir fruit market",
    "Kashmir farmers OR Kashmir growers OR apple growers",
    "Jammu Srinagar highway OR Jammu-Srinagar highway OR NH44 apple OR fruit trucks",
  ];

  const pickNextQuery = () => {
    let idx = Number(sessionStorage.getItem("news:lastQueryIdx") || "-1");
    idx = (idx + 1) % QUERIES.length;
    sessionStorage.setItem("news:lastQueryIdx", String(idx));
    return QUERIES[idx];
  };

  const getSeen = () => {
    try {
      return new Set(
        JSON.parse(sessionStorage.getItem("news:seenUrls") || "[]")
      );
    } catch {
      return new Set();
    }
  };
  const addSeen = (urls) => {
    try {
      const seen = Array.from(getSeen());
      const merged = Array.from(new Set([...urls, ...seen])).slice(0, 60);
      sessionStorage.setItem("news:seenUrls", JSON.stringify(merged));
    } catch {}
  };

  const cacheBust = () => `&_=${Date.now()}`;
  const buildEndpoint = (query) => {
    const q = encodeURIComponent(query);
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return `https://gnews.io/api/v4/search?q=${q}&lang=en&country=in&max=8&sortby=publishedAt&from=${from}&apikey=${API_KEY}${cacheBust()}`;
  };

  const skeletonCard = () => `
    <article class="news-card skeleton">
      <div class="news-head">
        <div class="sk-box"></div>
        <div class="sk-col">
          <div class="sk-line w60"></div>
          <div class="sk-line w40"></div>
        </div>
        <div class="sk-pill"></div>
      </div>
      <div class="sk-line w90"></div>
      <div class="sk-line w75"></div>
      <div class="sk-line w55"></div>
      <div class="sk-meta"></div>
    </article>`;

  if (options.showSpinner) {
    newsGrid.innerHTML =
      skeletonCard() + skeletonCard() + skeletonCard() + skeletonCard();
  }
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
  }

  const now = Date.now();
  const relTime = (iso) => {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const diffMs = now - t;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + " hrs";
    const days = Math.floor(hrs / 24);
    return days + "d";
  };
  const sanitize = (str = "") =>
    str.replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])
    );

  const tryLoad = async () => {
    const seen = getSeen();
    let attempts = QUERIES.length;
    let picked = [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const isRecent = (iso) => {
      const t = new Date(iso || 0).getTime();
      return !isNaN(t) && t >= cutoff;
    };
    while (attempts-- > 0) {
      const q = pickNextQuery();
      try {
        const r = await fetch(buildEndpoint(q));
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        const data = await r.json();
        // Filter by last 7 days first
        const candidates = (data.articles || []).filter(
          (a) => a && a.url && isRecent(a.publishedAt)
        );
        const fresh = candidates.filter((a) => !seen.has(a.url));
        picked = (fresh.length ? fresh : candidates).slice(0, 4);
        if (picked.length) break;
      } catch (err) {
        // continue to next query
      }
    }
    return picked;
  };

  tryLoad()
    .then((articles) => {
      if (!articles.length) {
        newsGrid.innerHTML =
          '<p class="loading-news">No news from the last 7 days found for now.</p>';
        return;
      }
      addSeen(articles.map((a) => a.url));
      newsGrid.innerHTML = articles
        .map((a) => {
          const source = a.source?.name || "Source";
          const initials = source
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const title = sanitize(a.title || "Untitled");
          const desc = sanitize(a.description || title);
          const url = a.url || "#";
          const published = a.publishedAt || "";
          return `<article class="news-card"><div class="news-head"><div class="badge">${initials}</div><h3 class="company">${source}</h3><span class="change-pct up">Live</span></div><p class="snippet" title="${desc}">${title}</p><div class="meta"><a href="${url}" target="_blank" rel="noopener">Read</a> · <time datetime="${published}">${relTime(
            published
          )}</time></div></article>`;
        })
        .join("");
    })
    .catch((err) => {
      console.error("News fetch error:", err);
      newsGrid.innerHTML =
        '<p class="loading-news" style="color:#b5482c;">Failed to load live news. Please retry later.</p>';
    })
    .finally(() => {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove("is-loading");
      }
    });
}

// initial load
loadKashmirNews();

// attach refresh handler
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".refresh-news");
  if (!btn) return;
  loadKashmirNews();
});

// Navigate to variety chart page when a price card is clicked
document.addEventListener("click", (e) => {
  const card = e.target.closest(".stock-card");
  if (!card) return;
  // Block interaction if card is still loading or price isn't available
  if (card.classList.contains("loading")) return;
  const priceEl = card.querySelector(".price");
  const priceRaw = (priceEl?.textContent || "").trim();
  // Accept only values that start with a currency/number; ignore placeholders like "—" or "Loading…"
  if (!/^([₹]\s*)?\d/.test(priceRaw)) return;
  const section = card.closest(".stock-section");
  if (!section) return;
  const varietyName = card.querySelector(".stock-name")?.textContent.trim();
  if (!varietyName) return;
  // map section id to api mandi value using existing constant
  const sectionId = section.id;
  const found = MANDI_SECTIONS.find((m) => m.id === sectionId);
  if (!found) return;
  const mandi = found.api; // already api alias (e.g., azadpur)
  // Extract displayed price (strip currency and commas)
  const priceText = card
    .querySelector(".price")
    ?.textContent.replace(/[^0-9.]/g, "");
  const changeText = card.querySelector(".change")?.textContent.trim() || "";
  // Parse numeric change from text like "+50 (2.5%)", "-20 (1.5%)", "+2.5%", or mark Stable as 0
  let changeAbs = null;
  let changePct = null;
  const absPct = changeText.match(
    /([+-]?\d+(?:\.\d+)?)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*%\s*\)/
  );
  if (absPct) {
    changeAbs = Number(absPct[1]);
    changePct = Number(absPct[2]);
  } else {
    const pctOnly = changeText.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    if (pctOnly) {
      changePct = Number(pctOnly[1]);
    } else if (/^stable/i.test(changeText)) {
      changeAbs = 0;
      changePct = 0;
    }
  }
  try {
    const payload = {
      mandi,
      variety: varietyName,
      priceBox: priceText ? Number(priceText) : null,
      changeText,
      changeAbs: Number.isFinite(changeAbs) ? changeAbs : null,
      changePct: Number.isFinite(changePct) ? changePct : null,
      ts: Date.now(),
    };
    sessionStorage.setItem("clickedVariety", JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to store clickedVariety", err);
  }
  const url = `variety.html?mandi=${encodeURIComponent(
    mandi
  )}&variety=${encodeURIComponent(varietyName)}`;
  // Use same tab navigation so sessionStorage remains accessible
  window.location.href = url;
});

// -------- FAQ Accordion --------
function initFAQAccordion() {
  const items = document.querySelectorAll(".accordion-item");
  if (!items.length) return;
  items.forEach((item) => {
    const trigger = item.querySelector(".accordion-trigger");
    const panel = item.querySelector(".accordion-panel");
    if (!trigger || !panel) return;
    // Ensure collapsed state initial
    panel.style.maxHeight = "0px";
    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      // Close other items
      items.forEach((other) => {
        if (other === item) return;
        const t = other.querySelector(".accordion-trigger");
        const p = other.querySelector(".accordion-panel");
        if (t && p) {
          t.setAttribute("aria-expanded", "false");
          p.classList.remove("open");
          p.style.maxHeight = "0px";
        }
      });
      if (expanded) {
        trigger.setAttribute("aria-expanded", "false");
        panel.classList.remove("open");
        panel.style.maxHeight = "0px";
      } else {
        trigger.setAttribute("aria-expanded", "true");
        panel.classList.add("open");
        // Add extra space to accommodate increased top/bottom padding
        panel.style.maxHeight = panel.scrollHeight + 40 + "px";
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", initFAQAccordion);

// -------- Smart Filters & Comparison Overlay --------

window.addEventListener("DOMContentLoaded", () => {
  // Smart filter controls
  const mandiFilter = document.getElementById("filter-mandi");
  const varietyFilter = document.getElementById("filter-variety");
  const priceInput = document.getElementById("filter-price");
  const priceVal = document.getElementById("price-val");
  const resetBtn = document.getElementById("btn-reset");

  const sectionToMandi = {};
  MANDI_SECTIONS.forEach((m) => {
    sectionToMandi[m.id] = m.api;
  });

  function parseCardPrice(card) {
    const raw = card.querySelector(".price")?.textContent || "";
    const num = Number(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) ? num : NaN;
  }

  function applySmartFilters() {
    if (!mandiFilter || !varietyFilter || !priceInput) return;
    const mandiWanted = mandiFilter.value;
    const varietyWanted = varietyFilter.value.toLowerCase();
    const minPrice = Number(priceInput.value) || 0;

    document.querySelectorAll(".stock-section").forEach((section) => {
      const sectionMandi = sectionToMandi[section.id] || "";
      const cards = section.querySelectorAll(".stock-card");
      let visibleCount = 0;

      cards.forEach((card) => {
        const name =
          card.querySelector(".stock-name")?.textContent.trim().toLowerCase() ||
          "";
        const price = parseCardPrice(card);
        const mandiOk = mandiWanted === "all" || mandiWanted === sectionMandi;
        const varietyOk =
          varietyWanted === "all" || name.includes(varietyWanted);
        const priceOk = Number.isFinite(price) ? price >= minPrice : false;

        const show = mandiOk && varietyOk && priceOk;
        card.classList.toggle("is-filtered-out", !show);
        if (show) visibleCount += 1;
      });

      section.classList.toggle("is-filtered-out", visibleCount === 0);
    });
  }

  function updatePriceLabel() {
    if (priceInput && priceVal) {
      priceVal.textContent = "₹" + Number(priceInput.value).toLocaleString();
    }
  }

  mandiFilter?.addEventListener("change", applySmartFilters);
  varietyFilter?.addEventListener("change", applySmartFilters);
  resetBtn?.addEventListener("click", () => {
    if (mandiFilter) mandiFilter.value = "all";
    if (varietyFilter) varietyFilter.value = "all";
    if (priceInput) priceInput.value = "1000";
    updatePriceLabel();
    applySmartFilters();
  });

  // Update price range text + apply filters live
  if (priceInput && priceVal) {
    priceInput.addEventListener("input", () => {
      updatePriceLabel();
      applySmartFilters();
    });
  }
  updatePriceLabel();
  // Re-apply after dynamic mandi prices load
  setTimeout(applySmartFilters, 250);
  setTimeout(applySmartFilters, 900);

  // Modal logic
  const compareBtn = document.getElementById("btn-compare-toggle");
  const headerCompareBtn = document.getElementById("header-compare-btn");
  const modal = document.getElementById("compare-modal");
  const closeBtn = document.getElementById("compare-close");

  if(compareBtn && modal && closeBtn) {
    compareBtn.addEventListener("click", () => {
      modal.classList.add("show");
      updateComparison();
    });
    headerCompareBtn?.addEventListener("click", () => {
      modal.classList.add("show");
      updateComparison();
    });
    
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("show");
    });
    
    // Close on click outside
    modal.addEventListener("click", (e) => {
      if(e.target === modal) modal.classList.remove("show");
    });
  }

  // Comparison Logic
  const compVar = document.getElementById("comp-variety");
  const compM1 = document.getElementById("comp-m1");
  const compM2 = document.getElementById("comp-m2");

  [compVar, compM1, compM2].forEach(el => {
    if(el) el.addEventListener("change", updateComparison);
  });

  function getMockPrice(mandi, variety) {
    const base = {
      delicious: 1300,
      american: 1400,
      kullu: 1350,
      gala: 1250
    }[variety] || 1300;

    const modifier = {
      shopian: 0,
      sopore: 20,
      azadpur: 180,
      mumbai: 220
    }[mandi] || 0;

    return base + modifier;
  }

  function getMandiName(id) {
    const names = {
      shopian: "Shopian",
      sopore: "Sopore",
      azadpur: "Azadpur",
      mumbai: "Vashi"
    };
    return names[id] || id;
  }

  function updateComparison() {
    if(!compVar) return;
    
    const v = compVar.value;
    const m1 = compM1.value;
    const m2 = compM2.value;

    const p1 = getMockPrice(m1, v);
    const p2 = getMockPrice(m2, v);

    document.getElementById("vs-m1-name").textContent = getMandiName(m1);
    document.getElementById("vs-m1-price").textContent = "₹" + p1.toLocaleString();
    
    document.getElementById("vs-m2-name").textContent = getMandiName(m2);
    document.getElementById("vs-m2-price").textContent = "₹" + p2.toLocaleString();

    const c1 = document.getElementById("vs-card-1");
    const c2 = document.getElementById("vs-card-2");
    
    c1.classList.remove("winner");
    c2.classList.remove("winner");

    let diff = Math.abs(p1 - p2);
    let pct = ((diff / Math.min(p1, p2)) * 100).toFixed(1);

    const diffEl = document.getElementById("comp-diff-val");
    const recEl = document.getElementById("comp-recommendation");
    
    if (p1 === p2) {
      diffEl.textContent = "Prices are identical";
      recEl.innerHTML = `Rates are similar. Sell in <strong>${getMandiName(m1)}</strong> to save transport time.`;
    } else if (p1 > p2) {
      c1.classList.add("winner");
      diffEl.textContent = `₹${diff} higher (${pct}%)`;
      recEl.innerHTML = `Sell in <strong>${getMandiName(m1)}</strong> today for better returns. Demand is robust.`;
    } else {
      c2.classList.add("winner");
      diffEl.textContent = `₹${diff} higher (${pct}%)`;
      recEl.innerHTML = `Sell in <strong>${getMandiName(m2)}</strong> today for better returns. Demand is robust.`;
    }
  }
});


// -------- Community Form Logic --------
window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("price-submit-form");
  const successMsg = document.getElementById("form-success");
  
  if(form && successMsg) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const btn = form.querySelector(".btn-submit");
      const originalText = btn.textContent;
      
      // Simulate network request
      btn.textContent = "Submitting...";
      btn.style.opacity = "0.7";
      btn.style.pointerEvents = "none";
      
      setTimeout(() => {
        // Show success
        btn.style.display = "none";
        successMsg.style.display = "block";
        
        // Reset form inputs (optional but good practice)
        form.reset();
        
        // Reset state after 4 seconds to allow new submissions
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.display = "block";
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
          successMsg.style.display = "none";
        }, 4000);
      }, 800);
    });
  }
});
