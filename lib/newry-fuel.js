/** Newry Fuel Watch — live heating oil & diesel near Newry, NI + buy signals. */

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

export const SAFE_FUELS = {
  name: "S.A.F.E Fuels",
  location: "Camlough",
  address: "8 Newry Road, Camlough, Newry BT35 7JP",
  phone: "028 3083 0691",
  tel: "+442830830691",
  note: "Your usual heating oil supplier",
};

export const DATA_SOURCES = {
  heatingOil: "CheapestOil.co.uk (NI quotes, BT35)",
  dieselLive: "Fuel Near You / UK Fuel Finder (CC BY 4.0)",
  dieselHistory: "UK DESNZ weekly road fuel prices (Open Government Licence)",
};

export const CHEAPEST_OIL_URL =
  "https://www.cheapestoil.co.uk/homeassistant/oilprice?postcode=BT35";
export const FUEL_NEAR_YOU_URL =
  "https://fuelnearyou.com/api/v1/dashboard/widget/nearby?postcode=BT35&fuel_type=B7_STANDARD&radius=12&limit=5";
export const GOV_DIESEL_CSV =
  "https://assets.publishing.service.gov.uk/media/6aa801e097b321a2d34ee250/CSV__2018_-__.csv";

const KV_CACHE_KEY = "newry_fuel_snapshot_v1";
const KV_HISTORY_KEY = "newry_fuel_history_v1";
const KV_ALERTS_KEY = "newry_fuel_alerts_v1";
const KV_PUSH_KEY = "newry_fuel_push_subs_v1";
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

export function percentileRank(value, series) {
  if (!series.length || !Number.isFinite(value)) return 0.5;
  const sorted = [...series].sort((a, b) => a - b);
  const below = sorted.filter((v) => v <= value).length;
  return below / sorted.length;
}

/** Predict buy timing from price history + trend. */
export function analyzeBuySignal({ current, history, label, unit = "p/L" }) {
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
    headline = "Hold off if you can — prices look high";
  }

  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    forecast.push({
      day: i,
      estimate: Math.max(0, Math.round((trend.intercept + trend.slope * (recent.length + i)) * 100) / 100),
    });
  }

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
    confidence: Math.min(95, Math.max(25, Math.round(score))),
    reasons,
    forecast,
  };
}

export async function fetchHeatingOil() {
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
      cheapestPpl: cheapest,
      averagePpl: average,
      forLitres: data.for_litres || 900,
      postcode: data.postcode || NEWRY.postcode,
      updatedAt: data.last_updated || new Date().toISOString(),
      source: DATA_SOURCES.heatingOil,
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function fetchDieselNearby() {
  try {
    const res = await fetch(FUEL_NEAR_YOU_URL, {
      headers: { Accept: "application/json", "User-Agent": "NewryFuelWatch/1.0 (+https://tgollogly.dev/newry-fuel/)" },
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) return { ok: false, error: `FuelNearYou HTTP ${res.status}` };
    const data = await res.json();
    const stations = (data.stations || []).map((s) => ({
      name: String(s.name || "").slice(0, 120),
      brand: String(s.brand || "").trim().slice(0, 60),
      pricePpl: Number(s.price),
      distanceMiles: Number(s.distance_miles),
    })).filter((s) => Number.isFinite(s.pricePpl));
    stations.sort((a, b) => a.pricePpl - b.pricePpl);
    const cheapest = stations[0] || null;
    return {
      ok: true,
      postcode: data.postcode || NEWRY.postcode,
      stations,
      cheapestPpl: cheapest?.pricePpl ?? null,
      cheapestStation: cheapest,
      updatedAt: new Date().toISOString(),
      source: DATA_SOURCES.dieselLive,
      attribution: "Fuel Near You (fuelnearyou.com) — CC BY 4.0",
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
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

function appendHistory(existing, point, max = 120) {
  const hist = Array.isArray(existing) ? [...existing] : [];
  const last = hist[hist.length - 1];
  if (!last || last.price !== point.price || last.at !== point.at) {
    hist.push(point);
  }
  return hist.slice(-max);
}

export function buildChartSeries(history, govDiesel, live) {
  const heating = (history?.heating || []).slice(-56).map((h) => ({
    t: h.at,
    label: h.date || h.at?.slice(0, 10),
    heatingPpl: h.price,
  }));
  const dieselLocal = (history?.diesel || []).slice(-56).map((h) => ({
    t: h.at,
    label: h.date || h.at?.slice(0, 10),
    dieselLocalPpl: h.price,
  }));
  const dieselUk = (govDiesel || []).slice(-52).map((g) => ({
    t: g.date,
    label: g.date,
    dieselUkAvgPpl: g.dieselPpl,
  }));
  return { heating, dieselLocal, dieselUk, live };
}

export async function buildFuelResponse(env) {
  const [heating, diesel, gov] = await Promise.all([
    fetchHeatingOil(),
    fetchDieselNearby(),
    fetchGovDieselHistory(),
  ]);

  let history = { heating: [], diesel: [] };
  if (env?.PURSUIT_KV) {
    try {
      const raw = await env.PURSUIT_KV.get(KV_HISTORY_KEY);
      if (raw) history = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  if (heating.ok) {
    history.heating = appendHistory(history.heating, {
      at: now,
      date,
      price: heating.cheapestPpl ?? heating.averagePpl,
    });
  }
  if (diesel.ok && diesel.cheapestPpl != null) {
    history.diesel = appendHistory(history.diesel, {
      at: now,
      date,
      price: diesel.cheapestPpl,
    });
  }
  if (env?.PURSUIT_KV) {
    try {
      await env.PURSUIT_KV.put(KV_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
  }

  const heatingSignal = analyzeBuySignal({
    current: heating.ok ? heating.cheapestPpl ?? heating.averagePpl : null,
    history: history.heating,
    label: "Heating oil",
  });
  const dieselSignal = analyzeBuySignal({
    current: diesel.ok ? diesel.cheapestPpl : null,
    history: history.diesel,
    label: "Diesel (near Newry)",
  });

  const chart = buildChartSeries(history, gov.ok ? gov.series : [], { heating, diesel });
  const alertWorthy = heatingSignal.verdict === "buy" || dieselSignal.verdict === "buy";

  const payload = {
    ok: heating.ok || diesel.ok,
    fetchedAt: now,
    location: NEWRY,
    supplier: SAFE_FUELS,
    sources: DATA_SOURCES,
    heating: heating.ok ? heating : { ok: false, error: heating.error },
    diesel: diesel.ok ? diesel : { ok: false, error: diesel.error },
    govDiesel: gov.ok ? { latest: gov.series.slice(-1)[0], weeks: gov.series.length } : { ok: false },
    signals: { heating: heatingSignal, diesel: dieselSignal },
    chart,
    alertWorthy,
    push: { supported: true, tel: SAFE_FUELS.tel },
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
    description: "Live heating oil & diesel prices near Newry with smart buy alerts.",
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#ea580c",
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
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

export async function getDebugSnapshot(env) {
  let cache = null;
  let history = null;
  let subs = 0;
  if (env?.PURSUIT_KV) {
    try {
      cache = JSON.parse(await env.PURSUIT_KV.get(KV_CACHE_KEY));
    } catch { /* ignore */ }
    try {
      history = JSON.parse(await env.PURSUIT_KV.get(KV_HISTORY_KEY));
    } catch { /* ignore */ }
    subs = (await getPushSubscriptions(env)).length;
  }
  return {
    cache,
    historyPoints: {
      heating: history?.heating?.length || 0,
      diesel: history?.diesel?.length || 0,
    },
    pushSubscribers: subs,
    slackConfigured: !!(env?.NEWRY_FUEL_SLACK_WEBHOOK || env?.SLACK_WEBHOOK_URL),
    vapidConfigured: !!(env?.NEWRY_FUEL_VAPID_PUBLIC && env?.NEWRY_FUEL_VAPID_PRIVATE),
  };
}
