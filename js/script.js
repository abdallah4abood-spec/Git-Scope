/* ============================================================
   GitScope — search, socials, export, toasts, caching, panel
   ============================================================ */

// The GitHub account shown automatically when the app opens
const DEFAULT_USER = "";

const GITHUB_API = "https://api.github.com/users/";

// API cache lifetime (GitHub rate limits are generous but finite)
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_KEY = "gitscope-api-cache";

(function init() {
  document.addEventListener("DOMContentLoaded", () => {
    initRevealCleanup();
    initProfilePanel();
    initTilt();
    renderDefaultUser();
  });
})();

/* ---------------- Entrance animation cleanup ---------------- */

// The staggered "reveal" animation uses fill-mode: forwards, and a running
// (or filled) CSS animation overrides inline transforms. Once it finishes we
// drop the class so libraries like Vanilla-Tilt can own the transform.
function initRevealCleanup() {
  document.querySelectorAll(".reveal").forEach((el) => {
    el.addEventListener(
      "animationend",
      () => {
        el.classList.remove("reveal");
        el.style.opacity = "";
      },
      { once: true }
    );
  });
}

/* ---------------- 3D tilt (Vanilla-Tilt) ---------------- */

// Activates the 3D tilt on the profile card. Skipped when the user
// prefers reduced motion or when the library failed to load (CDN).
function initTilt() {
  const card = document.querySelector(".user-card");
  if (!card) return;

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || typeof VanillaTilt === "undefined") {
    card.removeAttribute("data-tilt");
    return;
  }

  VanillaTilt.init(card, {
    max: 10,
    speed: 400,
    glare: true,
    "max-glare": 0.18,
    scale: 1.015,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    gyroscope: false, // avoid accidental tilts on touch devices
  });
}

/* ---------------- Toast notifications ---------------- */

function showToast(message, type = "info", duration = 3200) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const icons = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6M9 9l6 6"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8h.01M12 12v4"></path></svg>',
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span><span>${message}</span>`;
  stack.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  // Return the toast element so it can be manually removed later
  toast.__remove = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  };

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);

  return toast;
}

/* ---------------- API response caching ---------------- */

function cacheGet(username) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    const entry = cache[username.toLowerCase()];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      delete cache[username.toLowerCase()];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet(username, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    // Keep the cache small: 30 most recent users
    const keys = Object.keys(cache);
    if (keys.length >= 30) {
      keys
        .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
        .slice(0, keys.length - 29)
        .forEach((k) => delete cache[k]);
    }
    cache[username.toLowerCase()] = { timestamp: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — fetching still works, just uncached */
  }
}

/* ---------------- Search ---------------- */

function setLoading(isLoading) {
  const btn = document.querySelector(".searchBtn");
  const card = document.getElementById("card");
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
  card.classList.toggle("loading", isLoading);
}

function showNotFound(show) {
  const notFound = document.querySelector(".notFound");
  const bar = document.querySelector(".search-bar");
  notFound.classList.toggle("visible", show);
  if (show) {
    bar.classList.remove("shake");
    void bar.offsetWidth; // restart animation
    bar.classList.add("shake");
  }
}

function searchUser() {
  const input = document.querySelector(".searchUser");
  const value = input.value.trim();

  if (!value) {
    input.placeholder = "Please enter a username!";
    input.focus();
    return;
  }

  fetchAndRenderUser(value);
}

async function fetchAndRenderUser(username, { silent = false } = {}) {
  // 1. التحقق من وجود اسم المستخدم ومنع إرسال طلب فارغ للـ API
  const cleanUsername = (username || "").trim();
  if (!cleanUsername) {
    if (!silent) showToast("Please enter a valid GitHub username", "error");
    return;
  }

  setLoading(true);
  showNotFound(false);

  // Serve fresh cache instantly (also avoids burning rate limit)
  const cached = cacheGet(cleanUsername);
  if (cached) {
    renderUser(cached, {
      isDefault: normalize(cleanUsername) === normalize(DEFAULT_USER),
    });
    setLoading(false);
    if (!silent) showToast(`Loaded @${cached.login} from cache`, "info", 2200);
    return;
  }

  try {
    const response = await fetch(GITHUB_API + encodeURIComponent(cleanUsername));

    if (!response.ok) {
      if (response.status === 404) {
        showNotFound(true);
        if (!silent) showToast(`User "${cleanUsername}" not found`, "error");
      } else if (response.status === 403) {
        if (!silent)
          showToast("GitHub rate limit reached — try again later", "error");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    cacheSet(cleanUsername, data);
    renderUser(data, {
      isDefault: normalize(cleanUsername) === normalize(DEFAULT_USER),
    });
  } catch (error) {
    console.log("Error:", error);
  } finally {
    setLoading(false);
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/* ---------------- Rendering ---------------- */

function setOrMute(element, value) {
  element.textContent = value || "Not Available";
  element.classList.toggle("muted-field", !value);
}

// WhatsApp: sanitize any input ("+970 599-000-000", "(970)599...", etc.)
// down to raw digits, then expose it as a working wa.me link.
function setWhatsApp(value) {
  const link = document.getElementById("userWhatsApp");
  const digits = String(value || "").replace(/\D/g, "");

  if (digits) {
    link.textContent = String(value).trim();
    link.href = `https://wa.me/${digits}`;
    link.classList.remove("muted-field");
  } else {
    link.textContent = "Not Available";
    link.href = "#";
    link.classList.add("muted-field");
  }
}

function renderUser(data, { isDefault = false } = {}) {
  const fullName = document.getElementById("userFullName");
  const login = document.getElementById("userLogin");
  const joined = document.getElementById("joinedDate");
  const bio = document.getElementById("userBio");
  const avatars = document.querySelectorAll(".userProfile");
  const location = document.getElementById("userLocation");
  const website = document.getElementById("userWebsite");
  const company = document.getElementById("userCompany");
  const footerUser = document.getElementById("footerUser");

  fullName.textContent = data.name || data.login;
  login.textContent = "@" + (data.login || "");
  login.href = data.html_url || "#";
  joined.textContent = `Joined ${formatDate(data.created_at)}`;

  for (const avatar of avatars) {
    // crossOrigin stays intact; only the source changes
    avatar.src = data.avatar_url;
  }

  setOrMute(bio, data.bio);
  setOrMute(location, data.location);
  setOrMute(company, data.company);

  // GitHub API provides no WhatsApp data — reset to "Not Available"
  setWhatsApp(null);

  website.textContent = data.blog || "Not Available";
  website.classList.toggle("muted-field", !data.blog);
  website.href = data.blog
    ? data.blog.startsWith("http")
      ? data.blog
      : `https://${data.blog}`
    : "#";

  animateCounters(data);
  renderSocialLinks(data);

  footerUser.textContent = isDefault
    ? `default profile: @${data.login}`
    : `last search: @${data.login}`;

  // Smooth staggered re-reveal of the card content
  const content = document.getElementById("cardContent");
  content.classList.remove("animate-in");
  void content.offsetWidth;
  content.classList.add("animate-in");
}

/* ---------------- Social accounts strip ---------------- */

// Normalizes loose handles/URLs into absolute profile URLs per network.
function buildSocialUrl(network, raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  const bases = {
    linkedin: `https://www.linkedin.com/in/${handle}`,
    twitter: `https://x.com/${handle}`,
    instagram: `https://www.instagram.com/${handle}`,
    youtube: `https://www.youtube.com/${handle.startsWith("@") ? "" : "@"}${handle}`,
    facebook: `https://www.facebook.com/${handle}`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    twitch: `https://www.twitch.tv/${handle}`,
  };
  return bases[network] || null;
}

function renderSocialLinks(data) {
  const wrap = document.getElementById("socialLinks");
  const count = document.getElementById("socialCount");
  if (!wrap) return;

  const entries = [
    {
      network: "whatsapp",
      label: "WhatsApp",
      value: document.getElementById("userWhatsApp").href.startsWith("https://wa.me/")
        ? document.getElementById("userWhatsApp").textContent
        : null,
      href: document.getElementById("userWhatsApp").href.startsWith("https://wa.me/")
        ? document.getElementById("userWhatsApp").href
        : null,
    },
    {
      network: "website",
      label: "Website",
      value: data.blog,
      href: data.blog
        ? data.blog.startsWith("http")
          ? data.blog
          : `https://${data.blog}`
        : null,
    },
    {
      network: "linkedin",
      label: "LinkedIn",
      value: data.social_accounts?.linkedin || null,
    },
    {
      network: "twitter",
      label: "X / Twitter",
      value: data.twitter_username || data.social_accounts?.twitter || null,
    },
    {
      network: "instagram",
      label: "Instagram",
      value: data.social_accounts?.instagram || null,
    },
    {
      network: "youtube",
      label: "YouTube",
      value: data.social_accounts?.youtube || null,
    },
    {
      network: "facebook",
      label: "Facebook",
      value: data.social_accounts?.facebook || null,
    },
    {
      network: "tiktok",
      label: "TikTok",
      value: data.social_accounts?.tiktok || null,
    },
    {
      network: "twitch",
      label: "Twitch",
      value: data.social_accounts?.twitch || null,
    },
  ];

  const icons = {
    whatsapp:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>',
    website:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.554V9h3.565v11.452z"/></svg>',
    twitter:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"></circle></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    facebook:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    tiktok:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    twitch:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>',
  };

  wrap.innerHTML = "";
  let linked = 0;

  for (const item of entries) {
    const href = item.href || buildSocialUrl(item.network, item.value);
    const isLinked = Boolean(href);
    if (isLinked) linked += 1;

    // Available → real <a> opening in a new tab (with a guard against
    // href="#"-style no-ops). Unavailable → a plain <span> styled with
    // pointer-events:none + opacity, so it can never be clicked and can
    // never trigger navigation or a page reload.
    let chip;
    if (isLinked) {
      chip = document.createElement("a");
      chip.href = href;
      chip.target = "_blank";
      chip.rel = "noopener noreferrer";
      chip.addEventListener("click", (e) => {
        // Defensive: block broken/placeholder hrefs ("#", "javascript:...")
        if (!chip.href || chip.href === "#" || chip.href.endsWith("#")) {
          e.preventDefault();
        }
      });
      chip.className = "social-chip is-linked";
    } else {
      chip = document.createElement("span");
      chip.className = "social-chip is-empty";
      chip.setAttribute("aria-disabled", "true");
    }
    chip.title = isLinked
      ? `${item.label}: ${href}`
      : `${item.label}: Not Available`;
    chip.innerHTML = `
      ${icons[item.network] || ""}
      <span class="social-text">${item.label}</span>
      <span class="social-dot" aria-hidden="true"></span>
    `;
    wrap.appendChild(chip);
  }

  count.textContent = `${linked}/${entries.length} linked`;
}

// Guards against empty contact links reloading the page.
// Delegated once on the contact grid so all current/future links are covered.
document.addEventListener("DOMContentLoaded", () => {
  const contact = document.querySelector(".contact");
  if (!contact) return;
  contact.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") {
      e.preventDefault();
      const fieldName = link.classList.contains("website")
        ? "Website"
        : link.classList.contains("whatsapp-link")
          ? "WhatsApp"
          : "This contact field";
      showToast(`${fieldName} is not available for this profile`, "info", 2200);
    }
  });
});

// Count-up animation for repos / followers / following
function animateCounters(data) {
  animateCounter(".repos", data.public_repos || 0);
  animateCounter(".followers", data.followers || 0);
  animateCounter(".following", data.following || 0);
}

function animateCounter(selector, target) {
  const el = document.querySelector(selector);
  if (!el) return;

  const start = Number(el.textContent.replace(/\D/g, "")) || 0;
  const duration = 700;
  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function formatDate(dateCreated) {
  const date = new Date(dateCreated);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/* Default user on app open */
function renderDefaultUser() {
  fetchAndRenderUser(DEFAULT_USER, { silent: true });
}

/* ---------------- Export (PNG / PDF) ---------------- */

// Explicit capture background per theme. html2canvas cannot render the
// body gradient or backdrop-filter, and a transparent canvas behind the
// translucent card washes out text in Light Mode — so we always paint
// the page background color ourselves.
const EXPORT_BG = {
  dark: "#0f172a",
  light: "#eef2fb",
};

let isExporting = false;

async function exportCard(format) {
  const card = document.getElementById("card");
  if (!card || isExporting) return;
  isExporting = true;

  const toolbar = document.getElementById("exportToolbar");
  const pngBtn = document.getElementById("exportPngBtn");
  const pdfBtn = document.getElementById("exportPdfBtn");

  // Original inline styles, restored verbatim in `finally`
  const orig = {
    transform: card.style.transform,
    height: card.style.height,
    minHeight: card.style.minHeight,
    overflow: card.style.overflow,
    width: card.style.width,
  };

  const username =
    (document.getElementById("userLogin").textContent || "").replace(/^@/, "") ||
    "profile";

  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "dark";

  const loadingToast = showToast(
    `Capturing card as ${format.toUpperCase()}...`,
    "info"
  );

  // UI must NEVER leak into the export: hide the toolbar on the live card
  if (toolbar) toolbar.style.display = "none";
  if (pngBtn) pngBtn.disabled = true;
  if (pdfBtn) pdfBtn.disabled = true;

  // Freeze geometry: neutralize tilt/height clipping so the card is
  // measured and painted at its true layout size (no bottom/edge cropping).
  card.classList.add("exporting");
  card.style.transform = "none";
  card.style.overflow = "visible";

  // Lock the card to its measured pixel size BEFORE html2canvas clones it:
  // the capture iframe has a different viewport/scrollbar, and an unclamped
  // card reflows to a different size there (drifted 394→412px in testing).
  const lockW = card.scrollWidth;
  const lockH = card.scrollHeight;
  card.style.width = `${lockW}px`;
  card.style.height = `${lockH}px`;
  card.style.minHeight = "unset";

  try {
    const canvas = await html2canvas(card, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: EXPORT_BG[currentTheme] || EXPORT_BG.dark,
      width: lockW,
      height: lockH,
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        lockW + 32
      ),
      windowHeight: Math.max(
        document.documentElement.clientHeight,
        lockH + 32
      ),
      scrollX: 0,
      scrollY: 0,
      logging: false,
      onclone: (clonedDoc) => {
        // Resolve theme variables in the clone exactly like the live page,
        // otherwise text colors can fall back to the dark defaults.
        const clonedHtml = clonedDoc.documentElement;
        clonedHtml.setAttribute("data-theme", currentTheme);
        clonedHtml.style.colorScheme = currentTheme;
        clonedHtml.classList.toggle("dark", currentTheme === "dark");

        // html2canvas re-runs CSS animations inside its clone iframe, so
        // staggered items whose entrance animation hasn't finished there are
        // captured at opacity: 0 (blank card). Force the final visual state.
        const style = clonedDoc.createElement("style");
        style.textContent = `
          .card-content.animate-in .stagger-item,
          .reveal {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
          }
          .skeleton { display: none !important; }
        `;
        clonedDoc.head.appendChild(style);

        const clonedCard = clonedDoc.getElementById("card");
        if (clonedCard) {
          clonedCard.style.transform = "none";
          clonedCard.style.width = `${lockW}px`;
          clonedCard.style.height = `${lockH}px`;
          clonedCard.style.minHeight = "unset";
          clonedCard.style.overflow = "visible";
        }

        // Strip every UI control from the clone entirely (belt & braces:
        // the live toolbar is already display:none, this removes it).
        clonedDoc
          .querySelectorAll("#exportToolbar, .export-btn, .js-tilt-glare")
          .forEach((el) => el.remove());
      },
    });

    if (format === "pdf") {
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      // Page sized 1:1 to the canvas pixels → zero margins, zero cropping
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`GitScope-Card-${username}.pdf`);
    } else {
      await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("PNG encoding failed"));
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerDownload(url, `GitScope-Card-${username}.png`);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        }, "image/png");
      });
    }

    if (loadingToast && loadingToast.__remove) loadingToast.__remove();
    showToast(`Exported ${format.toUpperCase()} successfully!`, "success");
  } catch (err) {
    console.error("Export Error:", err);
    if (loadingToast && loadingToast.__remove) loadingToast.__remove();
    showToast("Export failed. Please try again.", "error");
  } finally {
    // Always restore the live UI exactly as it was
    card.classList.remove("exporting");
    card.style.transform = orig.transform;
    card.style.width = orig.width;
    card.style.height = orig.height;
    card.style.minHeight = orig.minHeight;
    card.style.overflow = orig.overflow;
    if (toolbar) toolbar.style.display = "flex";
    if (pngBtn) pngBtn.disabled = false;
    if (pdfBtn) pdfBtn.disabled = false;
    isExporting = false;
  }
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- My Profile panel ---------------- */

const MY_PROFILE_KEY = "gitscope-my-profile";

function readMyProfile() {
  try {
    return JSON.parse(localStorage.getItem(MY_PROFILE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMyProfile(profile) {
  try {
    localStorage.setItem(MY_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota exceeded (large photo) or storage unavailable */
  }
}

function initProfilePanel() {
  const section = document.getElementById("myProfile");
  const toggle = document.getElementById("profileToggle");
  const panel = document.getElementById("profilePanel");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("myAvatarPreview");
  const avatarEmoji = document.getElementById("avatarEmoji");
  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  const applyBtn = document.getElementById("applyProfileBtn");
  const resetBtn = document.getElementById("resetProfileBtn");
  const exportPngBtn = document.getElementById("exportPngBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");

  const fields = [
    "pfName",
    "pfBio",
    "pfLocation",
    "pfWebsite",
    "pfWhatsApp",
    "pfCompany",
    "pfLinkedIn",
    "pfTwitter",
    "pfInstagram",
    "pfYouTube",
    "pfFacebook",
    "pfTikTok",
    "pfTwitch",
  ];

  toggle.addEventListener("click", () => {
    const open = section.classList.toggle("open");
    panel.hidden = !open;
  });

  // Photo upload → preview + persist as data URL
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      avatarPreview.src = reader.result;
      avatarEmoji.hidden = false;
      const profile = readMyProfile();
      profile.avatar = reader.result;
      saveMyProfile(profile);
      showToast("Photo saved on this device", "success", 2200);
    };
    reader.readAsDataURL(file);
  });

  removeAvatarBtn.addEventListener("click", () => {
    avatarPreview.src = "./dist/assets/GitScope.png";
    avatarEmoji.hidden = true;
    const profile = readMyProfile();
    delete profile.avatar;
    saveMyProfile(profile);
  });

  applyBtn.addEventListener("click", () => {
    const profile = {
      ...readMyProfile(),
      name: document.getElementById("pfName").value.trim(),
      bio: document.getElementById("pfBio").value.trim(),
      location: document.getElementById("pfLocation").value.trim(),
      website: document.getElementById("pfWebsite").value.trim(),
      whatsapp: document.getElementById("pfWhatsApp").value.trim(),
      company: document.getElementById("pfCompany").value.trim(),
      linkedin: document.getElementById("pfLinkedIn").value.trim(),
      twitter: document.getElementById("pfTwitter").value.trim(),
      instagram: document.getElementById("pfInstagram").value.trim(),
      youtube: document.getElementById("pfYouTube").value.trim(),
      facebook: document.getElementById("pfFacebook").value.trim(),
      tiktok: document.getElementById("pfTikTok").value.trim(),
      twitch: document.getElementById("pfTwitch").value.trim(),
    };
    saveMyProfile(profile);
    applyMyProfileToCard(profile);
    showToast("Profile applied to the card", "success", 2200);
  });

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(MY_PROFILE_KEY);
    fields.forEach((id) => (document.getElementById(id).value = ""));
    avatarPreview.src = "./dist/assets/GitScope.png";
    avatarEmoji.hidden = true;
    // Fall back to the currently searched user
    renderDefaultUser();
    showToast("Personal profile reset", "info", 2200);
  });

  exportPngBtn.addEventListener("click", () => {
    exportCard("png");
  });
  exportPdfBtn.addEventListener("click", () => {
    exportCard("pdf");
  });

  restoreSavedProfile();
}

function restoreSavedProfile() {
  const profile = readMyProfile();
  const map = {
    pfName: profile.name,
    pfBio: profile.bio,
    pfLocation: profile.location,
    pfWebsite: profile.website,
    pfWhatsApp: profile.whatsapp,
    pfCompany: profile.company,
    pfLinkedIn: profile.linkedin,
    pfTwitter: profile.twitter,
    pfInstagram: profile.instagram,
    pfYouTube: profile.youtube,
    pfFacebook: profile.facebook,
    pfTikTok: profile.tiktok,
    pfTwitch: profile.twitch,
  };
  for (const [id, value] of Object.entries(map)) {
    if (value) document.getElementById(id).value = value;
  }
  if (profile.avatar) {
    document.getElementById("myAvatarPreview").src = profile.avatar;
    document.getElementById("avatarEmoji").hidden = false;
  }
}

// Overlay personal data on top of the searched card
function applyMyProfileToCard(profile) {
  const has = (v) => v && v.trim();
  if (has(profile.name))
    document.getElementById("userFullName").textContent = profile.name;
  if (has(profile.bio))
    setOrMute(document.getElementById("userBio"), profile.bio);
  if (has(profile.location))
    setOrMute(document.getElementById("userLocation"), profile.location);
  if (has(profile.company))
    setOrMute(document.getElementById("userCompany"), profile.company);

  if (has(profile.website)) {
    const website = document.getElementById("userWebsite");
    website.textContent = profile.website;
    website.href = profile.website.startsWith("http")
      ? profile.website
      : `https://${profile.website}`;
    website.classList.remove("muted-field");
  }

  // WhatsApp → sanitized wa.me link (or "Not Available" when empty)
  setWhatsApp(profile.whatsapp);

  if (profile.avatar) {
    document
      .querySelectorAll(".userProfile")
      .forEach((img) => (img.src = profile.avatar));
  }

  // Refresh social strip with personal overrides
  const waLink = document.getElementById("userWhatsApp");
  const currentLogin =
    document.getElementById("userLogin").textContent.replace(/^@/, "") ||
    DEFAULT_USER;
  const cached = cacheGet(currentLogin) || {};
  renderSocialLinks({
    ...cached,
    blog: has(profile.website) ? profile.website : cached.blog,
    twitter_username: has(profile.twitter) ? profile.twitter : cached.twitter_username,
    social_accounts: {
      ...(cached.social_accounts || {}),
      linkedin: profile.linkedin || cached.social_accounts?.linkedin,
      twitter: profile.twitter || cached.social_accounts?.twitter,
      instagram: profile.instagram || cached.social_accounts?.instagram,
      youtube: profile.youtube || cached.social_accounts?.youtube,
      facebook: profile.facebook || cached.social_accounts?.facebook,
      tiktok: profile.tiktok || cached.social_accounts?.tiktok,
      twitch: profile.twitch || cached.social_accounts?.twitch,
    },
  });

  // Small pulse on the card so the change is visible
  const content = document.getElementById("cardContent");
  content.classList.remove("animate-in");
  void content.offsetWidth;
  content.classList.add("animate-in");
}
