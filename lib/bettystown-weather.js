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
    rows.push({
      ...day,
      icon: wmo.icon,
      summary: wmo.label,
      walkScore: walk.score,
      walkTier: walk.tier,
      walkBreakdown: walk.breakdown,
      sunshineHours: day.sunshineSec != null ? Math.round(day.sunshineSec / 3600 * 10) / 10 : null,
    });
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
  return {
    ok: true,
    location: BETTYSTOWN,
    fetchedAt: meta.fetchedAt || Date.now(),
    source: "open-meteo",
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    current: current
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
      : null,
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
  for (const d of body?.forecast || []) {
    if (d.walkScore == null || d.walkScore < 0 || d.walkScore > 100) issues.push(`bad score ${d.date}`);
  }
  return { ok: issues.length === 0, issues };
}

export async function getBettystownForecast(env, fetchFn = fetch) {
  const cacheKey = "bettystown:forecast:v1";
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

/** PWA manifest with absolute start_url/scope so iOS Home Screen opens weather, not portfolio root. */
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
    const origin = "https://bettystown.tgollogly.dev";
    const start = `${origin}/`;
    return {
      ...shared,
      start_url: start,
      scope: start,
      id: start,
      icons: [
        { src: `${origin}/apple-touch-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
        { src: `${origin}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${origin}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${origin}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
  }

  const start = "https://tgollogly.dev/bettystown/";
  const icons = "https://tgollogly.dev/sites/bettystown";
  return {
    ...shared,
    start_url: start,
    scope: start,
    id: start,
    icons: [
      { src: `${icons}/apple-touch-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
      { src: `${icons}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${icons}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${icons}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
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
