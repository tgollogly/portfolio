/** Newry Fuel Watch — live heating oil & diesel near Mullaghbane / Newry + buy signals. */

import { importVapidKeys, sendWebPush } from "./web-push.js";

export const NEWRY = {
  name: "Newry",
  county: "County Armagh",
  country: "Northern Ireland",
  postcode: "BT35",
  latitude: 54.1751,
  longitude: -6.3372,
  timezone: "Europe/London",
};

/** Home area — Mullaghbane, South Armagh (cross-border with Louth). */
export const MULLAGHBANE = {
  name: "Mullaghbane",
  county: "South Armagh",
  country: "Northern Ireland",
  postcode: "BT35",
  latitude: 54.0738,
  longitude: -6.4489,
  timezone: "Europe/London",
  note: "Near Forkhill — Dundalk & Louth within a short drive",
};

export const HOME = MULLAGHBANE;

export const SAFE_FUELS = {
  name: "S.A.F.E Fuels",
  location: "Camlough",
  address: "8 Newry Road, Camlough, Newry BT35 7JP",
  phone: "028 3083 0691",
  tel: "+442830830691",
  note: "Your usual heating oil supplier (NI delivery)",
};

/** Forecourts you asked to track — always shown even when not the cheapest nearby. */
export const DIESEL_WATCHLIST = [
  {
    id: "dan-gregorys",
    label: "Dan Gregory's",
    shortLabel: "Gregory's",
    usual: true,
    region: "ni",
    match: /gregory/i,
    postcodes: ["BT35 7EE"],
  },
  {
    id: "murphy-forkhill",
    label: "Tom Murphy's · Forkhill",
    shortLabel: "Murphy Bros Forkhill",
    region: "ni",
    match: /murphy.*forkhill|forkhill|murphy bros/i,
    postcodes: ["BT35 9RL"],
  },
  {
    id: "dundalk",
    label: "Dundalk forecourts",
    shortLabel: "Dundalk",
    region: "roi",
    match: /dundalk|maxol|circle k|applegreen|top oil/i,
  },
];

export const DATA_SOURCES = {
  heatingOilNi: "CheapestOil.co.uk (NI quotes, BT35)",
  heatingOilRoi: "CheapestOil.ie (Louth county quotes)",
  dieselNi: "Fuel Near You / UK Fuel Finder (CC BY 4.0)",
  dieselRoi: "Pick A Pump (Republic of Ireland diesel, euro cents/L)",
  exchangeRate: "Frankfurter.app (ECB daily EUR→GBP)",
  dieselHistory: "UK DESNZ weekly road fuel prices (Open Government Licence)",
  news: "BBC Business, UK & Science RSS feeds",
};

/** Free RSS — fuel/oil/energy headlines (no API key). */
export const FUEL_NEWS_FEEDS = [
  { id: "bbc_business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { id: "bbc_uk", name: "BBC UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
  {
    id: "bbc_science",
    name: "BBC Science & Environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
];

const FUEL_NEWS_UA = "NewryFuelWatch/1.0 (+https://tgollogly.dev/newry-fuel/)";
const FUEL_KEYWORDS =
  /oil|fuel|diesel|petrol|gasoline|kerosene|heating|energy price|OPEC|crude|barrel|pump|refinery|gas prices/i;
const RISE_NEWS =
  /surge|soar|rise|rising|increase|spike|jump|higher|OPEC cut|shortage|strike|disruption|record high|embargo/i;
const FALL_NEWS =
  /fall|drop|decline|decrease|slump|cheaper|cut prices|lower|plunge|dip|soften|eases|falls/i;

export const CHEAPEST_OIL_URL =
  "https://www.cheapestoil.co.uk/homeassistant/oilprice?postcode=BT35";
export const CHEAPEST_OIL_IE_LOUTH_URL =
  "https://www.cheapestoil.ie/heating-oil-prices/Louth";
export const FUEL_NEAR_YOU_URL =
  "https://fuelnearyou.com/api/v1/dashboard/widget/nearby?postcode=BT35&fuel_type=B7_STANDARD&radius=12&limit=5";
export const FUEL_NEAR_YOU_POSTCODES = ["BT35", "BT35 7EE", "BT35 9RL"];
export const FRANKFURTER_EUR_GBP_URL = "https://api.frankfurter.app/latest?from=EUR&to=GBP";
export const GOV_DIESEL_CSV =
  "https://assets.publishing.service.gov.uk/media/6aa801e097b321a2d34ee250/CSV__2018_-__.csv";

const FUEL_NEAR_YOU_UA = "NewryFuelWatch/1.0 (+https://tgollogly.dev/newry-fuel/)";
const CHEAPEST_OIL_IE_UA = "Mozilla/5.0 (compatible; NewryFuelWatch/1.0; +https://tgollogly.dev/newry-fuel/)";
const PICK_A_PUMP_UA = FUEL_NEAR_YOU_UA;

const KV_CACHE_KEY = "newry_fuel_snapshot_v1";
const KV_HISTORY_KEY = "newry_fuel_history_v1";
const KV_MEMORY_KEY = "newry_fuel_memory_v1";
const KV_ALERTS_KEY = "newry_fuel_alerts_v1";
const KV_PUSH_KEY = "newry_fuel_push_subs_v1";
const MEMORY_DAILY_MAX = 365;
const MEMORY_RECENT_MAX = 96;
const MEMORY_PREDICTION_MAX = 60;
const CHEAPEST_OIL_UA = "Mozilla/5.0 (compatible; HomeAssistant/2024.1; NewryFuelWatch/1.0)";

/** Normalize CheapestOil ppl — API sometimes returns pounds/litre. */
export function normalizePencePerLitre(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 20) return Math.round(n * 10000) / 100;
  return Math.round(n * 100) / 100;
}

export function formatPence(value, { fallback = "—" } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `${n.toFixed(1)}p`;
}

export function formatEuro(value, { fallback = "—", decimals = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `€${n.toFixed(decimals)}`;
}

/** ROI diesel is quoted in euro cents per litre → UK pence per litre equivalent. */
export function euroCentsToGbpPpl(euroCents, eurGbp) {
  const c = Number(euroCents);
  const rate = Number(eurGbp);
  if (!Number.isFinite(c) || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(c * rate * 10) / 10;
}

export function euroToGbp(euroAmount, eurGbp) {
  const e = Number(euroAmount);
  const rate = Number(eurGbp);
  if (!Number.isFinite(e) || !Number.isFinite(rate)) return null;
  return Math.round(e * rate * 100) / 100;
}

export function gbpPplToEuroCents(gbpPpl, eurGbp) {
  const p = Number(gbpPpl);
  const rate = Number(eurGbp);
  if (!Number.isFinite(p) || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round((p / rate) * 10) / 10;
}

export function parseGovDieselCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const dateStr = parts[0].replace(/^\uFEFF/, "");
    const diesel = Number(parts[2]);
    if (!Number.isFinite(diesel)) continue;
    const [d, m, y] = dateStr.split("/").map(Number);
    if (!d || !m || !y) continue;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    out.push({ date: iso, dieselPpl: diesel });
  }
  return out;
}

export function movingAverage(values, window) {
  if (!values.length) return null;
  const slice = values.slice(-window);
  if (!slice.length) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function linearTrend(values) {
  if (values.length < 3) return { slope: 0, intercept: values[0] || 0 };
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: values[n - 1] };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function exponentialMovingAverage(values, span = 7) {
  const slice = (values || []).filter(Number.isFinite);
  if (!slice.length) return null;
  const k = 2 / (span + 1);
  let ema = slice[0];
  for (let i = 1; i < slice.length; i++) {
    ema = slice[i] * k + ema * (1 - k);
  }
  return ema;
}

export function computeMomentum(prices, period = 5) {
  const p = (prices || []).filter(Number.isFinite).slice(-(period + 1));
  if (p.length < 2) return 0;
  return (p[p.length - 1] - p[0]) / Math.max(1, p.length - 1);
}

export function computeRsi(prices, period = 14) {
  const p = (prices || []).filter(Number.isFinite).slice(-(period + 1));
  if (p.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeVolatility(prices, period = 14) {
  const p = (prices || []).filter(Number.isFinite).slice(-period);
  if (p.length < 3) return 0;
  const mean = p.reduce((a, b) => a + b, 0) / p.length;
  const variance = p.reduce((s, v) => s + (v - mean) ** 2, 0) / p.length;
  return Math.sqrt(variance);
}

export function computeGovMomentum(govSeries) {
  const prices = (govSeries || []).slice(-8).map((g) => g.dieselPpl).filter(Number.isFinite);
  if (prices.length < 3) return { slope: 0, weeklyChange: 0 };
  const trend = linearTrend(prices);
  const weeklyChange =
    prices.length >= 2 ? prices[prices.length - 1] - prices[prices.length - 2] : 0;
  return { slope: trend.slope, weeklyChange };
}

/** Multi-indicator ensemble for sharper 1–14 day predictions. */
export function buildPredictionIndicators({
  prices,
  current,
  ma7,
  ma30,
  govSeries,
  newsSentiment,
}) {
  const hist = (prices || []).filter(Number.isFinite);
  const rsi = computeRsi(hist);
  const momentum = computeMomentum(hist);
  const volatility = computeVolatility(hist);
  const ema7 = exponentialMovingAverage(hist.slice(-14), 7);
  const gov = computeGovMomentum(govSeries);

  const trendScore = Math.tanh(momentum * 2.5);
  const rsiScore = (50 - rsi) / 50;
  const meanRevScore = ma7 ? Math.tanh((ma7 - current) / Math.max(volatility || 0.5, 0.5)) : 0;
  const govScore = Math.tanh(gov.slope * 3);
  let newsScore = 0;
  if (newsSentiment?.priceDirection === "up") newsScore = 0.65;
  else if (newsSentiment?.priceDirection === "down") newsScore = -0.65;

  const composite =
    trendScore * 0.28 +
    rsiScore * 0.18 +
    meanRevScore * 0.22 +
    govScore * 0.22 +
    newsScore * 0.1;

  const nearTermBias = composite > 0.12 ? "up" : composite < -0.12 ? "down" : "steady";
  const alignedCount = [
    trendScore > 0.1,
    trendScore < -0.1,
    rsi < 40,
    rsi > 60,
    meanRevScore > 0.15,
    meanRevScore < -0.15,
    govScore > 0.1,
    govScore < -0.1,
    newsScore !== 0,
  ].filter(Boolean).length;

  const indicators = [
    {
      id: "momentum",
      label: "Price momentum",
      score: Math.round(Math.abs(trendScore) * 100),
      direction: trendScore > 0.1 ? "up" : trendScore < -0.1 ? "down" : "neutral",
      detail: `${momentum >= 0 ? "+" : ""}${momentum.toFixed(2)}p/day`,
      weight: 28,
    },
    {
      id: "rsi",
      label: "RSI (14-day)",
      score: Math.round(rsi),
      direction: rsi > 60 ? "up" : rsi < 40 ? "down" : "neutral",
      detail: rsi < 40 ? "Oversold — bounce likely" : rsi > 60 ? "Overbought — may soften" : "Neutral range",
      weight: 18,
    },
    {
      id: "mean_reversion",
      label: "vs 7-day average",
      score: Math.round(Math.abs(meanRevScore) * 100),
      direction: meanRevScore > 0.1 ? "down" : meanRevScore < -0.1 ? "up" : "neutral",
      detail: ma7
        ? `${current <= ma7 ? "Below" : "Above"} avg by ${Math.abs(current - ma7).toFixed(1)}p`
        : "Building history…",
      weight: 22,
    },
    {
      id: "gov_diesel",
      label: "UK diesel trend",
      score: Math.round(Math.abs(govScore) * 100),
      direction: govScore > 0.08 ? "up" : govScore < -0.08 ? "down" : "neutral",
      detail: `${gov.weeklyChange >= 0 ? "+" : ""}${gov.weeklyChange.toFixed(1)}p/week (gov data)`,
      weight: 22,
    },
    {
      id: "news",
      label: "News sentiment",
      score: newsScore === 0 ? 50 : Math.round(50 + newsScore * 50),
      direction: newsSentiment?.priceDirection || "neutral",
      detail:
        newsSentiment?.priceDirection === "up"
          ? "Headlines point to rising fuel costs"
          : newsSentiment?.priceDirection === "down"
            ? "Headlines point to softer prices"
            : "No strong news signal",
      weight: 10,
    },
    {
      id: "volatility",
      label: "Volatility",
      score: Math.min(100, Math.round((volatility / Math.max(current * 0.02, 0.5)) * 100)),
      direction: volatility > current * 0.012 ? "watch" : "neutral",
      detail: `${volatility.toFixed(1)}p swing — ${volatility > current * 0.015 ? "wait for dips" : "stable band"}`,
      weight: 0,
    },
  ];

  return {
    composite: Math.round(composite * 1000) / 1000,
    nearTermBias,
    alignedCount,
    accuracyNote: `${alignedCount} signals active · ensemble tuned for next 1–14 days`,
    indicators,
    momentum,
    rsi,
    volatility,
    govMomentum: gov,
    ema7,
  };
}

export function percentileRank(value, series) {
  if (!series.length || !Number.isFinite(value)) return 0.5;
  const sorted = [...series].sort((a, b) => a - b);
  const below = sorted.filter((v) => v <= value).length;
  return below / sorted.length;
}

export function priceProfile(histPrices, current) {
  const hist = (histPrices || []).filter(Number.isFinite);
  return {
    pct: percentileRank(current, hist.length ? hist : [current]),
    vsMa8: current / (movingAverage(hist, 8) || current),
    slope: linearTrend(hist.slice(-6).length >= 3 ? hist.slice(-6) : hist).slope,
  };
}

/** Parse RSS titles from raw XML (same shape as Pursuit feeds). */
export function parseFuelNewsTitles(xml, max = 25) {
  const titles = [];
  const skip = new Set(["BBC News", "BBC Business", "BBC UK", "BBC"]);
  const re = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) && titles.length < max + 3) {
    const t = (m[1] || m[2] || "").trim();
    if (!t || skip.has(t)) continue;
    if (!titles.includes(t)) titles.push(t);
  }
  return titles.slice(0, max);
}

export function analyzeHeadlineDirection(title) {
  const h = String(title || "");
  if (RISE_NEWS.test(h)) {
    return { direction: "up", icon: "↑", tag: "Prices may rise", reason: "Headline signals upward pressure on fuel" };
  }
  if (FALL_NEWS.test(h)) {
    return { direction: "down", icon: "↓", tag: "Prices may fall", reason: "Headline signals downward pressure on fuel" };
  }
  return { direction: "neutral", icon: "→", tag: "Watch", reason: "Fuel-related but no clear up/down signal" };
}

export function analyzeNewsSentiment(headlines) {
  const relevant = [];
  const tagged = [];
  let rise = 0;
  let fall = 0;
  for (const raw of headlines || []) {
    const h = String(raw || "").trim();
    if (!h || !FUEL_KEYWORDS.test(h)) continue;
    relevant.push(h);
    const tag = analyzeHeadlineDirection(h);
    tagged.push({ title: h, ...tag });
    if (tag.direction === "up") rise++;
    if (tag.direction === "down") fall++;
  }
  let bias = "neutral";
  let priceDirection = "steady";
  if (rise > fall) {
    bias = "rising";
    priceDirection = "up";
  } else if (fall > rise) {
    bias = "falling";
    priceDirection = "down";
  }
  const outlookHeadline =
    priceDirection === "up"
      ? "📈 News says: pump prices likely to GO UP"
      : priceDirection === "down"
        ? "📉 News says: pump prices likely to GO DOWN"
        : "➡️ News says: no strong up/down signal yet";
  const outlookDetail =
    priceDirection === "up"
      ? `${rise} headline${rise === 1 ? "" : "s"} point to rising oil/fuel costs — forecourts often follow within 1–2 weeks.`
      : priceDirection === "down"
        ? `${fall} headline${fall === 1 ? "" : "s"} point to softer energy prices — you may see lower pump prices soon.`
        : "Headlines mention fuel but don't clearly say up or down — rely on the live trend chart below.";
  const summary = outlookDetail;
  return {
    bias,
    priceDirection,
    outlookHeadline,
    outlookDetail,
    rise,
    fall,
    relevant: relevant.slice(0, 8),
    tagged: tagged.slice(0, 8),
    summary,
  };
}

export async function fetchFuelNews() {
  const headlines = [];
  const sources = [];
  for (const feed of FUEL_NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { Accept: "application/rss+xml, application/xml", "User-Agent": FUEL_NEWS_UA },
        cf: { cacheTtl: 1800 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const titles = parseFuelNewsTitles(xml, 20);
      headlines.push(...titles);
      sources.push(feed.name);
    } catch { /* skip feed */ }
  }
  const sentiment = analyzeNewsSentiment(headlines);
  return { ok: true, sentiment, sources: [...new Set(sources)], fetchedAt: new Date().toISOString() };
}

/** Pattern-match vs UK weekly diesel history — how often similar weeks were good buys. */
export function computePatternMatch(govSeries, histPrices, current) {
  const prices = (govSeries || []).map((g) => g.dieselPpl).filter(Number.isFinite);
  if (prices.length < 40 || !Number.isFinite(current)) {
    return { matchRate: null, samples: 0, avgDistance: null };
  }
  const hist = (histPrices || []).map((h) => Number(h.price)).filter(Number.isFinite);
  const profile = priceProfile(hist.length >= 8 ? hist : prices.slice(-26), current);
  const neighbors = [];
  for (let i = 26; i < prices.length - 4; i++) {
    const h = prices.slice(i - 26, i);
    const c = prices[i];
    const q = priceProfile(h, c);
    const dist =
      Math.abs(profile.pct - q.pct) +
      Math.abs(profile.vsMa8 - q.vsMa8) * 3 +
      Math.abs(profile.slope - q.slope) * 0.3;
    const futureMin = Math.min(prices[i + 1], prices[i + 2], prices[i + 3], prices[i + 4]);
    neighbors.push({ dist, goodBuy: c <= futureMin + 1.2 });
  }
  neighbors.sort((a, b) => a.dist - b.dist);
  const top = neighbors.slice(0, 10);
  const matchRate = top.length ? top.filter((n) => n.goodBuy).length / top.length : null;
  const avgDistance = top.length ? top.reduce((s, n) => s + n.dist, 0) / top.length : null;
  return {
    matchRate,
    samples: top.length,
    avgDistance: avgDistance != null ? Math.round(avgDistance * 1000) / 1000 : null,
  };
}

/** Walk-forward backtest on UK weekly diesel — measured accuracy for high-confidence tier. */
export function backtestBuyModel(govSeries, opts = {}) {
  const prices = (govSeries || []).map((g) => g.dieselPpl).filter(Number.isFinite);
  const pctMax = opts.pctMax ?? 0.35;
  const minRate = opts.minRate ?? 0.9;
  const maxDist = opts.maxDist ?? 0.12;
  let hiCorrect = 0;
  let hiTotal = 0;
  let allCorrect = 0;
  let allTotal = 0;

  for (let i = 26; i < prices.length - 4; i++) {
    const hist = prices.slice(i - 26, i);
    const cur = prices[i];
    const futureMin = Math.min(prices[i + 1], prices[i + 2], prices[i + 3], prices[i + 4]);
    const goodBuy = cur <= futureMin + 1.2;
    const pattern = computePatternMatch(
      prices.slice(0, i + 1).map((dieselPpl) => ({ dieselPpl })),
      hist.map((p) => ({ price: p })),
      cur
    );
    allTotal++;
    if (goodBuy) allCorrect++;

    if (percentileRank(cur, hist) > pctMax) continue;
    if (pattern.matchRate == null || pattern.matchRate < minRate) continue;
    if (pattern.avgDistance != null && pattern.avgDistance > maxDist) continue;
    hiTotal++;
    if (goodBuy) hiCorrect++;
  }

  return {
    highConfidenceAccuracy: hiTotal ? Math.round((hiCorrect / hiTotal) * 1000) / 10 : null,
    highConfidenceSamples: hiTotal,
    naiveBuyAccuracy: allTotal ? Math.round((allCorrect / allTotal) * 1000) / 10 : null,
    method: "Pattern-match on UK weekly diesel (2018–2026) + live news alignment",
  };
}

export function buildSavingsTable({ savingsPpl, kind }) {
  const ppl = Number(savingsPpl) || 0;
  if (ppl <= 0) return [];
  const sizes = kind === "heating" ? [500, 900, 1000] : [40, 50, 60];
  return sizes.map((litres) => ({
    litres,
    savePounds: Math.round(((ppl * litres) / 100) * 100) / 100,
    label: kind === "heating" ? `${litres}L oil` : `${litres}L diesel`,
  }));
}

export function computeModelConfidence({ verdict, pattern, news, backtest, memoryStats = null }) {
  let confidence = 55;
  if (pattern?.matchRate != null) {
    confidence = Math.round(pattern.matchRate * 100);
  }
  if (news?.bias === "falling" && (verdict === "buy" || verdict === "watch")) {
    confidence = Math.min(97, confidence + 10);
  } else if (news?.bias === "rising" && verdict === "wait") {
    confidence = Math.min(97, confidence + 10);
  } else if (news?.bias === "rising" && verdict === "buy") {
    confidence = Math.max(35, confidence - 12);
  } else if (news?.bias === "falling" && verdict === "wait") {
    confidence = Math.max(35, confidence - 8);
  }
  if (pattern?.matchRate >= 0.9 && pattern?.avgDistance <= 0.12) {
    confidence = Math.min(97, confidence + 4);
  }
  if (news?.indicators?.alignedCount >= 4) {
    confidence = Math.min(97, confidence + 6);
  }
  if (memoryStats?.days >= 7) confidence = Math.min(97, confidence + 2);
  if (memoryStats?.days >= 30) confidence = Math.min(97, confidence + 4);
  if (memoryStats?.days >= 90) confidence = Math.min(97, confidence + 3);
  if (memoryStats?.tracked >= 5 && memoryStats?.accuracyPct != null) {
    const acc = memoryStats.accuracyPct;
    if (acc >= 70 && (verdict === "wait" || verdict === "watch")) {
      confidence = Math.min(97, confidence + 5);
    } else if (acc >= 70 && verdict === "buy") {
      confidence = Math.min(97, confidence + 4);
    } else if (acc < 45) {
      confidence = Math.max(30, confidence - 6);
    }
  }
  const highConfidence = confidence >= 95;
  const memoryNote = memoryStats?.days
    ? `${memoryStats.days} day${memoryStats.days > 1 ? "s" : ""} of stored Newry readings${
        memoryStats.accuracyPct != null && memoryStats.tracked >= 5
          ? ` · past advice matched outcomes ${memoryStats.accuracyPct}% of the time`
          : ""
      }.`
    : null;
  const noteParts = [];
  if (backtest?.highConfidenceAccuracy) {
    noteParts.push(
      `Similar past weeks were good buys ${backtest.highConfidenceAccuracy}% of the time (n=${backtest.highConfidenceSamples}).`
    );
  }
  if (memoryNote) noteParts.push(memoryNote);
  return {
    score: Math.min(97, Math.max(25, confidence)),
    highConfidence,
    backtestNote: noteParts.length ? noteParts.join(" ") : null,
    memoryNote,
    newsAligned:
      (news?.bias === "falling" && (verdict === "buy" || verdict === "watch")) ||
      (news?.bias === "rising" && verdict === "wait") ||
      news?.bias === "neutral",
  };
}

/** Predict buy timing from price history + trend. */
export function analyzeBuySignal({
  current,
  history,
  label,
  unit = "p/L",
  kind = "heating",
  govSeries = null,
  newsSentiment = null,
  backtest = null,
  memoryStats = null,
  dieselContext = null,
}) {
  const prices = (history || []).map((h) => Number(h.price)).filter(Number.isFinite);
  if (!Number.isFinite(current)) {
    return {
      label,
      unit,
      current: null,
      verdict: "unknown",
      headline: "Waiting for live data…",
      confidence: 0,
      reasons: [],
      forecast: [],
    };
  }

  prices.push(current);
  const ma7 = movingAverage(prices, 7);
  const ma30 = movingAverage(prices, 30);
  const recent = prices.slice(-12);
  const trend = linearTrend(recent);
  const pctRank = percentileRank(current, prices.slice(-90));
  const vs7 = ma7 ? ((current - ma7) / ma7) * 100 : 0;
  const vs30 = ma30 ? ((current - ma30) / ma30) * 100 : 0;

  const reasons = [];
  let score = 50;

  if (ma7 && current <= ma7 * 0.985) {
    reasons.push(`${Math.abs(vs7).toFixed(1)}% below the 7-day average — a local dip.`);
    score += 18;
  } else if (ma7 && current >= ma7 * 1.015) {
    reasons.push(`${vs7.toFixed(1)}% above the 7-day average — prices have risen lately.`);
    score -= 20;
  }

  if (ma30 && current <= ma30 * 0.97) {
    reasons.push(`${Math.abs(vs30).toFixed(1)}% below the 30-day average — unusually cheap.`);
    score += 22;
  }

  if (pctRank <= 0.2) {
    reasons.push("In the cheapest 20% of recent readings — strong buy zone.");
    score += 15;
  } else if (pctRank >= 0.85) {
    reasons.push("Near recent highs — consider waiting if you can.");
    score -= 18;
  }

  if (trend.slope < -0.15) {
    reasons.push("Short-term trend is still falling — you may get a better price soon.");
    score -= 8;
  } else if (trend.slope > 0.2 && current <= (ma7 || current)) {
    reasons.push("Prices just turned upward from a dip — good moment before the next rise.");
    score += 12;
  }

  let verdict = "hold";
  let headline = "Fair price — no rush";
  if (score >= 72) {
    verdict = "buy";
    headline = "Good time to buy — before prices climb";
  } else if (score >= 58) {
    verdict = "watch";
    headline = "Worth watching — prices look favourable";
  } else if (score <= 35) {
    verdict = "wait";
    headline =
      kind === "diesel"
        ? "Hold off filling up — pump price looks high"
        : "Hold off if you can — prices look high";
  }

  const predictionIndicators = buildPredictionIndicators({
    prices,
    current,
    ma7,
    ma30,
    govSeries,
    newsSentiment,
  });

  const forecast = buildShortForecast(recent, trend, predictionIndicators);
  const extendedForecast = buildExtendedForecast({
    current,
    recent,
    trend,
    govSeries,
    kind,
    indicators: predictionIndicators,
  });

  const pattern = govSeries ? computePatternMatch(govSeries, history, current) : { matchRate: null, samples: 0 };
  if (pattern.matchRate != null && pattern.matchRate >= 0.88) {
    reasons.push(
      `${Math.round(pattern.matchRate * 100)}% of similar past weeks were good times to buy (UK diesel patterns).`
    );
  }
  if (newsSentiment?.bias === "falling" && (verdict === "buy" || verdict === "watch")) {
    reasons.push("News headlines suggest prices may fall slowly — you're buying ahead of the crowd.");
    score += 8;
  } else if (newsSentiment?.bias === "rising" && verdict === "wait") {
    reasons.push("News points to rising energy costs — waiting could pay off.");
    score += 6;
  } else if (newsSentiment?.bias === "rising" && verdict === "buy") {
    reasons.push("News warns of rising prices — consider buying sooner rather than later.");
  }

  const model = computeModelConfidence({
    verdict,
    pattern,
    news: { ...newsSentiment, indicators: predictionIndicators },
    backtest,
    memoryStats,
  });

  const guide = buildBuyGuide({
    current,
    verdict,
    trend,
    forecast,
    extendedForecast,
    ma7,
    ma30,
    prices: prices.slice(-90),
    model,
    newsSentiment,
    kind,
  });

  const holdOutlook =
    verdict === "wait" || verdict === "watch"
      ? buildHoldOutlook({
          current,
          verdict,
          extendedForecast,
          predictionIndicators,
          history: history,
          newsSentiment,
          guide,
          kind,
        })
      : null;
  if (guide && holdOutlook) guide.holdOutlook = holdOutlook;

  const firmHold = isFirmHold(guide, holdOutlook);
  if (verdict === "wait" && !firmHold) {
    headline =
      kind === "diesel"
        ? "Pump price high — no dip forecast; waiting is risky"
        : "Price looks high — no dip forecast; waiting is risky";
  }
  if (guide) guide.firmHold = firmHold;

  const why = buildVerdictWhy({
    current,
    vs7Pct: Math.round(vs7 * 10) / 10,
    vs30Pct: Math.round(vs30 * 10) / 10,
    percentile: Math.round(pctRank * 100),
    trendSlope: Math.round(trend.slope * 1000) / 1000,
    verdict,
    guide,
    ma7: ma7 ? Math.round(ma7 * 100) / 100 : null,
    ma30: ma30 ? Math.round(ma30 * 100) / 100 : null,
    reasons,
    kind,
    label,
    dieselContext,
  });

  const holdExplain =
    kind === "diesel" && (verdict === "wait" || verdict === "watch")
      ? buildDieselHoldExplain({ current, verdict, guide, holdOutlook }, dieselContext)
      : null;

  return {
    label,
    unit,
    current,
    ma7: ma7 ? Math.round(ma7 * 100) / 100 : null,
    ma30: ma30 ? Math.round(ma30 * 100) / 100 : null,
    vs7Pct: Math.round(vs7 * 10) / 10,
    vs30Pct: Math.round(vs30 * 10) / 10,
    percentile: Math.round(pctRank * 100),
    trendSlope: Math.round(trend.slope * 1000) / 1000,
    verdict,
    headline,
    confidence: model.score,
    highConfidence: model.highConfidence,
    pattern,
    model,
    reasons,
    forecast,
    extendedForecast,
    predictionIndicators,
    guide,
    holdOutlook,
    why,
    holdExplain,
    firmHold,
  };
}

/** 7-day ensemble forecast — linear trend + momentum + mean reversion + news. */
export function buildShortForecast(recent, trend, indicators = null) {
  const current = recent[recent.length - 1];
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const linear = trend.intercept + trend.slope * (recent.length + i);
    let est = linear;
    if (indicators && Number.isFinite(current)) {
      const linearPath = current + (linear - current) * Math.exp(-i / 18);
      const momentumNudge = indicators.composite * 0.45 * i * Math.exp(-i / 12);
      const meanPull = indicators.ema7
        ? (indicators.ema7 - current) * (1 - Math.exp(-i / 6)) * 0.18
        : 0;
      est = linearPath + momentumNudge + meanPull;
    }
    forecast.push({
      day: i,
      estimate: Math.max(0, Math.round(est * 10) / 10),
      low: Math.max(0, Math.round((est - (indicators?.volatility || 0) * 0.3) * 10) / 10),
      high: Math.max(0, Math.round((est + (indicators?.volatility || 0) * 0.3) * 10) / 10),
    });
  }
  return forecast;
}

/** Seasonal diesel profile keyed by month + week-in-month (UK gov weekly history). */
export function computeSeasonalProfile(govSeries) {
  const series = govSeries || [];
  if (series.length < 52) return null;
  const buckets = {};
  let sum = 0;
  for (const g of series) {
    sum += g.dieselPpl;
    const d = new Date(`${g.date}T12:00:00Z`);
    const key = `${d.getUTCMonth()}-${Math.min(3, Math.floor((d.getUTCDate() - 1) / 7))}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(g.dieselPpl);
  }
  const avgAll = sum / series.length;
  const profile = {};
  for (const [key, vals] of Object.entries(buckets)) {
    profile[key] = vals.reduce((a, b) => a + b, 0) / vals.length / avgAll;
  }
  return { profile, avgAll };
}

function seasonalKeyForDay(dayOffset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return `${d.getUTCMonth()}-${Math.min(3, Math.floor((d.getUTCDate() - 1) / 7))}`;
}

function formatFutureDate(day) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + day);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: day >= 60 ? "numeric" : undefined });
}

function formatFutureLabel(day) {
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow (1 day)";
  if (day === 7) return "Next week (7 days)";
  if (day === 14) return "2 weeks";
  if (day === 30) return "Next month (~30 days)";
  if (day === 90) return "3 months";
  if (day === 180) return "6 months";
  return `In ${day} days`;
}

/** Estimate price at day 1 … 180 — ensemble + UK seasonal diesel patterns. */
export function buildExtendedForecast({
  current,
  recent,
  trend,
  govSeries,
  kind = "heating",
  indicators = null,
}) {
  const round = (n) => Math.round(n * 10) / 10;
  const days = [0, 1, 3, 7, 14, 30, 90, 180];
  const seasonal = computeSeasonalProfile(govSeries);
  const latestGov = govSeries?.length ? govSeries[govSeries.length - 1].dieselPpl : null;
  const heatingRatio =
    kind === "heating" && latestGov && current ? current / latestGov : kind === "heating" ? 0.58 : 1;

  const nowSeasonKey = seasonalKeyForDay(0);
  const nowSeasonRatio = seasonal?.profile[nowSeasonKey] || 1;
  const vol = indicators?.volatility || 0;

  return days.map((day) => {
    const damp = Math.exp(-day / 50);
    let trendEst = current + trend.slope * day * damp;
    if (indicators && day <= 14) {
      trendEst += indicators.composite * 0.4 * day * Math.exp(-day / 10);
    }

    let seasonalEst = current;
    if (seasonal) {
      const futureKey = seasonalKeyForDay(day);
      const futureRatio = seasonal.profile[futureKey] || 1;
      const dieselSeasonal =
        (seasonal.avgAll * futureRatio) / (seasonal.avgAll * nowSeasonRatio) * (latestGov || current);
      seasonalEst = kind === "heating" ? dieselSeasonal * heatingRatio : dieselSeasonal;
    }

    let blend;
    if (day <= 7) blend = trendEst * 0.8 + seasonalEst * 0.2;
    else if (day <= 14) blend = trendEst * 0.65 + seasonalEst * 0.35;
    else if (day <= 30) blend = trendEst * 0.4 + seasonalEst * 0.6;
    else blend = trendEst * 0.2 + seasonalEst * 0.8;

    const uncertainty = vol * (0.25 + day / 120);
    return {
      day,
      label: formatFutureLabel(day),
      dateLabel: formatFutureDate(day),
      estimate: Math.max(0, round(blend)),
      low: Math.max(0, round(blend - uncertainty)),
      high: Math.max(0, round(blend + uncertainty)),
      confidence: day <= 7 ? 88 : day <= 14 ? 78 : day <= 30 ? 68 : day <= 90 ? 58 : 50,
    };
  });
}

/** How long to hold — with honest confidence & risk (short-term more reliable). */
/** Lowest forecast price in the next ~2 weeks (falls back to 30d, then 90d). */
export function pickNearTermBest(extendedForecast, maxDay = 14) {
  const future = (extendedForecast || []).filter((f) => f.day > 0 && f.day <= 90);
  if (!future.length) return null;
  const nearTerm = future.filter((f) => f.day <= maxDay);
  const pool = nearTerm.length ? nearTerm : future.filter((f) => f.day <= 30);
  const search = pool.length ? pool : future;
  return search.reduce((a, b) => (a.estimate <= b.estimate ? a : b));
}

/** Near-term forecast low only when it is below today's price (a real dip). */
export function pickNearTermDip(current, extendedForecast, maxDay = 14) {
  if (!Number.isFinite(current)) return null;
  const best = pickNearTermBest(extendedForecast, maxDay);
  if (!best || best.estimate >= current) return null;
  return best;
}

export function hasForecastDip(current, estimate) {
  return Number.isFinite(current) && Number.isFinite(estimate) && estimate < current;
}

/** Firm hold = forecast shows a real dip below today's price. */
export function isFirmHold(guide, holdOutlook = null) {
  return !!(guide?.hasNearTermDip || holdOutlook?.hasDip);
}

function buildGuideSummary({
  action,
  current,
  targetPrice,
  savingsVsNowPpl,
  savingsVsNowPct,
  savingsVsAvgPpl,
  ma30,
  kind,
  stretchTarget,
  stretchSavings,
  nearTermDay,
  nearTermDateLabel,
}) {
  const when =
    nearTermDay > 0
      ? nearTermDay <= 7
        ? `in about ${nearTermDay} day${nearTermDay > 1 ? "s" : ""}`
        : `around ${nearTermDateLabel || `day ${nearTermDay}`}`
      : "soon";

  if (action === "buy_now") {
    return savingsVsAvgPpl != null && savingsVsAvgPpl > 0
      ? `Buy at ${formatPence(current)}/L now — that's ${formatPence(savingsVsAvgPpl)} cheaper per litre than the recent average (${formatPence(ma30)}/L).`
      : `Buy at ${formatPence(current)}/L now — you're at a good price before it likely rises.`;
  }

  if (savingsVsNowPpl >= 0.5) {
    let text =
      kind === "diesel"
        ? `Wait ${when} for about ${formatPence(targetPrice)}/L at the pump — could save ${formatPence(savingsVsNowPpl)}/L (${savingsVsNowPct}%) vs today's ${formatPence(current)}/L.`
        : `Wait ${when} for about ${formatPence(targetPrice)}/L — could save ${formatPence(savingsVsNowPpl)}/L (${savingsVsNowPct}%) vs today's ${formatPence(current)}/L.`;
    if (stretchTarget != null && stretchSavings > savingsVsNowPpl + 1) {
      text += ` A deeper dip near ${formatPence(stretchTarget)}/L is possible later, but that's less certain.`;
    }
    return text;
  }

  if (savingsVsAvgPpl != null && savingsVsAvgPpl < -1) {
    return kind === "diesel"
      ? `Today's ${formatPence(current)}/L is ${formatPence(Math.abs(savingsVsAvgPpl))}/L above the recent average — only a small dip is forecast soon; hold off filling up if you can.`
      : `Today's ${formatPence(current)}/L is ${formatPence(Math.abs(savingsVsAvgPpl))}/L above the recent average — only a small dip is forecast soon; hold if you can.`;
  }

  if (savingsVsNowPpl > 0) {
    return kind === "diesel"
      ? `Only a tiny dip (~${formatPence(savingsVsNowPpl)}/L) is forecast ${when} — prices look high, but savings may be minimal.`
      : `Only a tiny dip (~${formatPence(savingsVsNowPpl)}/L) is forecast ${when} — prices look high, but savings may be minimal.`;
  }

  return kind === "diesel"
    ? `${formatPence(current)}/L looks high, and no cheaper dip is forecast — waiting is risky if prices rise. Fill now if your tank is low.`
    : `${formatPence(current)}/L looks high, and no cheaper dip is forecast — waiting is risky if prices rise. Order now if your tank is low.`;
}

export function buildHoldOutlook({
  current,
  verdict,
  extendedForecast,
  predictionIndicators = null,
  history = null,
  newsSentiment = null,
  guide = null,
  kind = "heating",
}) {
  if (!Number.isFinite(current) || (verdict !== "wait" && verdict !== "watch")) return null;

  const dip = pickNearTermDip(current, extendedForecast);
  const flat = pickNearTermBest(extendedForecast);
  if (!dip && !flat) return null;

  const best = dip || flat;
  const vol = predictionIndicators?.volatility || 0;
  const histLen = Array.isArray(history) ? history.length : 0;
  const savings = dip ? Math.max(0, Math.round((current - dip.estimate) * 10) / 10) : 0;
  const hasDip = !!dip && dip.estimate < current * 0.995;

  let holdDaysMin = hasDip ? best.day : 1;
  let holdDaysMax = hasDip
    ? Math.min(90, best.day + Math.max(2, Math.ceil((vol || 1) * 0.4)))
    : 7;

  let confidence = "medium";
  let risk = "moderate";
  const risks = [];

  if (best.day <= 7 && hasDip && histLen >= 5 && vol < current * 0.018) {
    confidence = "high";
    risk = "low";
  } else if (best.day <= 14 && hasDip) {
    confidence = "medium";
    risk = "moderate";
  } else if (best.day <= 30) {
    confidence = "low";
    risk = "higher";
    risks.push("Beyond 2 weeks, hold time is mostly seasonal guesswork — recheck weekly.");
  } else {
    confidence = "low";
    risk = "high";
    risks.push("Long holds are risky — global news can move prices before any dip.");
  }

  if (histLen < 5) {
    risks.push(
      kind === "diesel"
        ? "Few local pump readings stored yet — forecast leans on UK diesel patterns until memory builds."
        : "Few local readings stored — uses UK diesel patterns until history builds."
    );
    if (confidence === "high") confidence = "medium";
  }
  if (kind === "diesel") {
    risks.push("Forecourt prices differ by station — shop around if you must fill before the dip.");
  }
  if (vol > current * 0.02) {
    risks.push("Prices are swinging — the dip may come sooner or later than shown.");
    risk = risk === "low" ? "moderate" : risk;
  }
  if (newsSentiment?.priceDirection === "up" && verdict === "wait") {
    risks.push("News points up — waiting has risk that prices rise before the dip.");
    risk = "higher";
  }
  if (!hasDip) {
    risks.push("No clear dip in the next 2 weeks — holding is a soft wait, not a precise timer.");
    confidence = "low";
  }

  const dayLabel =
    holdDaysMax <= holdDaysMin + 1
      ? `~${holdDaysMin} day${holdDaysMin > 1 ? "s" : ""}`
      : `~${holdDaysMin}–${holdDaysMax} days`;

  const save50 = savings > 0 ? Math.round((savings * 50) / 100 * 100) / 100 : 0;
  const headline = hasDip
    ? kind === "diesel"
      ? `Hold off ~${dayLabel} — target ~${formatPence(dip.estimate)}/L at the pump`
      : `Hold ~${dayLabel} — target ~${formatPence(dip.estimate)}/L (${formatPence(savings)} cheaper)`
    : kind === "diesel"
      ? `High pump price — no dip forecast; waiting may cost more`
      : `High price — no dip forecast; waiting may cost more`;

  const summary = hasDip
    ? confidence === "high"
      ? kind === "diesel" && save50 > 0
        ? `Dip around ${dip.dateLabel} (~${formatPence(dip.estimate)}/L) — could save ~£${save50.toFixed(2)} on a 50L fill.`
        : `Short-term dip around ${dip.dateLabel} is the best guess (fairly reliable for 1–7 days).`
      : confidence === "medium"
        ? `Reasonable dip estimate — recheck every few days before you buy.`
        : `Rough dip estimate only — recheck often; fill now if your tank is nearly empty.`
    : kind === "diesel"
      ? `No cheaper dip forecast. Fill now if you need fuel — prices may rise while you wait.`
      : `No cheaper dip forecast. Order now if your tank is low — prices may rise while you wait.`;

  const riskLabel = hasDip
    ? risk === "low"
      ? "Lower risk wait (dip forecast)"
      : risk === "moderate"
        ? "Moderate risk — recheck in 3–5 days"
        : risk === "higher"
          ? "Higher risk — prices may rise first"
          : "High uncertainty — guide only"
    : "Risky wait — no dip forecast; prices may rise";

  return {
    holdDaysMin,
    holdDaysMax,
    bestDay: hasDip ? dip.day : 0,
    bestDateLabel: hasDip ? dip.dateLabel : null,
    bestPricePpl: hasDip ? dip.estimate : null,
    savingsVsNow: savings,
    hasDip,
    confidence,
    risk,
    riskLabel,
    risks: risks.slice(0, 4),
    headline,
    summary,
    recheckDays: hasDip ? (dip.day <= 7 ? 3 : dip.day <= 14 ? 5 : 7) : 3,
    recheckNote: hasDip
      ? `Recheck this page every ${dip.day <= 7 ? "2–3" : "5–7"} days — hold time updates automatically.`
      : "Recheck this page every 2–3 days — no dip is forecast yet, but prices can move on news.",
    predictable: hasDip
      ? confidence === "high"
        ? "Yes — short holds (under 1 week) are the most predictable."
        : confidence === "medium"
          ? "Partly — 1–2 week holds are educated guesses, not guarantees."
          : "Risky beyond 2 weeks — use weekly rechecks, not a fixed date."
      : "No — without a forecast dip, holding is a guess; prices can rise on news.",
  };
}

/** Actionable buy windows — when to buy before the crowd catches on. */
export function buildWhenToBuyTimeline({
  current,
  verdict,
  extendedForecast,
  guide,
  newsSentiment,
}) {
  const round = (n) => Math.round(n * 10) / 10;
  const future = (extendedForecast || []).filter((f) => f.day > 0);
  if (!future.length || !Number.isFinite(current)) return null;

  const nearTermDip = pickNearTermDip(current, extendedForecast);
  const nearTermBest = pickNearTermBest(extendedForecast);
  const bestFuture = nearTermDip || nearTermBest || future.reduce((a, b) => (a.estimate <= b.estimate ? a : b));
  const longTermBest = future.reduce((a, b) => (a.estimate <= b.estimate ? a : b));
  const hasNearTermDip = !!nearTermDip;

  const windows = future.map((f) => {
    const vsNow = round(f.estimate - current);
    let action = "hold";
    let note = "Fair price expected";
    if (vsNow <= -1.5) {
      action = "wait";
      note = `Wait — could be ~${formatPence(Math.abs(vsNow))}/L cheaper`;
    } else if (vsNow <= -0.4) {
      action = "wait";
      note = "Small dip likely — worth waiting if you can";
    } else if (vsNow >= 1.5) {
      action = "buy_before";
      note = "Prices may rise — buy before the crowd notices";
    } else if (vsNow >= 0.5) {
      action = "buy_soon";
      note = "Trend points up — don't wait too long";
    }
    return { ...f, vsNow, action, note };
  });

  const sixMonth = extendedForecast.find((f) => f.day === 180) || windows[windows.length - 1];
  const tomorrow = extendedForecast.find((f) => f.day === 1);
  const nextWeek = extendedForecast.find((f) => f.day === 7);

  let bestWindow = hasNearTermDip
    ? {
        day: nearTermDip.day,
        label: formatFutureLabel(nearTermDip.day),
        dateLabel: nearTermDip.dateLabel,
        pricePpl: nearTermDip.estimate,
        savingsVsNow: round(Math.max(0, current - nearTermDip.estimate)),
        hasDip: true,
      }
    : {
        day: 0,
        label: "Today",
        dateLabel: formatFutureDate(0),
        pricePpl: current,
        savingsVsNow: 0,
        hasDip: false,
      };

  let headline = guide?.timing || "Watch prices";
  let buyBeforeCrowd = "";

  if (verdict === "buy") {
    headline = "Buy now or tomorrow — you're ahead of the crowd";
    buyBeforeCrowd =
      newsSentiment?.priceDirection === "up"
        ? "News already points up — fill up today before forecourts follow in 1–2 weeks."
        : "Live price is in a buy zone — act before the next weekly rise shows on comparison sites.";
    bestWindow = {
      day: 0,
      label: "Today / tomorrow",
      dateLabel: formatFutureDate(0),
      pricePpl: current,
      savingsVsNow: 0,
    };
  } else if (verdict === "wait" && hasNearTermDip && nearTermDip.day <= 14 && nearTermDip.estimate < current * 0.995) {
    headline = `Hold if you can — best price ~${nearTermDip.day} day${nearTermDip.day > 1 ? "s" : ""} from now`;
    buyBeforeCrowd = `Wait about ${nearTermDip.day} day${nearTermDip.day > 1 ? "s" : ""} for ~${formatPence(current - nearTermDip.estimate)}/L cheaper.`;
  } else if (verdict === "wait") {
    headline = hasNearTermDip
      ? "Hold if you can — prices look high right now"
      : "Price looks high — no dip forecast; waiting is risky";
    buyBeforeCrowd = hasNearTermDip
      ? `Today's ${formatPence(current)}/L is above a good buy zone — wait for a dip if you can.`
      : `${formatPence(current)}/L is high vs recent readings, but no cheaper dip is forecast — don't wait hoping to save.`;
  } else if (hasNearTermDip && nearTermDip.day <= 14 && nearTermDip.estimate < current * 0.995) {
    headline = `Best buy window: ~${bestFuture.day} day${bestFuture.day > 1 ? "s" : ""} from now`;
    buyBeforeCrowd = `Wait about ${nearTermDip.day} day${nearTermDip.day > 1 ? "s" : ""} for ~${formatPence(current - nearTermDip.estimate)}/L cheaper — then buy before news-driven rises.`;
  } else if (hasNearTermDip && nearTermDip.day <= 30) {
    headline = `Lowest near-term price: ~${formatFutureLabel(nearTermDip.day).toLowerCase()}`;
    buyBeforeCrowd = `If you can wait until ${nearTermDip.dateLabel}, target ~${formatPence(nearTermDip.estimate)}/L — but don't miss a good dip this week.`;
  } else if (longTermBest.day > (nearTermBest?.day || 0) && longTermBest.estimate < current * 0.99) {
    headline = "Hold if you can — small dip soon, bigger dip possible later";
    buyBeforeCrowd = `Next 2 weeks: ~${formatPence(bestFuture.estimate)}/L. A deeper dip near ${formatPence(longTermBest.estimate)}/L may come later — less certain.`;
  } else {
    headline = "Buy on dips this month — long-term outlook is seasonal";
    buyBeforeCrowd = `6-month view (~${sixMonth.dateLabel}): ~${formatPence(sixMonth.estimate)}/L. Use weekly dips; don't wait for perfection.`;
  }

  const sixMonthChange = round(sixMonth.estimate - current);
  const sixMonthOutlook =
    sixMonthChange > 2
      ? `6-month prediction: prices likely GO UP to ~${formatPence(sixMonth.estimate)}/L (+${formatPence(sixMonthChange)})`
      : sixMonthChange < -2
        ? `6-month prediction: prices may GO DOWN to ~${formatPence(sixMonth.estimate)}/L (−${formatPence(Math.abs(sixMonthChange))})`
        : `6-month prediction: STEADY around ${formatPence(current)}–${formatPence(sixMonth.estimate)}/L`;

  return {
    headline,
    buyBeforeCrowd,
    bestWindow,
    windows,
    sixMonthOutlook,
    sixMonth: {
      day: sixMonth.day,
      dateLabel: sixMonth.dateLabel,
      pricePpl: sixMonth.estimate,
      changeVsNow: sixMonthChange,
    },
    nextWeek: nextWeek
      ? { day: 7, dateLabel: nextWeek.dateLabel, pricePpl: nextWeek.estimate, vsNow: round(nextWeek.estimate - current) }
      : null,
    tomorrow: tomorrow
      ? { day: 1, dateLabel: tomorrow.dateLabel, pricePpl: tomorrow.estimate, vsNow: round(tomorrow.estimate - current) }
      : null,
  };
}

/** Plain-English when to buy, target price, and savings vs now / average. */
export function buildBuyGuide({
  current,
  verdict,
  trend,
  forecast,
  extendedForecast = null,
  ma7,
  ma30,
  prices,
  model = null,
  newsSentiment = null,
  kind = "heating",
}) {
  const round = (n) => Math.round(n * 10) / 10;
  const hist = (prices || []).filter(Number.isFinite);
  const recentLow = hist.length ? Math.min(...hist, current) : current;
  const recentHigh = hist.length ? Math.max(...hist, current) : current;

  const forecastAll = [{ day: 0, estimate: current, label: "Today" }, ...forecast];
  const forecastMin = forecastAll.reduce((a, b) => (a.estimate <= b.estimate ? a : b));
  const forecastMax = forecastAll.reduce((a, b) => (a.estimate >= b.estimate ? a : b));
  const extPoints =
    extendedForecast ||
    forecastAll.map((f) => ({
      day: f.day,
      label: formatFutureLabel(f.day),
      dateLabel: formatFutureDate(f.day),
      estimate: f.estimate,
    }));
  const nearTermDip = pickNearTermDip(current, extPoints);
  const nearTermBest = pickNearTermBest(extPoints);
  const hasNearTermDip = !!nearTermDip;
  const longTermBest = extPoints.filter((f) => f.day > 14).reduce(
    (best, f) => (!best || f.estimate < best.estimate ? f : best),
    null
  );

  let targetPrice = current;
  let timing = "Fair price — no rush";
  let timingShort = "Hold";
  let action = "hold";

  if (verdict === "buy") {
    targetPrice = current;
    timingShort = "Buy now";
    timing = "Buy now — today or tomorrow";
    action = "buy_now";
  } else if (verdict === "wait") {
    targetPrice = nearTermDip
      ? round(nearTermDip.estimate)
      : round(current);
    timingShort = nearTermDip?.day ? `Hold ~${nearTermDip.day}d` : "Recheck";
    timing = nearTermDip?.day
      ? `Hold ~${nearTermDip.day} day${nearTermDip.day > 1 ? "s" : ""} — target ~${formatPence(targetPrice)}/L`
      : "Hold and recheck — price looks high but no dip forecast soon";
    action = "wait";
  } else if (trend.slope < -0.08 && forecastMin.day > 0 && forecastMin.estimate < current * 0.995) {
    targetPrice = round(nearTermDip?.estimate ?? forecastMin.estimate);
    const dipDay = nearTermDip?.day ?? forecastMin.day;
    timingShort = `Wait ~${dipDay}d`;
    timing = `Wait about ${dipDay} day${dipDay > 1 ? "s" : ""} — trend still falling`;
    action = "wait_for_dip";
  } else if (verdict === "watch") {
    targetPrice = round(nearTermDip?.estimate ?? Math.min(current, forecastMin.estimate));
    timingShort = nearTermDip?.day ? `Watch ~${nearTermDip.day}d` : "Buy soon";
    timing =
      hasNearTermDip && targetPrice < current * 0.995
        ? `Best window may be in ~${nearTermDip.day} days (~${formatPence(targetPrice)}/L)`
        : "Buy soon if you need fuel — price is fair";
    action = "watch";
  }

  const savingsVsAvgPpl = ma30 != null ? round(ma30 - current) : null;
  const savingsVsAvgPct = ma30 != null && ma30 > 0 ? round(((ma30 - current) / ma30) * 100) : null;

  const whenToBuy = buildWhenToBuyTimeline({
    current,
    verdict,
    extendedForecast: extPoints,
    guide: { timing, action },
    newsSentiment,
  });

  if (whenToBuy?.headline) {
    if (action === "buy_now") {
      timing = whenToBuy.headline;
      timingShort = "Buy now";
    } else if (action === "wait" || action === "wait_for_dip") {
      timing =
        kind === "diesel" && whenToBuy.headline.includes("Hold")
          ? whenToBuy.headline.replace(/^Hold if you can/i, "Hold off filling up")
          : whenToBuy.headline.includes("Hold")
            ? whenToBuy.headline
            : timing;
      timingShort =
        whenToBuy.bestWindow?.day > 0
          ? kind === "diesel"
            ? `Don't fill ~${whenToBuy.bestWindow.day}d`
            : `Hold ~${whenToBuy.bestWindow.day}d`
          : kind === "diesel"
            ? "Hold off fill"
            : "Hold";
    } else if (action === "watch") {
      timing = whenToBuy.headline;
      timingShort = whenToBuy.bestWindow?.day > 0 ? `Watch ~${whenToBuy.bestWindow.day}d` : "Watch";
    }
  }

  const guideHasDip = whenToBuy?.bestWindow?.hasDip ?? hasNearTermDip;
  const finalTarget =
    action !== "buy_now"
      ? guideHasDip && whenToBuy?.bestWindow?.pricePpl != null
        ? whenToBuy.bestWindow.pricePpl
        : targetPrice
      : targetPrice;
  const finalSavingsVsNow = round(Math.max(0, current - finalTarget));
  const finalSavingsVsNowPct = current > 0 ? round((finalSavingsVsNow / current) * 100) : 0;
  const stretchTarget =
    longTermBest &&
    longTermBest.estimate < current - 0.5 &&
    longTermBest.day > (whenToBuy?.bestWindow?.day || nearTermDip?.day || 0)
      ? round(longTermBest.estimate)
      : null;
  const stretchSavings = stretchTarget != null ? round(Math.max(0, current - stretchTarget)) : 0;
  const nearTermDay = guideHasDip ? (whenToBuy?.bestWindow?.day ?? nearTermDip?.day ?? 0) : 0;
  const nearTermDateLabel = guideHasDip
    ? whenToBuy?.bestWindow?.dateLabel ?? nearTermDip?.dateLabel ?? null
    : null;

  const summary = buildGuideSummary({
    action,
    current,
    targetPrice: finalTarget,
    savingsVsNowPpl: finalSavingsVsNow,
    savingsVsNowPct: finalSavingsVsNowPct,
    savingsVsAvgPpl,
    ma30,
    kind,
    stretchTarget,
    stretchSavings,
    nearTermDay,
    nearTermDateLabel,
  });

  const finalActiveSave =
    action === "buy_now" && savingsVsAvgPpl > 0
      ? savingsVsAvgPpl
      : finalSavingsVsNow > 0
        ? finalSavingsVsNow
        : 0;
  const finalSavingsTable = buildSavingsTable({ savingsPpl: finalActiveSave, kind });
  const finalBestSave = finalSavingsTable.length ? finalSavingsTable[finalSavingsTable.length - 1] : null;
  let finalSavingsHeadline = "";
  if (finalBestSave && finalBestSave.savePounds > 0) {
    finalSavingsHeadline =
      action === "buy_now"
        ? `Save about £${finalBestSave.savePounds.toFixed(2)} on a ${finalBestSave.label} fill vs the recent average price.`
        : kind === "diesel"
          ? `Could save about £${finalBestSave.savePounds.toFixed(2)} on a ${finalBestSave.label} fill if you wait for the target pump price.`
          : `Could save about £${finalBestSave.savePounds.toFixed(2)} on a ${finalBestSave.label} fill if you wait for the target price.`;
  }

  const examples = {
    heating900L: savingsVsAvgPpl != null ? round((savingsVsAvgPpl * 900) / 100) : null,
    diesel50L: savingsVsAvgPpl != null ? round((savingsVsAvgPpl * 50) / 100) : null,
    wait900L: finalSavingsVsNow > 0 ? round((finalSavingsVsNow * 900) / 100) : null,
    wait50L: finalSavingsVsNow > 0 ? round((finalSavingsVsNow * 50) / 100) : null,
  };

  return {
    timing,
    timingShort,
    action,
    targetPricePpl: finalTarget,
    currentPricePpl: current,
    savingsVsNowPpl: finalSavingsVsNow,
    savingsVsNowPct: finalSavingsVsNowPct,
    savingsVsAveragePpl: savingsVsAvgPpl,
    savingsVsAveragePct: savingsVsAvgPct,
    recentLowPpl: round(recentLow),
    recentHighPpl: round(recentHigh),
    averagePpl: ma30 != null ? round(ma30) : ma7 != null ? round(ma7) : null,
    forecastLowPpl: round(forecastMin.estimate),
    forecastHighPpl: round(forecastMax.estimate),
    forecastLowDay: forecastMin.day,
    forecastHighDay: forecastMax.day,
    nearTermDay,
    nearTermDateLabel,
    hasNearTermDip: guideHasDip,
    firmHold: guideHasDip,
    stretchTargetPpl: stretchTarget,
    stretchSavingsPpl: stretchSavings,
    summary,
    savingsHeadline: finalSavingsHeadline,
    savingsTable: finalSavingsTable,
    examples,
    whenToBuy,
    holdOutlook: null,
    accuracy: model
      ? {
          score: model.score,
          highConfidence: model.highConfidence,
          note: model.backtestNote,
          newsAligned: model.newsAligned,
        }
      : null,
    newsNote: newsSentiment?.summary || null,
  };
}

export function dieselStationKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchDieselWatchlist(station) {
  const name = String(station?.name || "");
  for (const entry of DIESEL_WATCHLIST) {
    if (entry.region && entry.region !== station?.region) continue;
    if (entry.match.test(name)) return entry;
  }
  return null;
}

export function parseCheapestOilIeCounty(html, forLitres = 900) {
  const rows = [];
  const re =
    /data-price300="([\d.]+)"\s+data-price500="([\d.]+)"\s+data-price1000="([\d.]+)"\s+data-supplier="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const price300 = Number(m[1]);
    const price500 = Number(m[2]);
    const price1000 = Number(m[3]);
    const supplier = String(m[4] || "").trim();
    if (!supplier) continue;
    let priceEur = price1000;
    if (forLitres <= 300) priceEur = price300;
    else if (forLitres <= 500) priceEur = price500;
    else priceEur = Math.round((price1000 / 1000) * forLitres * 100) / 100;
    const centsPerLitre = Math.round((priceEur / forLitres) * 10000) / 100;
    rows.push({
      supplier,
      priceEur,
      centsPerLitre,
      price300,
      price500,
      price1000,
      region: "roi",
    });
  }
  rows.sort((a, b) => a.centsPerLitre - b.centsPerLitre);
  return rows;
}

export function heatingPriceForLitres(row, forLitres) {
  if (!row) return null;
  if (forLitres <= 300) return row.price300;
  if (forLitres <= 500) return row.price500;
  return Math.round((row.price1000 / 1000) * forLitres * 100) / 100;
}

export function buildHeatingCrossBorder({ ni, roi, eurGbp, forLitres = 900 }) {
  const niPpl = ni?.cheapestPpl;
  const roiRow = roi?.cheapest;
  if (!Number.isFinite(niPpl) || !roiRow?.centsPerLitre || !Number.isFinite(eurGbp)) return null;
  const roiPplGbp = euroCentsToGbpPpl(roiRow.centsPerLitre, eurGbp);
  if (roiPplGbp == null) return null;
  const niTotalGbp = Math.round(((niPpl * forLitres) / 100) * 100) / 100;
  const roiTotalEur = heatingPriceForLitres(roiRow, forLitres) ?? roiRow.priceEur;
  const roiTotalGbp = euroToGbp(roiTotalEur, eurGbp);
  if (roiTotalGbp == null) return null;
  const cheaperRegion = niTotalGbp <= roiTotalGbp ? "ni" : "roi";
  const savingsGbp = Math.round(Math.abs(niTotalGbp - roiTotalGbp) * 100) / 100;
  const savingsPplGbp = Math.round(Math.abs(niPpl - roiPplGbp) * 10) / 10;
  return {
    forLitres,
    eurGbp,
    ni: {
      ppl: niPpl,
      totalGbp: niTotalGbp,
      supplier: ni?.supplier || "Cheapest NI quote",
    },
    roi: {
      centsPerLitre: roiRow.centsPerLitre,
      euroPerLitre: Math.round((roiRow.centsPerLitre / 100) * 1000) / 1000,
      pplGbp: roiPplGbp,
      totalEur: roiTotalEur,
      totalGbp: roiTotalGbp,
      supplier: roiRow.supplier,
    },
    cheaperRegion,
    savingsGbp,
    savingsPplGbp,
    headline:
      cheaperRegion === "ni"
        ? `NI quote is ~£${savingsGbp.toFixed(2)} cheaper for ${forLitres}L vs Louth (${formatPence(savingsPplGbp)}/L)`
        : `Louth quote is ~£${savingsGbp.toFixed(2)} cheaper for ${forLitres}L vs NI (${formatPence(savingsPplGbp)}/L)`,
  };
}

export function buildDieselCrossBorder({ stations, eurGbp, usualId = "dan-gregorys" }) {
  const list = (stations || []).filter((s) => Number.isFinite(s.pricePpl));
  if (!list.length || !Number.isFinite(eurGbp)) return null;
  const cheapest = list[0];
  const usual = list.find((s) => s.watchlistId === usualId) || list.find((s) => s.usual);
  if (!usual || usual.pricePpl === cheapest.pricePpl) {
    return {
      cheapest,
      usual: usual || null,
      savingsVsUsualPpl: 0,
      savingsVsUsual50LGbp: 0,
      headline: usual
        ? `${usual.watchlistLabel || usual.name} is already the best local price we track.`
        : null,
    };
  }
  const savingsPpl = Math.round((usual.pricePpl - cheapest.pricePpl) * 10) / 10;
  const savings50L = Math.round(((savingsPpl * 50) / 100) * 100) / 100;
  let headline = `Save ${formatPence(savingsPpl)}/L (~£${savings50L.toFixed(2)} on 50L) vs ${usual.watchlistLabel || usual.name}`;
  if (cheapest.region === "roi" && cheapest.priceEuroCents != null) {
    headline += ` — ${cheapest.watchlistLabel || cheapest.name} at ${formatEuro(cheapest.priceEuroCents / 100, { decimals: 3 })}/L (≈ ${formatPence(cheapest.pricePpl)}/L)`;
  }
  return {
    cheapest,
    usual,
    savingsVsUsualPpl: savingsPpl,
    savingsVsUsual50LGbp: savings50L,
    headline,
  };
}

export function mergeDieselStations(niStations, roiStations, eurGbp) {
  const byKey = new Map();
  const add = (station) => {
    const key = `${station.region || "ni"}:${dieselStationKey(station.name)}`;
    const existing = byKey.get(key);
    if (!existing || station.pricePpl < existing.pricePpl) byKey.set(key, station);
  };

  for (const s of niStations || []) {
    const watch = matchDieselWatchlist({ ...s, region: "ni" });
    add({
      ...s,
      region: "ni",
      currency: "GBP",
      watchlistId: watch?.id || null,
      watchlistLabel: watch?.label || null,
      usual: Boolean(watch?.usual),
      priceEuroCents: gbpPplToEuroCents(s.pricePpl, eurGbp),
    });
  }

  for (const s of roiStations || []) {
    const gbpPpl = euroCentsToGbpPpl(s.priceEuroCents, eurGbp);
    if (gbpPpl == null) continue;
    const watch = matchDieselWatchlist({ ...s, region: "roi" });
    add({
      name: s.name,
      brand: s.brand || "",
      pricePpl: gbpPpl,
      priceEuroCents: s.priceEuroCents,
      distanceMiles: s.distanceMiles ?? (s.distanceKm != null ? s.distanceKm * 0.621371 : null),
      region: "roi",
      currency: "EUR",
      watchlistId: watch?.id || null,
      watchlistLabel: watch?.label || null,
      usual: Boolean(watch?.usual),
    });
  }

  const merged = [...byKey.values()].sort((a, b) => a.pricePpl - b.pricePpl);
  const watchlist = [];
  for (const entry of DIESEL_WATCHLIST) {
    const hit = merged.find((s) => s.watchlistId === entry.id);
    if (hit) watchlist.push({ ...entry, station: hit });
  }
  return { stations: merged, watchlist };
}

export async function fetchEurGbpRate() {
  try {
    const res = await fetch(FRANKFURTER_EUR_GBP_URL, {
      headers: { Accept: "application/json", "User-Agent": FUEL_NEAR_YOU_UA },
      cf: { cacheTtl: 3600 },
    });
    if (!res.ok) return { ok: false, error: `Frankfurter HTTP ${res.status}` };
    const data = await res.json();
    const rate = Number(data?.rates?.GBP);
    if (!Number.isFinite(rate) || rate <= 0) return { ok: false, error: "invalid EUR/GBP rate" };
    return {
      ok: true,
      eurGbp: rate,
      date: data.date || new Date().toISOString().slice(0, 10),
      source: DATA_SOURCES.exchangeRate,
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function fetchHeatingOilNi() {
  try {
    const res = await fetch(CHEAPEST_OIL_URL, {
      headers: { Accept: "application/json", "User-Agent": CHEAPEST_OIL_UA },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return { ok: false, error: `CheapestOil HTTP ${res.status}` };
    const data = await res.json();
    const cheapest = normalizePencePerLitre(data.cheapest_ppl);
    const average = normalizePencePerLitre(data.average_ppl);
    if (!cheapest && !average) return { ok: false, error: "invalid heating oil payload" };
    return {
      ok: true,
      region: "ni",
      cheapestPpl: cheapest,
      averagePpl: average,
      forLitres: data.for_litres || 900,
      postcode: data.postcode || HOME.postcode,
      updatedAt: data.last_updated || new Date().toISOString(),
      source: DATA_SOURCES.heatingOilNi,
      supplier: "Cheapest NI quote (BT35)",
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function fetchHeatingOilRoi(forLitres = 900) {
  try {
    const res = await fetch(CHEAPEST_OIL_IE_LOUTH_URL, {
      headers: { Accept: "text/html", "User-Agent": CHEAPEST_OIL_IE_UA },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return { ok: false, error: `CheapestOil.ie HTTP ${res.status}` };
    const html = await res.text();
    const suppliers = parseCheapestOilIeCounty(html, forLitres);
    if (!suppliers.length) return { ok: false, error: "no Louth heating oil quotes parsed" };
    const cheapest = suppliers[0];
    return {
      ok: true,
      region: "roi",
      county: "Louth",
      forLitres,
      cheapest,
      suppliers: suppliers.slice(0, 12),
      updatedAt: new Date().toISOString(),
      source: DATA_SOURCES.heatingOilRoi,
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function fetchHeatingOil() {
  const forLitres = 900;
  const [ni, roi] = await Promise.all([fetchHeatingOilNi(), fetchHeatingOilRoi(forLitres)]);
  const exchange = await fetchEurGbpRate();
  const eurGbp = exchange.ok ? exchange.eurGbp : null;
  const comparison =
    ni.ok && roi.ok && eurGbp != null ? buildHeatingCrossBorder({ ni, roi, eurGbp, forLitres }) : null;

  if (!ni.ok && !roi.ok) {
    return { ok: false, error: ni.error || roi.error || "heating oil unavailable" };
  }

  const cheapestPpl = ni.ok ? ni.cheapestPpl ?? ni.averagePpl : null;
  return {
    ok: true,
    region: "cross-border",
    cheapestPpl,
    averagePpl: ni.ok ? ni.averagePpl : null,
    forLitres,
    postcode: HOME.postcode,
    updatedAt: ni.ok ? ni.updatedAt : roi.updatedAt,
    source: [ni.ok ? DATA_SOURCES.heatingOilNi : null, roi.ok ? DATA_SOURCES.heatingOilRoi : null]
      .filter(Boolean)
      .join(" · "),
    ni: ni.ok ? ni : { ok: false, error: ni.error },
    roi: roi.ok ? roi : { ok: false, error: roi.error },
    exchange: exchange.ok ? { eurGbp, date: exchange.date, source: exchange.source } : { ok: false, error: exchange.error },
    comparison,
  };
}

export async function fetchFuelNearYouPostcode(postcode, { radius = 12, limit = 5 } = {}) {
  const q = encodeURIComponent(postcode);
  const url = `https://fuelnearyou.com/api/v1/dashboard/widget/nearby?postcode=${q}&fuel_type=B7_STANDARD&radius=${radius}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": FUEL_NEAR_YOU_UA },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`FuelNearYou HTTP ${res.status} (${postcode})`);
  const data = await res.json();
  return (data.stations || []).map((s) => ({
    name: String(s.name || "").slice(0, 120),
    brand: String(s.brand || "").trim().slice(0, 60),
    pricePpl: Number(s.price),
    distanceMiles: Number(s.distance_miles),
    postcodeQueried: postcode,
  })).filter((s) => Number.isFinite(s.pricePpl));
}

export function parsePickAPumpStations(data) {
  const list = data?.stations || data?.results || (Array.isArray(data) ? data : []);
  return (Array.isArray(list) ? list : [])
    .map((s) => {
      const price =
        Number(s.diesel) ||
        Number(s.diesel_price) ||
        Number(s.prices?.diesel) ||
        Number(s.fuels?.diesel);
      const distKm = Number(s.distance_km ?? s.distance ?? s.dist);
      return {
        name: String(s.name || s.station_name || s.trading_name || "").slice(0, 120),
        brand: String(s.brand || s.company || "").trim().slice(0, 60),
        priceEuroCents: price,
        distanceKm: Number.isFinite(distKm) ? distKm : null,
        region: "roi",
      };
    })
    .filter((s) => Number.isFinite(s.priceEuroCents) && s.priceEuroCents > 0);
}

export async function fetchPickAPumpDiesel(lat, lng, radiusKm = 15) {
  const url = `https://api.pickapump.com/v1/stations/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": PICK_A_PUMP_UA },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`PickAPump HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("PickAPump returned non-JSON (may be blocked)");
  const data = await res.json();
  return parsePickAPumpStations(data);
}

export async function fetchDieselNearby() {
  try {
    const exchange = await fetchEurGbpRate();
    const eurGbp = exchange.ok ? exchange.eurGbp : 0.857;

    const postcodeResults = await Promise.allSettled(
      FUEL_NEAR_YOU_POSTCODES.map((pc) => fetchFuelNearYouPostcode(pc))
    );
    const niRaw = [];
    for (const r of postcodeResults) {
      if (r.status === "fulfilled") niRaw.push(...r.value);
    }

    let roiRaw = [];
    let roiError = null;
    try {
      roiRaw = await fetchPickAPumpDiesel(HOME.latitude, HOME.longitude, 15);
    } catch (e) {
      roiError = String(e.message || e);
    }

    const { stations, watchlist } = mergeDieselStations(niRaw, roiRaw, eurGbp);
    const cheapest = stations[0] || null;
    const costliest = stations.length ? stations[stations.length - 1] : null;
    const crossBorder = buildDieselCrossBorder({ stations, eurGbp });

    return {
      ok: stations.length > 0,
      postcode: HOME.postcode,
      locationName: HOME.name,
      fuelType: "B7 standard diesel",
      searchRadiusMiles: 12,
      stations,
      watchlist,
      stationCount: stations.length,
      cheapestPpl: cheapest?.pricePpl ?? null,
      highestPpl: costliest?.pricePpl ?? null,
      cheapestStation: cheapest,
      usualStation: crossBorder?.usual || watchlist.find((w) => w.usual)?.station || null,
      crossBorder,
      exchange: exchange.ok
        ? { eurGbp, date: exchange.date, source: exchange.source, fallback: !exchange.ok }
        : { eurGbp, fallback: true, source: "Fallback rate (live rate unavailable)" },
      roi: roiRaw.length
        ? { ok: true, stationCount: roiRaw.length, source: DATA_SOURCES.dieselRoi }
        : { ok: false, error: roiError || "No ROI diesel stations returned" },
      updatedAt: new Date().toISOString(),
      source: [DATA_SOURCES.dieselNi, roiRaw.length ? DATA_SOURCES.dieselRoi : null].filter(Boolean).join(" · "),
      attribution:
        "NI: Fuel Near You (fuelnearyou.com) CC BY 4.0 · ROI: Pick A Pump (euro cents/L) · GBP equivalents use live EUR→GBP",
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Plain-English diesel price context — local pump vs UK average. */
export function buildDieselDisplayMeta(diesel, govSeries = null) {
  if (!diesel?.ok || diesel.cheapestPpl == null) return null;
  const ukLatest = govSeries?.length ? govSeries[govSeries.length - 1].dieselPpl : null;
  const vsUk = ukLatest != null ? Math.round((diesel.cheapestPpl - ukLatest) * 10) / 10 : null;
  const station = diesel.cheapestStation;
  let vsUkLabel = null;
  if (vsUk != null) {
    if (vsUk > 0.5) vsUkLabel = `${formatPence(vsUk)} above UK weekly average`;
    else if (vsUk < -0.5) vsUkLabel = `${formatPence(Math.abs(vsUk))} below UK weekly average`;
    else vsUkLabel = "About the UK weekly average";
  }
  let rangeLabel = null;
  if (diesel.stationCount > 1 && diesel.highestPpl != null && diesel.highestPpl > diesel.cheapestPpl) {
    rangeLabel = `${formatPence(diesel.cheapestPpl)}–${formatPence(diesel.highestPpl)}/L across ${diesel.stationCount} forecourts`;
  }
  return {
    fuelType: diesel.fuelType || "Standard road diesel (B7)",
    priceType: "Pump price per litre (what you pay at the forecourt)",
    radiusMiles: diesel.searchRadiusMiles || 12,
    postcode: diesel.postcode || HOME.postcode,
    locationName: diesel.locationName || HOME.name,
    stationName: station?.name || null,
    stationBrand: station?.brand || null,
    stationDistanceMiles: station?.distanceMiles ?? null,
    ukAvgPpl: ukLatest,
    vsUkAvgPpl: vsUk,
    vsUkLabel,
    rangeLabel,
    highestPpl: diesel.highestPpl ?? null,
    cheapestPpl: diesel.cheapestPpl,
    headline: `Cheapest pump price near ${diesel.locationName || HOME.name} (${diesel.postcode || "BT35"}) — NI & ROI`,
    subtitle: station
      ? `${station.name}${station.brand ? ` (${station.brand})` : ""} · ${station.distanceMiles?.toFixed(1) ?? "?"} mi`
      : null,
    note: "Standard diesel at the pump — not home heating oil or agricultural red diesel.",
  };
}

export async function fetchGovDieselHistory() {
  try {
    const res = await fetch(GOV_DIESEL_CSV, { cf: { cacheTtl: 86400 } });
    if (!res.ok) return { ok: false, error: `Gov CSV HTTP ${res.status}` };
    const text = await res.text();
    const series = parseGovDieselCsv(text);
    return { ok: true, series, source: DATA_SOURCES.dieselHistory };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Persistent memory — daily rollups + recent readings + prediction track record. */
export function createEmptyFuelMemory() {
  const blank = () => ({ low: null, high: null });
  return {
    version: 1,
    updatedAt: null,
    daily: { heating: [], diesel: [] },
    recent: { heating: [], diesel: [] },
    extremes: { heating: blank(), diesel: blank() },
    predictions: [],
    outcomes: { heating: { wins: 0, losses: 0, tracked: 0 }, diesel: { wins: 0, losses: 0, tracked: 0 } },
  };
}

export function appendFuelMemory(memory, kind, point) {
  const mem = memory && memory.version ? memory : createEmptyFuelMemory();
  const price = Number(point?.price);
  if (!Number.isFinite(price) || (kind !== "heating" && kind !== "diesel")) return mem;

  const at = point.at || new Date().toISOString();
  const date = point.date || at.slice(0, 10);
  const recent = [...(mem.recent[kind] || [])];
  const last = recent[recent.length - 1];
  const lastMs = last ? new Date(last.at).getTime() : 0;
  const nowMs = new Date(at).getTime();
  const dupRecent =
    last &&
    last.price === price &&
    Number.isFinite(lastMs) &&
    Number.isFinite(nowMs) &&
    nowMs - lastMs < 25 * 60 * 1000;
  if (!dupRecent) {
    recent.push({ at, date, price });
  }
  mem.recent[kind] = recent.slice(-MEMORY_RECENT_MAX);

  const daily = [...(mem.daily[kind] || [])];
  let day = daily.find((d) => d.date === date);
  if (!day) {
    day = { date, open: price, high: price, low: price, close: price, samples: 1 };
    daily.push(day);
  } else {
    day.high = Math.max(day.high, price);
    day.low = Math.min(day.low, price);
    day.close = price;
    day.samples += 1;
  }
  mem.daily[kind] = daily.slice(-MEMORY_DAILY_MAX);

  const ex = mem.extremes[kind] || { low: null, high: null };
  if (!ex.low || price < ex.low.price) ex.low = { price, date, at };
  if (!ex.high || price > ex.high.price) ex.high = { price, date, at };
  mem.extremes[kind] = ex;
  mem.updatedAt = at;
  return mem;
}

export function migrateLegacyHistory(memory, legacy) {
  let mem = memory && memory.version ? memory : createEmptyFuelMemory();
  if (!legacy) return mem;
  for (const kind of ["heating", "diesel"]) {
    for (const pt of legacy[kind] || []) {
      mem = appendFuelMemory(mem, kind, pt);
    }
  }
  return mem;
}

/** Price series for MA/trend — daily closes + recent intraday for last 3 days. */
export function flattenMemoryPrices(memory, kind) {
  const daily = memory?.daily?.[kind] || [];
  const recent = memory?.recent?.[kind] || [];
  if (!daily.length && !recent.length) return [];

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 3);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const older = daily
    .filter((d) => d.date < cutoffDate)
    .map((d) => ({ price: d.close, date: d.date, at: `${d.date}T12:00:00Z` }));
  const fresh = recent
    .filter((r) => r.date >= cutoffDate)
    .map((r) => ({ price: r.price, date: r.date, at: r.at }));

  const merged = [...older, ...fresh].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const out = [];
  for (const row of merged) {
    const prev = out[out.length - 1];
    if (prev && prev.price === row.price && prev.date === row.date) continue;
    out.push(row);
  }
  return out;
}

export function recordFuelPrediction(memory, kind, signal) {
  const mem = memory && memory.version ? memory : createEmptyFuelMemory();
  if (!signal || signal.current == null || signal.verdict === "unknown") return mem;
  const preds = [...(mem.predictions || [])];
  preds.push({
    at: new Date().toISOString(),
    kind,
    verdict: signal.verdict,
    current: signal.current,
    target: signal.guide?.targetPricePpl ?? null,
    holdDays: signal.holdOutlook?.holdDaysMin ?? null,
  });
  mem.predictions = preds.slice(-MEMORY_PREDICTION_MAX);
  return mem;
}

/** Score whether past wait/buy advice matched what prices did (3–7 days later). */
export function updateFuelMemoryOutcomes(memory, kind, currentPrice) {
  const mem = memory && memory.version ? memory : createEmptyFuelMemory();
  const price = Number(currentPrice);
  if (!Number.isFinite(price)) return mem;

  const now = Date.now();
  const minAge = 3 * 24 * 60 * 60 * 1000;
  const maxAge = 10 * 24 * 60 * 60 * 1000;
  const outcomes = mem.outcomes[kind] || { wins: 0, losses: 0, tracked: 0 };

  for (const pred of mem.predictions || []) {
    if (pred.kind !== kind || pred.scored) continue;
    const age = now - new Date(pred.at).getTime();
    if (age < minAge || age > maxAge) continue;

    const delta = price - pred.current;
    let win = null;
    if (pred.verdict === "wait" || pred.verdict === "watch") {
      win = delta <= -0.5 || (pred.target != null && price <= pred.target + 0.3);
      if (!win && delta >= 1.5) win = false;
      else if (win === null) continue;
    } else if (pred.verdict === "buy") {
      win = delta >= -0.5;
      if (delta >= 2) win = false;
    } else {
      continue;
    }

    pred.scored = true;
    outcomes.tracked += 1;
    if (win) outcomes.wins += 1;
    else outcomes.losses += 1;
  }

  mem.outcomes[kind] = outcomes;
  return mem;
}

export function computeMemoryStats(memory, kind) {
  const daily = memory?.daily?.[kind] || [];
  const recent = memory?.recent?.[kind] || [];
  const flat = flattenMemoryPrices(memory, kind);
  const outcomes = memory?.outcomes?.[kind] || { wins: 0, losses: 0, tracked: 0 };
  const tracked = outcomes.tracked || 0;
  const accuracyPct =
    tracked >= 5 ? Math.round((outcomes.wins / tracked) * 100) : null;
  const ex = memory?.extremes?.[kind] || {};
  const firstDate = daily[0]?.date || recent[0]?.date || null;
  const lastDate = daily[daily.length - 1]?.date || recent[recent.length - 1]?.date || null;
  let days = daily.length;
  if (firstDate && lastDate && firstDate !== lastDate) {
    const span =
      (new Date(`${lastDate}T12:00:00Z`).getTime() - new Date(`${firstDate}T12:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000);
    days = Math.max(days, Math.round(span) + 1);
  }

  let readiness = "building";
  if (days >= 90) readiness = "strong";
  else if (days >= 30) readiness = "good";
  else if (days >= 7) readiness = "fair";

  return {
    kind,
    days,
    dailyPoints: daily.length,
    recentPoints: recent.length,
    readings: flat.length,
    tracked,
    accuracyPct,
    readiness,
    allTimeLow: ex.low || null,
    allTimeHigh: ex.high || null,
    firstDate,
    lastDate,
    note:
      days >= 7
        ? `Memory: ${days} days of local ${kind === "heating" ? "heating oil" : "diesel"} readings stored near Newry.`
        : `Memory building — ${days} day${days === 1 ? "" : "s"} stored so far; accuracy improves as history grows.`,
  };
}

export function buildMemoryPayload(memory) {
  const heating = computeMemoryStats(memory, "heating");
  const diesel = computeMemoryStats(memory, "diesel");
  const bestDays = Math.max(heating.days, diesel.days);
  return {
    version: memory?.version || 1,
    updatedAt: memory?.updatedAt || null,
    heating,
    diesel,
    retentionDays: MEMORY_DAILY_MAX,
    summary:
      bestDays >= 7
        ? `Using up to ${MEMORY_DAILY_MAX} days of stored Newry price memory for better buy/hold calls.`
        : "Storing daily prices — predictions get sharper after about a week of readings.",
  };
}

function historyFromMemory(memory) {
  return {
    heating: flattenMemoryPrices(memory, "heating"),
    diesel: flattenMemoryPrices(memory, "diesel"),
  };
}

export function formatWeekLabel(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Rich trend line — always includes UK weekly history + live readings + now. */
export function buildLiveTrendSeries(govSeries, kvHistory, livePrice, kind, liveDieselPpl) {
  const points = [];
  const gov = (govSeries || []).slice(-20);
  const kv = (kvHistory || []).slice(-40);

  if (kind === "diesel") {
    for (const k of kv) {
      points.push({
        label: k.date || k.at?.slice(0, 10) || "Live",
        price: k.price,
        type: "local_pump",
      });
    }
  } else {
    const latestGov = gov[gov.length - 1]?.dieselPpl;
    const ratio =
      livePrice && latestGov ? livePrice / latestGov : 0.58;
    for (const g of gov) {
      points.push({
        label: formatWeekLabel(g.date),
        price: Math.round(g.dieselPpl * ratio * 10) / 10,
        type: "estimated_weekly",
      });
    }
    for (const k of kv) {
      points.push({
        label: k.date || k.at?.slice(0, 10) || "Live",
        price: k.price,
        type: "live",
      });
    }
  }

  if (livePrice != null) {
    const nowLabel = `Now · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    points.push({ label: nowLabel, price: livePrice, type: "now", live: true });
  }

  return points;
}

export function buildTrendSnapshot(series) {
  if (!series?.length) return null;
  const prices = series.map((p) => p.price).filter(Number.isFinite);
  if (!prices.length) return null;
  const now = prices[prices.length - 1];
  const prev = prices.length > 1 ? prices[prices.length - 2] : now;
  const weekAgo = prices.length > 2 ? prices[prices.length - 3] : prev;
  const monthAgo = prices.length > 5 ? prices[prices.length - 6] : weekAgo;
  const changeRecent = Math.round((now - prev) * 10) / 10;
  const change7d = Math.round((now - weekAgo) * 10) / 10;
  const change30d = Math.round((now - monthAgo) * 10) / 10;
  let direction = "flat";
  if (change7d > 0.4) direction = "up";
  else if (change7d < -0.4) direction = "down";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const label =
    direction === "up"
      ? `Live trend: GOING UP ${arrow} (+${formatPence(change7d)}/L vs last week)`
      : direction === "down"
        ? `Live trend: GOING DOWN ${arrow} (−${formatPence(Math.abs(change7d))}/L vs last week)`
        : `Live trend: STEADY ${arrow} (${formatPence(Math.abs(change7d))}/L change)`;
  return { direction, arrow, changeRecent, change7d, change30d, nowPpl: now, label };
}

export function buildPredictionOutlook(signal) {
  if (!signal?.current || !signal.forecast?.length) return null;
  const day7 = signal.forecast[signal.forecast.length - 1];
  const change = Math.round((day7.estimate - signal.current) * 10) / 10;
  let direction = "steady";
  if (change > 0.5) direction = "up";
  else if (change < -0.5) direction = "down";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const headline =
    direction === "up"
      ? `7-day prediction: GO UP ${arrow} to ~${formatPence(day7.estimate)}/L (+${formatPence(change)})`
      : direction === "down"
        ? `7-day prediction: GO DOWN ${arrow} to ~${formatPence(day7.estimate)}/L (−${formatPence(Math.abs(change))})`
        : `7-day prediction: STEADY ${arrow} around ${formatPence(signal.current)}/L`;
  const detail = `Today ${formatPence(signal.current)}/L → day ${day7.day}: ~${formatPence(day7.estimate)}/L`;
  return {
    direction,
    arrow,
    nowPpl: signal.current,
    day7Ppl: day7.estimate,
    changePpl: change,
    headline,
    detail,
    forecast: signal.forecast,
  };
}

export function buildChartSeries(history, govDiesel, live, trends) {
  const heatingTrend = trends?.heating?.series || [];
  const dieselTrend = trends?.diesel?.series || [];
  const heating = heatingTrend.map((p) => ({
    t: p.label,
    label: p.label,
    heatingPpl: p.price,
    live: p.live,
  }));
  const dieselLocal = dieselTrend.map((p) => ({
    t: p.label,
    label: p.label,
    dieselLocalPpl: p.price,
    live: p.live,
  }));
  const dieselUk = (govDiesel || []).slice(-52).map((g) => ({
    t: g.date,
    label: formatWeekLabel(g.date),
    dieselUkAvgPpl: g.dieselPpl,
  }));
  return { heating, dieselLocal, dieselUk, live, trends };
}

export async function buildFuelResponse(env) {
  const [heating, diesel, gov, news] = await Promise.all([
    fetchHeatingOil(),
    fetchDieselNearby(),
    fetchGovDieselHistory(),
    fetchFuelNews(),
  ]);

  const backtest = gov.ok ? backtestBuyModel(gov.series) : null;

  let memory = createEmptyFuelMemory();
  let legacyHistory = { heating: [], diesel: [] };
  if (env?.PURSUIT_KV) {
    try {
      const rawMem = await env.PURSUIT_KV.get(KV_MEMORY_KEY);
      if (rawMem) memory = JSON.parse(rawMem);
    } catch { /* ignore */ }
    try {
      const rawHist = await env.PURSUIT_KV.get(KV_HISTORY_KEY);
      if (rawHist) legacyHistory = JSON.parse(rawHist);
    } catch { /* ignore */ }
  }
  if (!memory?.version) memory = migrateLegacyHistory(createEmptyFuelMemory(), legacyHistory);
  else if (legacyHistory.heating?.length || legacyHistory.diesel?.length) {
    memory = migrateLegacyHistory(memory, legacyHistory);
  }

  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  if (heating.ok) {
    memory = appendFuelMemory(memory, "heating", {
      at: now,
      date,
      price: heating.cheapestPpl ?? heating.averagePpl,
    });
    memory = updateFuelMemoryOutcomes(memory, "heating", heating.cheapestPpl ?? heating.averagePpl);
  }
  if (diesel.ok && diesel.cheapestPpl != null) {
    memory = appendFuelMemory(memory, "diesel", {
      at: now,
      date,
      price: diesel.cheapestPpl,
    });
    memory = updateFuelMemoryOutcomes(memory, "diesel", diesel.cheapestPpl);
  }

  const history = historyFromMemory(memory);
  const memoryStats = {
    heating: computeMemoryStats(memory, "heating"),
    diesel: computeMemoryStats(memory, "diesel"),
  };

  if (env?.PURSUIT_KV) {
    try {
      await env.PURSUIT_KV.put(KV_MEMORY_KEY, JSON.stringify(memory));
      await env.PURSUIT_KV.put(KV_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
  }

  const newsSentiment = news.ok ? news.sentiment : null;
  const govSeries = gov.ok ? gov.series : null;

  const heatingSignal = analyzeBuySignal({
    current: heating.ok ? heating.cheapestPpl ?? heating.averagePpl : null,
    history: history.heating,
    label: "Heating oil",
    kind: "heating",
    govSeries,
    newsSentiment,
    backtest,
    memoryStats: memoryStats.heating,
  });

  const dieselDisplay = diesel.ok ? buildDieselDisplayMeta(diesel, govSeries) : null;
  const ukDieselPpl = govSeries?.length ? govSeries[govSeries.length - 1].dieselPpl : null;

  const dieselSignal = analyzeBuySignal({
    current: diesel.ok ? diesel.cheapestPpl : null,
    history: history.diesel,
    label: "Diesel at the pump",
    kind: "diesel",
    govSeries,
    newsSentiment,
    backtest,
    memoryStats: memoryStats.diesel,
    dieselContext: dieselDisplay,
  });

  memory = recordFuelPrediction(memory, "heating", heatingSignal);
  memory = recordFuelPrediction(memory, "diesel", dieselSignal);
  if (env?.PURSUIT_KV) {
    try {
      await env.PURSUIT_KV.put(KV_MEMORY_KEY, JSON.stringify(memory));
    } catch { /* ignore */ }
  }

  const heatingPrice = heating.ok ? heating.cheapestPpl ?? heating.averagePpl : null;
  const dieselPrice = diesel.ok ? diesel.cheapestPpl : null;
  const trends = {
    heating: {
      series: buildLiveTrendSeries(govSeries, history.heating, heatingPrice, "heating", dieselPrice),
      snapshot: null,
      prediction: buildPredictionOutlook(heatingSignal),
    },
    diesel: {
      series: buildLiveTrendSeries(govSeries, history.diesel, dieselPrice, "diesel", dieselPrice),
      ukReferencePpl: ukDieselPpl,
      snapshot: null,
      prediction: buildPredictionOutlook(dieselSignal),
    },
  };
  trends.heating.snapshot = buildTrendSnapshot(trends.heating.series);
  trends.diesel.snapshot = buildTrendSnapshot(trends.diesel.series);
  trends.heating.indicators = heatingSignal.predictionIndicators;
  trends.diesel.indicators = dieselSignal.predictionIndicators;

  const chart = buildChartSeries(history, gov.ok ? gov.series : [], { heating, diesel }, trends);
  const alertWorthy = heatingSignal.verdict === "buy" || dieselSignal.verdict === "buy";
  const buyAlert = buildBuyAlertState({
    alertWorthy,
    signals: { heating: heatingSignal, diesel: dieselSignal },
  });

  const payload = {
    ok: heating.ok || diesel.ok,
    fetchedAt: now,
    location: HOME,
    area: { home: HOME, nearby: NEWRY },
    supplier: SAFE_FUELS,
    sources: DATA_SOURCES,
    heating: heating.ok ? heating : { ok: false, error: heating.error },
    diesel: diesel.ok ? { ...diesel, display: dieselDisplay } : { ok: false, error: diesel.error },
    govDiesel: gov.ok ? { latest: gov.series.slice(-1)[0], weeks: gov.series.length } : { ok: false },
    signals: { heating: heatingSignal, diesel: dieselSignal },
    predictionEngine: {
      version: 3,
      method:
        "6-indicator ensemble + persistent Newry price memory (daily rollups, outcome tracking)",
      heating: heatingSignal.predictionIndicators,
      diesel: dieselSignal.predictionIndicators,
    },
    memory: buildMemoryPayload(memory),
    trends,
    news: news.ok ? { sentiment: news.sentiment, sources: news.sources } : { ok: false },
    modelBacktest: backtest,
    chart,
    alertWorthy,
    buyAlert,
    refresh: { clientSeconds: buyAlert.active ? 300 : 900, serverCronUtc: ["06:00", "18:00"] },
    push: { supported: true, tel: SAFE_FUELS.tel, optional: true },
  };

  if (env?.PURSUIT_KV) {
    try {
      await env.PURSUIT_KV.put(KV_CACHE_KEY, JSON.stringify({ at: now, alertWorthy, payload }));
    } catch { /* ignore */ }
  }

  return payload;
}

export function buildNewryFuelManifest(mode = "path") {
  const base = mode === "subdomain" ? "/" : "/newry-fuel/";
  return {
    name: "Newry Fuel Watch",
    short_name: "Fuel Watch",
    description: "Live heating oil & red diesel prices near Newry — green flash when to buy.",
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fff7ed",
    theme_color: "#ea580c",
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${base}apple-touch-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

export function sanitizePushSubscription(body) {
  if (!body || typeof body !== "object") return null;
  const endpoint = String(body.endpoint || "").slice(0, 2048);
  const keys = body.keys || {};
  const p256dh = String(keys.p256dh || "").slice(0, 512);
  const auth = String(keys.auth || "").slice(0, 256);
  if (!endpoint.startsWith("https://")) return null;
  if (!p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth }, createdAt: Date.now() };
}

export async function savePushSubscription(env, sub) {
  if (!env?.PURSUIT_KV || !sub) return { ok: false, error: "unavailable" };
  const raw = await env.PURSUIT_KV.get(KV_PUSH_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  list = list.filter((s) => s.endpoint !== sub.endpoint);
  list.push(sub);
  if (list.length > 200) list = list.slice(-200);
  await env.PURSUIT_KV.put(KV_PUSH_KEY, JSON.stringify(list));
  return { ok: true, count: list.length };
}

export async function getPushSubscriptions(env) {
  if (!env?.PURSUIT_KV) return [];
  try {
    const raw = await env.PURSUIT_KV.get(KV_PUSH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Plain-English diesel hold — pump context + £ fill savings. */
export function buildDieselHoldExplain(signal, dieselContext = null) {
  if (!signal?.current || (signal.verdict !== "wait" && signal.verdict !== "watch")) return null;
  const g = signal.guide;
  const ho = signal.holdOutlook;
  const target = g?.targetPricePpl ?? ho?.bestPricePpl ?? null;
  const savePpl = Math.max(0, Math.round((signal.current - (target ?? signal.current)) * 10) / 10);
  const save50 = savePpl > 0 ? Math.round(((savePpl * 50) / 100) * 100) / 100 : 0;
  const save60 = savePpl > 0 ? Math.round(((savePpl * 60) / 100) * 100) / 100 : 0;
  const station = dieselContext?.stationName || "the cheapest nearby forecourt";

  const firmHold = isFirmHold(g, ho);
  let lead = firmHold
    ? `Pump price at ${station} is ${formatPence(signal.current)}/L — high vs recent readings, but a dip is forecast if you can wait.`
    : `Pump price at ${station} is ${formatPence(signal.current)}/L — high vs recent readings, but no dip is forecast. Waiting is risky.`;
  if (dieselContext?.vsUkLabel && dieselContext.ukAvgPpl != null) {
    lead += ` (${dieselContext.vsUkLabel}; UK avg ${formatPence(dieselContext.ukAvgPpl)}/L).`;
  }

  const detailParts = [];
  if (firmHold && ho?.headline) detailParts.push(ho.headline);
  if (firmHold && target != null && savePpl > 0.3) {
    detailParts.push(
      `Target about ${formatPence(target)}/L — roughly ${formatPence(savePpl)}/L less (~£${save50.toFixed(2)} on a 50L fill, ~£${save60.toFixed(2)} on 60L).`
    );
  } else if (!firmHold) {
    detailParts.push("Forecast is flat or rising — fill now if you need fuel.");
  }

  return {
    title: firmHold ? "Why hold off on diesel?" : "High price — should you wait?",
    lead,
    detail: detailParts.join(" "),
    savePpl,
    save50L: save50,
    save60L: save60,
    targetPpl: target,
    recheck: ho?.recheckNote || "Recheck this page every few days before filling up.",
    exception: "Tank nearly empty? Fill enough to get by — this is guidance, not a rule.",
  };
}

/** Plain-English why buy / hold / watch — shown on alert bar and cards. */
export function buildVerdictWhy(signal) {
  if (!signal?.current) {
    return { summary: null, reasons: [], sources: [] };
  }
  const reasons = [];
  const {
    vs7Pct,
    vs30Pct,
    percentile,
    verdict,
    guide,
    ma7,
    ma30,
    trendSlope,
    kind = "heating",
    dieselContext = null,
  } = signal;

  if (ma7 && vs7Pct > 1) {
    reasons.push(
      `${vs7Pct.toFixed(1)}% above the 7-day average (${formatPence(ma7)}/L) — price has risen lately`
    );
  } else if (ma7 && vs7Pct < -1) {
    reasons.push(
      `${Math.abs(vs7Pct).toFixed(1)}% below the 7-day average (${formatPence(ma7)}/L) — a local dip`
    );
  }

  if (ma30 && vs30Pct > 2) {
    reasons.push(`${vs30Pct.toFixed(1)}% above the 30-day average (${formatPence(ma30)}/L)`);
  } else if (ma30 && vs30Pct < -2) {
    reasons.push(`${Math.abs(vs30Pct).toFixed(1)}% below the 30-day average — unusually cheap`);
  }

  if (percentile >= 85) {
    reasons.push(`In the top ${100 - percentile}% of recent readings — near recent highs`);
  } else if (percentile <= 20) {
    reasons.push(`In the cheapest ${percentile}% of recent readings — strong buy zone`);
  }

  if (trendSlope > 0.15) reasons.push("Short-term trend is rising — don’t wait too long");
  if (trendSlope < -0.15) reasons.push("Trend still falling — a better price may come soon");

  if (guide?.targetPricePpl != null && guide.targetPricePpl < signal.current - 0.3) {
    const savePpl = Math.round((signal.current - guide.targetPricePpl) * 10) / 10;
    if (kind === "diesel") {
      const save50 = Math.round(((savePpl * 50) / 100) * 100) / 100;
      reasons.push(
        `Wait for about ${formatPence(guide.targetPricePpl)}/L at the pump — could save ${formatPence(savePpl)}/L (~£${save50.toFixed(2)} on a 50L fill)`
      );
    } else {
      reasons.push(
        `Wait for about ${formatPence(guide.targetPricePpl)}/L — could save ${formatPence(savePpl)}/L per litre`
      );
    }
  }

  if (kind === "diesel" && (verdict === "wait" || verdict === "watch")) {
    if (dieselContext?.vsUkAvgPpl != null && dieselContext.vsUkAvgPpl > 0.5) {
      reasons.unshift(
        `Pump price is ${formatPence(dieselContext.vsUkAvgPpl)} above the UK weekly average — not a strong fill-up price`
      );
    }
    if (dieselContext?.highestPpl != null && dieselContext.highestPpl > signal.current + 0.5) {
      reasons.push(
        `Cheapest nearby is ${formatPence(signal.current)}/L; others charge up to ${formatPence(dieselContext.highestPpl)}/L — compare forecourts if you must buy today`
      );
    }
  }

  const bestWindow = guide?.whenToBuy?.bestWindow;
  if (
    bestWindow?.hasDip &&
    bestWindow.day > 0 &&
    bestWindow.pricePpl < signal.current &&
    (verdict === "wait" || verdict === "watch")
  ) {
    reasons.push(
      `Forecast dip in ~${bestWindow.day} day${bestWindow.day > 1 ? "s" : ""} (~${formatPence(bestWindow.pricePpl)}/L)`
    );
  } else if ((verdict === "wait" || verdict === "watch") && !bestWindow?.hasDip) {
    reasons.unshift("No cheaper dip forecast — waiting is risky if prices rise");
  }

  for (const r of signal.reasons || []) {
    if (reasons.length >= 4) break;
    if (!bestWindow?.hasDip && verdict === "wait" && r.includes("consider waiting")) continue;
    if (!reasons.some((x) => x.includes(r.slice(0, 20)))) reasons.push(r);
  }

  let summary = reasons[0] || null;
  if (!summary) {
    if (verdict === "wait") {
      summary =
        !guide?.hasNearTermDip
          ? kind === "diesel"
            ? `${formatPence(signal.current)}/L looks high, but no dip is forecast — waiting may cost more`
            : `${formatPence(signal.current)}/L looks high, but no dip is forecast — waiting may cost more`
          : kind === "diesel"
            ? "Pump price looks high vs recent forecourt readings near BT35"
            : "Price looks high compared with recent readings";
    } else if (verdict === "buy") {
      summary =
        kind === "diesel" ? "Good pump price — worth filling up" : "Price is in a favourable buy zone";
    } else if (verdict === "watch") {
      summary =
        kind === "diesel"
          ? "Pump price is fair — watch for a dip before filling"
          : "Price is fair — worth watching for a dip";
    } else summary = "Comparing live price with recent averages and trend";
  }

  return {
    summary,
    reasons: reasons.slice(0, 5),
    sources:
      kind === "diesel"
        ? [
            "Fuel Near You live pump prices near BT35",
            "Stored local forecourt price history",
            "UK gov weekly diesel average (comparison)",
            "BBC fuel news headlines",
          ]
        : [
            "Live CheapestOil quotes near BT35",
            "Your 7 & 30-day price history",
            "UK gov weekly diesel patterns",
            "BBC fuel news headlines",
          ],
  };
}

/** Top banner — buy (green), hold (red), or watch (amber). Fixed + flashing; matches verdict. */
export function buildBuyAlertState({ alertWorthy, signals }) {
  const fuel = [
    { kind: "heating", sig: signals?.heating, label: "Heating oil", icon: "🛢️" },
    { kind: "diesel", sig: signals?.diesel, label: "Diesel", icon: "⛽" },
  ];
  const buckets = { buy: [], hold: [], watch: [] };
  for (const f of fuel) {
    if (!f.sig || f.sig.current == null || f.sig.verdict === "unknown") continue;
    const entry = {
      kind: f.kind,
      label: f.label,
      icon: f.icon,
      pricePpl: f.sig.current,
      headline: f.sig.headline,
      verdict: f.sig.verdict,
      why: f.sig.why || buildVerdictWhy(f.sig),
      holdOutlook: f.sig.holdOutlook || f.sig.guide?.holdOutlook || null,
    };
    if (f.sig.verdict === "buy") buckets.buy.push(entry);
    else if (f.sig.verdict === "wait") {
      if (isFirmHold(f.sig.guide, f.sig.holdOutlook)) buckets.hold.push(entry);
      else buckets.watch.push({ ...entry, softHold: true });
    } else if (f.sig.verdict === "watch") buckets.watch.push(entry);
  }

  let mode = null;
  let items = [];
  if (buckets.buy.length) {
    mode = "buy";
    items = buckets.buy;
  } else if (buckets.hold.length) {
    mode = "hold";
    items = buckets.hold;
  } else if (buckets.watch.length) {
    mode = "watch";
    items = buckets.watch;
  }

  const priceLine = (list) =>
    list.map((i) => `${i.icon} ${i.label} ${formatPence(i.pricePpl)}/L`).join(" · ");

  const allReasons = items.flatMap((i) => i.why?.reasons || []).slice(0, 3);
  const topWhy = items.map((i) => i.why?.summary).find(Boolean);

  let message = null;
  let detail = null;
  if (mode === "buy") {
    message = `Buy now — ${priceLine(items)}`;
    detail = topWhy || "Good time to buy before prices rise.";
  } else if (mode === "hold") {
    const ho = items.find((i) => i.holdOutlook)?.holdOutlook;
    message = ho?.headline || "Hold if you can — prices look high";
    detail = ho?.summary || topWhy || priceLine(items);
  } else if (mode === "watch") {
    const softHold = items.some((i) => i.softHold);
    message = softHold
      ? `High price — no dip forecast · ${priceLine(items)}`
      : "Worth watching — prices may improve soon";
    detail = softHold
      ? "Waiting may not save money — forecast is flat or rising. Fill if you need fuel."
      : topWhy || priceLine(items);
  }

  return {
    active: mode != null,
    mode,
    alertWorthy: !!alertWorthy,
    items,
    message,
    detail,
    why: allReasons,
    holdOutlook: items.find((i) => i.holdOutlook)?.holdOutlook || null,
    howWeKnow: "Live price vs 7 & 30-day averages, trend, UK diesel history, and news.",
  };
}

function alertDedupeKey(signal) {
  return `${signal.label}:${signal.verdict}:${Math.round(signal.current || 0)}`;
}

export async function shouldSendAlert(env, payload) {
  if (!payload?.alertWorthy) return false;
  if (!env?.PURSUIT_KV) return true;
  const key = alertDedupeKey({
    label: "bundle",
    verdict: "buy",
    current: (payload.signals?.heating?.current || 0) + (payload.signals?.diesel?.current || 0),
  });
  const raw = await env.PURSUIT_KV.get(KV_ALERTS_KEY);
  let alerts = {};
  try {
    alerts = raw ? JSON.parse(raw) : {};
  } catch {
    alerts = {};
  }
  const last = alerts[key];
  const now = Date.now();
  if (last && now - last < 6 * 3600 * 1000) return false;
  alerts[key] = now;
  await env.PURSUIT_KV.put(KV_ALERTS_KEY, JSON.stringify(alerts));
  return true;
}

export function buildSlackMessage(payload) {
  const h = payload.signals?.heating;
  const d = payload.signals?.diesel;
  const lines = [
    "‼️ *Newry Fuel Watch — BUY SIGNAL*",
    "",
    h?.current != null
      ? `🛢️ *Heating oil:* ${formatPence(h.current)}/L — ${h.headline}`
      : "🛢️ Heating oil: data unavailable",
    d?.current != null
      ? `⛽ *Diesel near BT35:* ${formatPence(d.current)}/L — ${d.headline}`
      : "⛽ Diesel: data unavailable",
  ];
  if (payload.diesel?.cheapestStation) {
    const s = payload.diesel.cheapestStation;
    lines.push(`📍 Cheapest forecourt: *${s.name}* (${s.brand?.trim()}) — ${formatPence(s.pricePpl)}/L`);
  }
  lines.push(
    "",
    `📞 *Safe Fuels Camlough:* ${SAFE_FUELS.phone}`,
    `<tel:${SAFE_FUELS.tel}|Tap to call>`,
    "",
    "🔮 _Predictive analysis — prices look favourable before the next rise._",
    "https://newry.tgollogly.dev/ · https://tgollogly.dev/newry-fuel/"
  );
  return lines.join("\n");
}

export function buildPushPayload(payload) {
  const h = payload.signals?.heating;
  const d = payload.signals?.diesel;
  const title = "‼️ Good time to buy fuel";
  const parts = [];
  if (h?.verdict === "buy") parts.push(`Oil ${formatPence(h.current)}/L`);
  if (d?.verdict === "buy") parts.push(`Diesel ${formatPence(d.current)}/L`);
  const body = parts.length
    ? `${parts.join(" · ")} — tap to call Safe Fuels`
    : "Prices look favourable near Newry — tap to call Safe Fuels";
  return {
    title,
    body,
    icon: "/newry-fuel/icons/icon-192.png",
    badge: "/newry-fuel/icons/icon-192.png",
    tag: "newry-fuel-buy",
    renotify: true,
    data: {
      url: "https://tgollogly.dev/newry-fuel/?call=1",
      tel: SAFE_FUELS.tel,
      phone: SAFE_FUELS.phone,
    },
  };
}

export async function postSlackAlert(env, text) {
  const url = env?.NEWRY_FUEL_SLACK_WEBHOOK || env?.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, skipped: true, reason: "no webhook" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function dispatchPushAlerts(env, payload) {
  const pub = env?.NEWRY_FUEL_VAPID_PUBLIC;
  const priv = env?.NEWRY_FUEL_VAPID_PRIVATE;
  if (!pub || !priv) return { ok: false, skipped: true, reason: "no vapid keys" };
  const subs = await getPushSubscriptions(env);
  if (!subs.length) return { ok: true, sent: 0, skipped: true, reason: "no subscribers" };
  const vapid = {
    ...(await importVapidKeys(pub, priv)),
    subject: "mailto:thomas@tgollogly.dev",
  };
  const pushBody = buildPushPayload(payload);
  let sent = 0;
  let expired = 0;
  const keep = [];
  for (const sub of subs) {
    const r = await sendWebPush(sub, pushBody, vapid);
    if (r.ok) {
      sent++;
      keep.push(sub);
    } else if (r.expired) {
      expired++;
    } else {
      keep.push(sub);
    }
  }
  if (env?.PURSUIT_KV && (expired || keep.length !== subs.length)) {
    await env.PURSUIT_KV.put(KV_PUSH_KEY, JSON.stringify(keep));
  }
  return { ok: true, sent, expired, total: subs.length };
}

export async function runFuelAlerts(env) {
  const payload = await buildFuelResponse(env);
  if (!payload.ok) return { ok: false, error: "fetch failed", payload };
  const should = await shouldSendAlert(env, payload);
  if (!should) return { ok: true, alerted: false, reason: "deduped or not buy signal" };
  const slack = await postSlackAlert(env, buildSlackMessage(payload));
  const push = await dispatchPushAlerts(env, payload);
  return { ok: true, alerted: true, slack, push, signals: payload.signals };
}

export async function runNewryFuelHealthCheck(env) {
  const checks = {};
  const heating = await fetchHeatingOil();
  checks.heatingOil = { ok: heating.ok, error: heating.error || null };
  const diesel = await fetchDieselNearby();
  checks.diesel = { ok: diesel.ok, error: diesel.error || null, stations: diesel.stations?.length || 0 };
  const gov = await fetchGovDieselHistory();
  checks.govCsv = { ok: gov.ok, weeks: gov.series?.length || 0 };
  checks.kv = { ok: !!env?.PURSUIT_KV };
  checks.slack = { configured: !!(env?.NEWRY_FUEL_SLACK_WEBHOOK || env?.SLACK_WEBHOOK_URL) };
  checks.push = {
    configured: !!(env?.NEWRY_FUEL_VAPID_PUBLIC && env?.NEWRY_FUEL_VAPID_PRIVATE),
  };
  const ok = checks.heatingOil.ok && checks.diesel.ok && checks.govCsv.ok;
  return { ok, service: "newry-fuel", checks, at: new Date().toISOString() };
}

/** Share preview meta — live prices in description when cache available. */
export function buildSharePreviewMeta(payload, origin, mode = "path") {
  const base = mode === "subdomain" ? origin : `${origin}/newry-fuel`;
  const heating = payload?.signals?.heating?.current ?? payload?.heating?.cheapestPpl;
  const diesel = payload?.signals?.diesel?.current ?? payload?.diesel?.cheapestPpl;
  const heatingStr = Number.isFinite(heating) ? `${heating.toFixed(1)}p/L` : null;
  const dieselStr = Number.isFinite(diesel) ? `${diesel.toFixed(1)}p/L` : null;
  let description =
    "Live heating oil & diesel near Newry — green flash when to buy before prices rise.";
  if (heatingStr && dieselStr) {
    description = `🛢️ Heating oil ${heatingStr} · ⛽ Diesel ${dieselStr} near Newry BT35 — know when to buy.`;
  } else if (dieselStr) {
    description = `⛽ Diesel ${dieselStr} near Newry BT35 — live fuel watch with buy alerts.`;
  } else if (heatingStr) {
    description = `🛢️ Heating oil ${heatingStr} near Newry BT35 — live fuel watch with buy alerts.`;
  }
  const ogImage = `${base}/og-preview.png`;
  return {
    title: "Newry Fuel Watch — Heating Oil & Diesel",
    description,
    ogImage,
    ogImageAlt: "Newry Fuel Watch — heating oil and diesel fuel icons",
    twitterCard: "summary_large_image",
    canonical: mode === "subdomain" ? `${origin}/` : `${origin}/newry-fuel/`,
  };
}

export async function getDebugSnapshot(env) {
  let cache = null;
  let history = null;
  let memory = null;
  let subs = 0;
  if (env?.PURSUIT_KV) {
    try {
      cache = JSON.parse(await env.PURSUIT_KV.get(KV_CACHE_KEY));
    } catch { /* ignore */ }
    try {
      history = JSON.parse(await env.PURSUIT_KV.get(KV_HISTORY_KEY));
    } catch { /* ignore */ }
    try {
      memory = JSON.parse(await env.PURSUIT_KV.get(KV_MEMORY_KEY));
    } catch { /* ignore */ }
    subs = (await getPushSubscriptions(env)).length;
  }
  return {
    cache,
    historyPoints: {
      heating: history?.heating?.length || 0,
      diesel: history?.diesel?.length || 0,
    },
    memory: memory ? buildMemoryPayload(memory) : null,
    pushSubscribers: subs,
    slackConfigured: !!(env?.NEWRY_FUEL_SLACK_WEBHOOK || env?.SLACK_WEBHOOK_URL),
    vapidConfigured: !!(env?.NEWRY_FUEL_VAPID_PUBLIC && env?.NEWRY_FUEL_VAPID_PRIVATE),
  };
}
