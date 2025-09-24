const mobileToggle = document.querySelector(".mobile-toggle");
const menu = document.getElementById("primary-menu");
const header = document.querySelector(".site-header");

function setScrollShadow() {
  if (window.scrollY > 4) {
    header.classList.add("is-scrolled");
  } else {
    header.classList.remove("is-scrolled");
  }
}

window.addEventListener("scroll", setScrollShadow, { passive: true });
setScrollShadow();

if (mobileToggle) {
  mobileToggle.addEventListener("click", () => {
    const expanded = mobileToggle.getAttribute("aria-expanded") === "true";
    mobileToggle.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("open");
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
  }
});

// Close menu on resize up
window.addEventListener("resize", () => {
  if (window.innerWidth >= 940 && menu.classList.contains("open")) {
    mobileToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
  }
});

// Close menu when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth >= 940) return;
  if (!menu.classList.contains("open")) return;
  if (e.target.closest(".nav-bar")) return; // inside
  mobileToggle.setAttribute("aria-expanded", "false");
  menu.classList.remove("open");
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

function updateMandiSection(sectionEl, rows) {
  const cards = sectionEl.querySelectorAll(".stock-card");
  const map = {};
  rows.forEach((r) => {
    map[r.variety.toLowerCase()] = r;
  });
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
  const query = encodeURIComponent("Kashmir apple");
  const endpoint = `https://gnews.io/api/v4/search?q=${query}&lang=en&country=in&max=4&sortby=publishedAt&apikey=${API_KEY}`;

  if (options.showSpinner) {
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
    newsGrid.innerHTML =
      skeletonCard() + skeletonCard() + skeletonCard() + skeletonCard();
  }
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
  }

  fetch(endpoint)
    .then((r) => {
      if (!r.ok) throw new Error("Network response was not ok");
      return r.json();
    })
    .then((data) => {
      const articles = (data.articles || []).slice(0, 4);
      if (!articles.length) {
        newsGrid.innerHTML =
          '<p class="loading-news">No fresh Kashmir news found right now.</p>';
        return;
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
  const card = e.target.closest('.stock-card');
  if(!card) return;
  const section = card.closest('.stock-section');
  if(!section) return;
  const varietyName = card.querySelector('.stock-name')?.textContent.trim();
  if(!varietyName) return;
  // map section id to api mandi value using existing constant
  const sectionId = section.id;
  const found = MANDI_SECTIONS.find(m => m.id === sectionId);
  if(!found) return;
  const mandi = found.api; // already api alias (e.g., azadpur)
  const url = `variety.html?mandi=${encodeURIComponent(mandi)}&variety=${encodeURIComponent(varietyName)}`;
  window.open(url, '_blank');
});
