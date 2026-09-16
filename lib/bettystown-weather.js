/** Mom's Bettystown Weather — Open-Meteo forecast + dog-walk scoring (free, no API key). */

export const BETTYSTOWN = {
  name: "Bettystown",
  county: "County Meath",
  country: "Ireland",
  latitude: 53.7014,
  longitude: -6.2461,
  timezone: "Europe/Dublin",
  beach: "Bettystown Beach",
};

export const OPEN_METEO_FORECAST =
  "https://api.open-meteo.com/v1/forecast";

export const FORECAST_PARAMS = {
  latitude: BETTYSTOWN.latitude,
  longitude: BETTYSTOWN.longitude,
  timezone: "auto",
  forecast_days: 14,
  current:
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
  hourly:
    "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m",
  daily:
    "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunshine_duration,uv_index_max",
};

const WMO = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌦️" },
  82: { label: "Heavy showers", icon: "⛈️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm & hail", icon: "⛈️" },
  99: { label: "Thunderstorm & hail", icon: "⛈️" },
};

export function wmoInfo(code) {
  return WMO[code] || { label: "Unknown", icon: "🌡️" };
}

/** 0–100 score: warm, dry, gentle wind — ideal for Mom & Max on the beach. */
export function scoreWalkDay(day) {
  const maxT = Number(day.tempMax);
  const minT = Number(day.tempMin);
  const rainProb = Number(day.rainProb ?? 100);
  const rainMm = Number(day.rainMm ?? 99);
  const wind = Number(day.windMax ?? 99);
  const code = Number(day.weatherCode ?? 99);

  let temp = 0;
  if (Number.isFinite(maxT)) {
    const sweet = 18;
    const spread = Math.abs(maxT - sweet);
    temp = Math.max(0, 40 - spread * 4);
    if (minT < 6) temp -= 15;
    else if (minT < 10) temp -= 8;
    if (maxT > 26) temp -= (maxT - 26) * 2;
  }

  let dry = 0;
  if (Number.isFinite(rainProb)) dry = Math.max(0, 30 - rainProb * 0.3);
  if (rainMm <= 0.2) dry += 8;
  else if (rainMm <= 1) dry += 2;
  else dry -= Math.min(20, rainMm * 4);

  let windScore = 20;
  if (Number.isFinite(wind)) {
    if (wind <= 15) windScore = 20;
    else if (wind <= 25) windScore = 14;
    else if (wind <= 35) windScore = 6;
    else windScore = 0;
  }

  let weatherPenalty = 0;
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) weatherPenalty = 12;
  else if ([51, 53, 55, 45, 48].includes(code)) weatherPenalty = 6;

  const total = Math.round(Math.max(0, Math.min(100, temp + dry + windScore - weatherPenalty)));
  let tier = "fair";
  if (total >= 78) tier = "excellent";
  else if (total >= 62) tier = "good";
  else if (total >= 45) tier = "okay";
  else tier = "poor";

  return { score: total, tier, breakdown: { temp: Math.round(temp), dry: Math.round(dry), wind: windScore } };
}

const STORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES = new Set([61, 63, 65, 80, 81, 82, 95, 96, 99]);
const DRIZZLE_CODES = new Set([51, 53, 55, 45, 48]);

/** Mom-friendly explanation of why a day is or isn't good for beach walks. */
export function explainWalkDay(day, walk = null) {
  const w = walk || scoreWalkDay(day);
  const maxT = Number(day.tempMax);
  const minT = Number(day.tempMin);
  const feelsMax = Number(day.feelsMax ?? maxT);
  const rainProb = Number(day.rainProb ?? 0);
  const rainMm = Number(day.rainMm ?? 0);
  const wind = Number(day.windMax ?? 0);
  const gust = Number(day.windGust ?? wind);
  const code = Number(day.weatherCode ?? 99);
  const sunH = day.sunshineHours ?? (day.sunshineSec != null ? day.sunshineSec / 3600 : null);
  const uv = Number(day.uv ?? 0);

  const negatives = [];
  const positives = [];
  const tips = [];

  if (Number.isFinite(maxT)) {
    if (maxT < 12) negatives.push({ key: "cold", text: `Only ${Math.round(maxT)}° high — chilly for barefoot walks on the sand` });
    else if (maxT < 15) negatives.push({ key: "cool", text: `${Math.round(maxT)}° is a bit cool — bring a jacket for Mom` });
    else if (maxT >= 18 && maxT <= 22) positives.push({ key: "warm", text: `${Math.round(maxT)}° is lovely and warm for the beach` });
    else if (maxT > 26) negatives.push({ key: "hot", text: `${Math.round(maxT)}° is very hot — walk Max early morning or evening` });
    else if (maxT > 23) negatives.push({ key: "warm-hot", text: `${Math.round(maxT)}° is warm — stay in the shade at midday` });
  }

  if (Number.isFinite(minT) && minT < 8) {
    negatives.push({ key: "cold-night", text: `Overnight low ${Math.round(minT)}° — morning may feel brisk` });
  }

  if (feelsMax >= 29) {
    negatives.push({ key: "feels-hot", text: `Feels like ${Math.round(feelsMax)}° — heat stress risk for Max` });
  }

  if (rainProb >= 70 || rainMm >= 3) {
    negatives.push({ key: "rain", text: `${Math.round(rainProb)}% rain chance · ~${rainMm.toFixed(1)} mm expected — wet paws & sand` });
  } else if (rainProb >= 40 || rainMm >= 1) {
    negatives.push({ key: "showers", text: `${Math.round(rainProb)}% chance of showers — pack a light raincoat` });
  } else if (rainProb <= 15 && rainMm <= 0.3) {
    positives.push({ key: "dry", text: "Dry day — low rain risk" });
  }

  if (STORM_CODES.has(code)) {
    negatives.push({ key: "storm", text: "Thunderstorms possible — stay off the open beach" });
  } else if (RAIN_CODES.has(code)) {
    negatives.push({ key: "wet-weather", text: `${wmoInfo(code).label} — not ideal for a long walk` });
  } else if (DRIZZLE_CODES.has(code)) {
    negatives.push({ key: "drizzle", text: "Damp or misty — slippery dunes" });
  } else if (code <= 2) {
    positives.push({ key: "clear", text: "Plenty of clear sky" });
  }

  if (wind >= 40 || gust >= 55) {
    negatives.push({ key: "wind", text: `Wind up to ${Math.round(wind)} km/h (gusts ${Math.round(gust)}) — sand in your eyes` });
  } else if (wind >= 28) {
    negatives.push({ key: "breeze", text: `Breezy at ${Math.round(wind)} km/h — hold onto Max's lead` });
  } else if (wind <= 18) {
    positives.push({ key: "calm", text: "Gentle breeze — perfect for the beach" });
  }

  if (sunH != null && sunH >= 7) positives.push({ key: "sun", text: `${sunH.toFixed(1)} hours of sunshine` });
  else if (sunH != null && sunH < 3) negatives.push({ key: "grey", text: `Only ~${sunH.toFixed(1)}h sunshine — grey day` });

  if (uv >= 8) {
    negatives.push({ key: "uv", text: `UV index ${uv.toFixed(0)} — very high, seek shade for Max` });
    tips.push("Walk before 10am or after 6pm when UV is lower");
  } else if (uv >= 6) {
    tips.push("Sun cream for Mom — UV is moderate to high");
  }

  let verdict = "go";
  let headline = "Good day for Mom & Max on the beach";
  if (w.tier === "poor") {
    verdict = "skip";
    headline = "Not a beach day — stay cosy indoors";
  } else if (w.tier === "okay") {
    verdict = "caution";
    headline = "Maybe — short walk only if rain holds off";
  } else if (w.tier === "good") {
    verdict = "go";
    headline = "Nice day for a beach walk with Max";
  } else if (w.tier === "excellent") {
    verdict = "perfect";
    headline = "Perfect beach day for Mom & Max";
  }

  if (negatives.length && verdict === "go") {
    verdict = "caution";
    headline = "Decent, but watch the weather";
  }

  return {
    headline,
    verdict,
    score: w.score,
    tier: w.tier,
    negatives: negatives.map((r) => r.text),
    positives: positives.map((r) => r.text),
    tips,
  };
}

/** Consecutive dry sunny runs (min 3 days). */
export function detectDrySunnySpells(days, { minDays = 3 } = {}) {
  const spells = [];
  let run = [];

  const isDrySunny = (d) =>
    (d.rainMm ?? 99) <= 0.5 &&
    (d.rainProb ?? 100) <= 35 &&
    !STORM_CODES.has(Number(d.weatherCode)) &&
    (d.sunshineHours ?? 0) >= 3.5 &&
    Number(d.weatherCode) <= 3;

  for (const d of days) {
    if (isDrySunny(d)) run.push(d);
    else {
      if (run.length >= minDays) spells.push(finalizeSpell(run, "dry_sunny"));
      run = [];
    }
  }
  if (run.length >= minDays) spells.push(finalizeSpell(run, "dry_sunny"));
  return spells;
}

function finalizeSpell(run, type) {
  const start = run[0];
  const end = run[run.length - 1];
  const avgHigh = run.reduce((s, d) => s + Number(d.tempMax || 0), 0) / run.length;
  const totalSun = run.reduce((s, d) => s + (d.sunshineHours || 0), 0);
  return {
    type,
    days: run.length,
    startDate: start.date,
    endDate: end.date,
    startLabel: start.label,
    endLabel: end.label,
    avgHigh: Math.round(avgHigh),
    totalSunHours: Math.round(totalSun * 10) / 10,
    message:
      type === "dry_sunny"
        ? `${run.length}-day dry sunny spell · ${start.label} → ${end.label} · ~${Math.round(avgHigh)}° avg`
        : `${run.length}-day spell · ${start.label} → ${end.label}`,
  };
}

/** Heat waves, heat-dome patterns, and extreme heat days (Ireland-coastal thresholds). */
export function detectHeatEvents(days) {
  const events = [];
  const extremeDays = days.filter((d) => Number(d.tempMax) >= 27 || Number(d.feelsMax) >= 29);

  if (extremeDays.length) {
    events.push({
      type: "extreme_heat",
      severity: "high",
      days: extremeDays.length,
      dates: extremeDays.map((d) => d.date),
      labels: extremeDays.map((d) => d.label),
      message: `Extreme heat: ${extremeDays.map((d) => `${d.label} (${Math.round(d.tempMax)}°)`).join(", ")} — avoid midday walks`,
    });
  }

  let heatRun = [];
  for (const d of days) {
    if (Number(d.tempMax) >= 24) heatRun.push(d);
    else {
      if (heatRun.length >= 3) {
        events.push({
          type: "heat_wave",
          severity: heatRun.some((x) => Number(x.tempMax) >= 26) ? "high" : "moderate",
          days: heatRun.length,
          startDate: heatRun[0].date,
          endDate: heatRun[heatRun.length - 1].date,
          startLabel: heatRun[0].label,
          endLabel: heatRun[heatRun.length - 1].label,
          peakTemp: Math.max(...heatRun.map((x) => Number(x.tempMax))),
          message: `${heatRun.length}-day heat wave · ${heatRun[0].label} → ${heatRun[heatRun.length - 1].label} · peak ${Math.round(Math.max(...heatRun.map((x) => Number(x.tempMax))))}°`,
        });
      }
      heatRun = [];
    }
  }
  if (heatRun.length >= 3) {
    events.push({
      type: "heat_wave",
      severity: heatRun.some((x) => Number(x.tempMax) >= 26) ? "high" : "moderate",
      days: heatRun.length,
      startDate: heatRun[0].date,
      endDate: heatRun[heatRun.length - 1].date,
      startLabel: heatRun[0].label,
      endLabel: heatRun[heatRun.length - 1].label,
      peakTemp: Math.max(...heatRun.map((x) => Number(x.tempMax))),
      message: `${heatRun.length}-day heat wave · ${heatRun[0].label} → ${heatRun[heatRun.length - 1].label} · peak ${Math.round(Math.max(...heatRun.map((x) => Number(x.tempMax))))}°`,
    });
  }

  let domeRun = [];
  for (const d of days) {
    const hotDry =
      Number(d.tempMax) >= 22 &&
      (d.rainMm ?? 99) <= 0.3 &&
      (d.rainProb ?? 100) <= 25 &&
      (d.sunshineHours ?? 0) >= 5 &&
      Number(d.weatherCode) <= 2;
    if (hotDry) domeRun.push(d);
    else {
      if (domeRun.length >= 4) {
        events.push({
          type: "heat_dome",
          severity: "moderate",
          days: domeRun.length,
          startDate: domeRun[0].date,
          endDate: domeRun[domeRun.length - 1].date,
          startLabel: domeRun[0].label,
          endLabel: domeRun[domeRun.length - 1].label,
          message: `Heat-dome pattern · ${domeRun.length} days of trapped warm dry air · ${domeRun[0].label} → ${domeRun[domeRun.length - 1].label}`,
        });
      }
      domeRun = [];
    }
  }
  if (domeRun.length >= 4) {
    events.push({
      type: "heat_dome",
      severity: "moderate",
      days: domeRun.length,
      startDate: domeRun[0].date,
      endDate: domeRun[domeRun.length - 1].date,
      startLabel: domeRun[0].label,
      endLabel: domeRun[domeRun.length - 1].label,
      message: `Heat-dome pattern · ${domeRun.length} days of trapped warm dry air · ${domeRun[0].label} → ${domeRun[domeRun.length - 1].label}`,
    });
  }

  return events;
}

/** Weather alerts for extreme conditions. */
export function buildWeatherAlerts(days, current = null) {
  const alerts = [];
  const seen = new Set();

  const add = (alert) => {
    const key = `${alert.type}:${alert.date || alert.dates?.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    alerts.push(alert);
  };

  for (const d of days) {
    const maxT = Number(d.tempMax);
    const minT = Number(d.tempMin);
    const code = Number(d.weatherCode);
    const rainMm = Number(d.rainMm ?? 0);
    const rainProb = Number(d.rainProb ?? 0);
    const wind = Number(d.windMax ?? 0);
    const gust = Number(d.windGust ?? 0);
    const uv = Number(d.uv ?? 0);

    if (STORM_CODES.has(code)) {
      add({ type: "storm", severity: "high", date: d.date, label: d.label, title: "Storm alert", message: `${d.label}: thunderstorms — keep Max indoors` });
    }
    if (rainMm >= 10 || (rainProb >= 90 && rainMm >= 4)) {
      add({ type: "heavy_rain", severity: "high", date: d.date, label: d.label, title: "Heavy rain", message: `${d.label}: ${rainMm.toFixed(1)} mm rain expected` });
    }
    if (wind >= 50 || gust >= 65) {
      add({ type: "high_wind", severity: "high", date: d.date, label: d.label, title: "High wind", message: `${d.label}: gusts to ${Math.round(gust || wind)} km/h on the coast` });
    }
    if (maxT >= 28) {
      add({ type: "heat", severity: "high", date: d.date, label: d.label, title: "Heat alert", message: `${d.label}: ${Math.round(maxT)}° — hot sand, walk early or late` });
    } else if (maxT >= 25) {
      add({ type: "heat", severity: "moderate", date: d.date, label: d.label, title: "Warm spell", message: `${d.label}: ${Math.round(maxT)}° — shade & water for Max` });
    }
    if (uv >= 8) {
      add({ type: "uv", severity: "moderate", date: d.date, label: d.label, title: "High UV", message: `${d.label}: UV ${uv.toFixed(0)} — limit midday sun` });
    }
    if (minT <= 0) {
      add({ type: "frost", severity: "moderate", date: d.date, label: d.label, title: "Frost", message: `${d.label}: freezing overnight — icy paths possible` });
    }
  }

  if (current) {
    const curWind = Number(current.wind ?? 0);
    if (curWind >= 45) {
      add({ type: "live_wind", severity: "moderate", date: "now", label: "Now", title: "Windy now", message: `Currently ${Math.round(curWind)} km/h — hold Max's lead tight` });
    }
  }

  const order = { high: 0, moderate: 1, low: 2 };
  return alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

export function findTomorrow(days, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrowMs = today.getTime() + 86400000;
  return days.find((d) => {
    const dd = new Date(`${d.date}T12:00:00`);
    dd.setHours(0, 0, 0, 0);
    return dd.getTime() === tomorrowMs;
  });
}

export function formatDayLabel(isoDate, now = new Date()) {
  const d = new Date(`${isoDate}T12:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(d);
  cmp.setHours(0, 0, 0, 0);
  const diff = Math.round((cmp - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}

export function buildDailyRows(payload) {
  const daily = payload?.daily;
  if (!daily?.time?.length) return [];
  const rows = [];
  for (let i = 0; i < daily.time.length; i++) {
    const day = {
      date: daily.time[i],
      label: formatDayLabel(daily.time[i]),
      weatherCode: daily.weather_code?.[i],
      tempMax: daily.temperature_2m_max?.[i],
      tempMin: daily.temperature_2m_min?.[i],
      feelsMax: daily.apparent_temperature_max?.[i],
      rainProb: daily.precipitation_probability_max?.[i],
      rainMm: daily.precipitation_sum?.[i],
      windMax: daily.wind_speed_10m_max?.[i],
      windGust: daily.wind_gusts_10m_max?.[i],
      sunshineSec: daily.sunshine_duration?.[i],
      uv: daily.uv_index_max?.[i],
    };
    const wmo = wmoInfo(day.weatherCode);
    const walk = scoreWalkDay(day);
    const enriched = {
      ...day,
      icon: wmo.icon,
      summary: wmo.label,
      walkScore: walk.score,
      walkTier: walk.tier,
      walkBreakdown: walk.breakdown,
      sunshineHours: day.sunshineSec != null ? Math.round(day.sunshineSec / 3600 * 10) / 10 : null,
    };
    rows.push({ ...enriched, explanation: explainWalkDay(enriched, walk) });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function pickBestDaysChronological(days, { max = 5 } = {}) {
  return days
    .filter((d) => d.walkTier === "excellent" || d.walkTier === "good")
    .sort((a, b) => a.date.localeCompare(b.date) || b.walkScore - a.walkScore)
    .slice(0, max);
}

export function buildForecastResponse(payload, meta = {}) {
  const daily = buildDailyRows(payload);
  const best = pickBestDaysChronological(daily);
  const current = payload?.current;
  const curWmo = wmoInfo(current?.weather_code);
  const currentOut = current
    ? {
        temp: current.temperature_2m,
        feels: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
        rain: current.precipitation,
        code: current.weather_code,
        icon: curWmo.icon,
        summary: curWmo.label,
        isDay: current.is_day === 1,
      }
    : null;
  const tomorrow = findTomorrow(daily);
  const drySpells = detectDrySunnySpells(daily);
  const heatEvents = detectHeatEvents(daily);
  const alerts = buildWeatherAlerts(daily, currentOut);
  return {
    ok: true,
    location: BETTYSTOWN,
    fetchedAt: meta.fetchedAt || Date.now(),
    source: "open-meteo",
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    current: currentOut,
    tomorrow: tomorrow || null,
    drySpells,
    heatEvents,
    alerts,
    bestDays: best,
    forecast: daily,
    timezone: payload?.timezone,
    stale: Boolean(meta.stale),
    cacheAgeMs: meta.cacheAgeMs ?? null,
  };
}

export function forecastUrl() {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(FORECAST_PARAMS)) q.set(k, v);
  return `${OPEN_METEO_FORECAST}?${q}`;
}

export async function fetchOpenMeteoForecast(fetchFn = fetch, { retries = 3 } = {}) {
  const url = forecastUrl();
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchFn(url, {
        headers: { Accept: "application/json", "User-Agent": "BettystownWeather/1.0 (tgollogly.dev)" },
      });
      if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      const data = await res.json();
      if (!data?.daily?.time?.length) throw new Error("open-meteo missing daily forecast");
      return { ok: true, data, fetchedAt: Date.now() };
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { ok: false, error: String(lastErr?.message || lastErr) };
}

export function validateForecastResponse(body) {
  const issues = [];
  if (!body?.ok) issues.push("ok=false");
  if (!body?.forecast?.length) issues.push("no forecast");
  if (!body?.current?.temp && body?.current?.temp !== 0) issues.push("no current temp");
  if (!body?.bestDays) issues.push("no bestDays");
  if (!body?.alerts) issues.push("no alerts");
  if (!body?.drySpells) issues.push("no drySpells");
  if (!body?.heatEvents) issues.push("no heatEvents");
  for (const d of body?.forecast || []) {
    if (d.walkScore == null || d.walkScore < 0 || d.walkScore > 100) issues.push(`bad score ${d.date}`);
  }
  return { ok: issues.length === 0, issues };
}

export async function getBettystownForecast(env, fetchFn = fetch) {
  const cacheKey = "bettystown:forecast:v2";
  let cached = null;
  if (env?.PURSUIT_KV) {
    try {
      const raw = await env.PURSUIT_KV.get(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch {
      /* ignore corrupt cache */
    }
  }

  const live = await fetchOpenMeteoForecast(fetchFn);
  if (live.ok) {
    const response = buildForecastResponse(live.data, { fetchedAt: live.fetchedAt });
    if (env?.PURSUIT_KV) {
      await env.PURSUIT_KV.put(cacheKey, JSON.stringify({ at: live.fetchedAt, data: live.data }), {
        expirationTtl: 3600,
      });
    }
    return response;
  }

  if (cached?.data) {
    return buildForecastResponse(cached.data, {
      fetchedAt: cached.at,
      stale: true,
      cacheAgeMs: Date.now() - cached.at,
    });
  }

  return { ok: false, error: live.error || "forecast unavailable", location: BETTYSTOWN };
}

/** PWA manifest — path-relative start_url/scope (resolved from manifest URL, not site root). */
export function buildBettystownManifest(mode = "path") {
  const shared = {
    name: "Mom's Bettystown Weather",
    short_name: "Bettystown",
    description: "Warm, dry beach-walk days at Bettystown for Mom & Max.",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8e6",
    theme_color: "#0077b6",
  };

  if (mode === "subdomain") {
    return {
      ...shared,
      start_url: "/",
      scope: "/",
      id: "/",
      icons: [
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
  }

  return {
    ...shared,
    start_url: "/bettystown/",
    scope: "/bettystown/",
    id: "/bettystown/",
    icons: [
      { src: "/bettystown/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/bettystown/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/bettystown/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/bettystown/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export async function runBettystownHealthCheck(env, fetchFn = fetch) {
  const started = Date.now();
  const result = await getBettystownForecast(env, fetchFn);
  const validation = result.ok ? validateForecastResponse(result) : { ok: false, issues: [result.error] };
  return {
    ok: validation.ok,
    service: "bettystown-weather",
    latencyMs: Date.now() - started,
    stale: Boolean(result.stale),
    forecastDays: result.forecast?.length || 0,
    bestDays: result.bestDays?.length || 0,
    currentTemp: result.current?.temp ?? null,
    issues: validation.issues || [],
    checkedAt: new Date().toISOString(),
  };
}
