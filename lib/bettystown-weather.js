/** Mom's Bettystown Weather — Open-Meteo forecast + dog-walk scoring (free, no API key). */

export const BETTYSTOWN = {
  name: "Bettystown",
  county: "County Meath",
  country: "Ireland",
  /** Fixed pin for Mom & Max (Bettystown beach). */
  latitude: 53.604,
  longitude: -6.246,
  timezone: "Europe/Dublin",
  beach: "Bettystown Beach",
};

export const MET_EIREANN_LEINSTER =
  "https://www.met.ie/Open_Data/json/Leinster.json";
export const MET_EIREANN_NATIONAL =
  "https://www.met.ie/Open_Data/json/National.json";
export const MET_EIREANN_BETTYSTOWN_PAGE =
  "https://www.met.ie/weather-forecast/bettystown-meath";
export const MET_EIREANN_RADAR_PAGE =
  "https://www.met.ie/latest-reports/recent-rainfall-radar/12-hour-rainfall-radar";
export const MET_RADAR_IMAGE_BASE = "https://www.met.ie/images/radar/";

const RADAR_FILENAME_RE = /^web\d{2}_radar\d{2}_\d{12}\.png$/;
const RADAR_FRAME_SCRAPE_RE = /web\d{2}_radar\d{2}_\d{12}\.png/g;
export const RADAR_REFRESH_TTL_SEC = 5 * 60;
export const RADAR_PLAY_FRAME_COUNT = 24;

export const OPEN_METEO_LICENSE_URL = "https://open-meteo.com/en/license";
export const OPEN_METEO_HOME = "https://open-meteo.com/";
export const MET_EIREANN_HOME = "https://www.met.ie/";

/** App owner + data attribution (UI footer and API). */
export function buildBettystownLegal() {
  const year = new Date().getFullYear();
  return {
    copyright: `© ${year} Thomas Gollogly. All rights reserved.`,
    appName: "Mom's Bettystown Weather",
    disclaimer:
      "For personal planning only — not an official Met Éireann forecast, weather warning, or veterinary advice. Walk scores and alerts are automated hints; always use your own judgment and check official sources before travel.",
    dataSources: [
      {
        name: "Open-Meteo",
        url: OPEN_METEO_HOME,
        license: "CC BY 4.0",
        licenseUrl: OPEN_METEO_LICENSE_URL,
        use: "Hourly and daily model data (temperature, rain, wind, etc.)",
      },
      {
        name: "Met Éireann",
        url: MET_EIREANN_HOME,
        license: "Forecast text © Met Éireann",
        licenseUrl: MET_EIREANN_HOME,
        use: "Regional forecast text (Leinster / National open JSON)",
      },
      {
        name: "Met Éireann rainfall radar",
        url: MET_EIREANN_RADAR_PAGE,
        license: "Radar imagery © Met Éireann",
        licenseUrl: MET_EIREANN_HOME,
        use: "12-hour rainfall radar loop (embedded with attribution)",
      },
    ],
    attributionLine:
      "Data: Open-Meteo.com (CC BY 4.0) · Forecast text © Met Éireann · Not affiliated with Met Éireann.",
  };
}

export const OPEN_METEO_FORECAST =
  "https://api.open-meteo.com/v1/forecast";

/** Trusted hourly models — avoids default blend prob/mm mismatches. */
export const OPEN_METEO_HOURLY_MODELS = ["metno_seamless", "ecmwf_ifs025"];

export const FORECAST_PARAMS = {
  latitude: BETTYSTOWN.latitude,
  longitude: BETTYSTOWN.longitude,
  timezone: BETTYSTOWN.timezone,
  forecast_days: 14,
  current:
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
  hourly:
    "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m",
  daily:
    "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunshine_duration,uv_index_max",
};

export const FORECAST_STALE_MS = 2 * 60 * 60 * 1000;
export const FORECAST_REFRESH_TTL_SEC = 45 * 60;

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

/** Format a temperature with an explicit Celsius unit (e.g. 13°C). */
export function formatTempC(value, { fallback = "—°C" } = {}) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `${Math.round(n)}°C`;
}

/** 0–100 score: warm, dry, gentle wind — ideal for Mom & Max on the beach. */
export function scoreWalkDay(day) {
  const maxT = Number(day.tempMax);
  const minT = Number(day.tempMin);
  const bands = day.rainBands;
  const walkMm = bands ? bands.daytime.mm : Number(day.rainMm ?? 99);
  const rainMm = walkMm;
  const rainProb =
    bands && walkMm < 1
      ? Math.min(Number(day.rainProb ?? 100), 40)
      : Number(day.rainProb ?? 100);
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
  const rainyCode = [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  const drizzleCode = [51, 53, 55, 45, 48].includes(code);
  if (rainyCode) weatherPenalty = walkMm >= 1 ? 12 : 4;
  else if (drizzleCode) weatherPenalty = walkMm >= 0.5 ? 6 : 2;

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
    if (maxT < 12) negatives.push({ key: "cold", text: `Only ${formatTempC(maxT)} high — chilly for barefoot walks on the sand` });
    else if (maxT < 15) negatives.push({ key: "cool", text: `${formatTempC(maxT)} is a bit cool — bring a jacket for Mom` });
    else if (maxT >= 18 && maxT <= 22) positives.push({ key: "warm", text: `${formatTempC(maxT)} is lovely and warm for the beach` });
    else if (maxT > 26) negatives.push({ key: "hot", text: `${formatTempC(maxT)} is very hot — walk Max early morning or evening` });
    else if (maxT > 23) negatives.push({ key: "warm-hot", text: `${formatTempC(maxT)} is warm — stay in the shade at midday` });
  }

  if (Number.isFinite(minT) && minT < 8) {
    negatives.push({ key: "cold-night", text: `Overnight low ${formatTempC(minT)} — morning may feel brisk` });
  }

  if (feelsMax >= 29) {
    negatives.push({ key: "feels-hot", text: `Feels like ${formatTempC(feelsMax)} — heat stress risk for Max` });
  }

  const bands = day.rainBands;
  const daytimeMm = bands ? bands.daytime.mm : rainMm;
  const overnightMm = bands?.overnight.mm ?? 0;
  if (bands && overnightMm >= 1.5 && daytimeMm < 1) {
    positives.push({
      key: "overnight-rain",
      text: `Rain mostly overnight (${bands.overnight.text}) — daytime looks ${bands.daytime.text} for walks`,
    });
  } else if (daytimeMm >= 3 || (rainProb >= 70 && daytimeMm >= 1)) {
    negatives.push({
      key: "rain",
      text: `Wet during walk hours (~${daytimeMm.toFixed(1)} mm daytime) — check the coloured times above`,
    });
  } else if (daytimeMm >= 1 || rainProb >= 45) {
    negatives.push({ key: "showers", text: "Showers possible — a light coat for Mom, shorter walk for Max" });
  } else if (daytimeMm <= 0.3 && rainProb <= 25) {
    positives.push({ key: "dry", text: "Dry for daytime walks" });
  }

  if (STORM_CODES.has(code)) {
    negatives.push({ key: "storm", text: "Thunderstorms possible — stay off the open beach" });
  } else if (RAIN_CODES.has(code) && daytimeMm >= 1) {
    negatives.push({ key: "wet-weather", text: `${wmoInfo(code).label} during walk hours — shorter walk for Max` });
  } else if (DRIZZLE_CODES.has(code) && daytimeMm >= 0.5) {
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

  if (bands && daytimeMm < 1 && overnightMm >= 2) {
    const negText = negatives.map((r) => r.text);
    const hardNo = negText.some((t) => /Wet during walk|Thunder|storm|Extreme|UV index 8/i.test(t));
    if (!hardNo) {
      verdict = maxT >= 14 ? "go" : "caution";
      headline =
        maxT >= 14
          ? "Rain overnight — daytime walks look good for Max"
          : "Rain overnight — brisk but dry enough for a short walk after morning";
    }
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
        ? `${run.length}-day dry sunny spell · ${start.label} → ${end.label} · ~${formatTempC(avgHigh)} avg`
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
      message: `Extreme heat: ${extremeDays.map((d) => `${d.label} (${formatTempC(d.tempMax)})`).join(", ")} — avoid midday walks`,
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
          message: `${heatRun.length}-day heat wave · ${heatRun[0].label} → ${heatRun[heatRun.length - 1].label} · peak ${formatTempC(Math.max(...heatRun.map((x) => Number(x.tempMax))))}`,
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
      message: `${heatRun.length}-day heat wave · ${heatRun[0].label} → ${heatRun[heatRun.length - 1].label} · peak ${formatTempC(Math.max(...heatRun.map((x) => Number(x.tempMax))))}`,
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

/** Plain-text confidence band for alert cards (not fake precision). */
export function confidenceForLeadDays(dayOffset, kind = "rain") {
  if (dayOffset <= 1) {
    return kind === "gust"
      ? { text: "~55–65%", note: "1-day" }
      : { text: "~60–80%", note: "1-day pattern" };
  }
  if (dayOffset <= 3) return { text: "~45–60%", note: `${dayOffset}-day` };
  if (dayOffset <= 5) {
    return kind === "gust"
      ? { text: "~25–40%", note: `${dayOffset}-day` }
      : { text: "~45–60%", note: `${dayOffset}-day` };
  }
  if (kind === "gust") return { text: "~15–30%", note: "7-day model hint — may change" };
  return { text: "~25–40%", note: `${dayOffset}-day rain total` };
}

export function formatConfidenceLine(dayOffset, kind = "rain") {
  const c = confidenceForLeadDays(dayOffset, kind);
  return `confidence ${c.text} (${c.note})`;
}

/** Plain English for alert cards (Mom-friendly, not percentages). */
export function momConfidencePlain(dayOffset, kind = "rain") {
  if (dayOffset <= 1) return "Fairly sure for the next day or two";
  if (dayOffset <= 3) return "Reasonably sure — may shift a little";
  if (dayOffset <= 5) return kind === "gust" ? "Early guess — check again soon" : "Moderately sure";
  return "Long-range hint — likely to change";
}

/** Drop or downgrade hours where high rain prob has no mm support (bad default blend). */
export function sanitizeHourlyPrecip(hourly) {
  if (!hourly?.time?.length) return [];
  const rows = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const prob = Number(hourly.precipitation_probability?.[i] ?? 0);
    let mm = Number(hourly.precipitation?.[i] ?? 0);
    let probOut = prob;
    if (prob >= 50 && mm <= 0) {
      mm = 0;
      probOut = Math.min(prob, 35);
    } else if (prob >= 70 && mm < 0.05) {
      mm = 0;
      probOut = 40;
    }
    rows.push({
      time: hourly.time[i],
      precipitation: mm,
      precipitation_probability: probOut,
      wind_gusts_10m: Number(hourly.wind_gusts_10m?.[i] ?? hourly.wind_speed_10m?.[i] ?? 0),
      wind_speed_10m: Number(hourly.wind_speed_10m?.[i] ?? 0),
      weather_code: hourly.weather_code?.[i],
      temperature_2m: hourly.temperature_2m?.[i],
    });
  }
  return rows;
}

/** Merge model hourlies: prefer max mm when any model has support; sanitize each first. */
export function mergeTrustedHourly(primaryHourly, modelPayloads = []) {
  const base = sanitizeHourlyPrecip(primaryHourly);
  const byTime = new Map(base.map((h) => [h.time, { ...h }]));
  for (const payload of modelPayloads) {
    for (const row of sanitizeHourlyPrecip(payload?.hourly)) {
      const cur = byTime.get(row.time);
      if (!cur) {
        byTime.set(row.time, { ...row });
        continue;
      }
      if (row.precipitation > cur.precipitation) cur.precipitation = row.precipitation;
      if (row.precipitation > 0.05) {
        cur.precipitation_probability = Math.max(cur.precipitation_probability, row.precipitation_probability);
      }
      cur.wind_gusts_10m = Math.max(cur.wind_gusts_10m, row.wind_gusts_10m);
    }
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

function hourInBand(isoLocal, startH, endH) {
  const h = Number(isoLocal.slice(11, 13));
  if (startH <= endH) return h >= startH && h <= endH;
  return h >= startH || h <= endH;
}

function hoursForCalendarDay(hourlyRows, ymd) {
  return hourlyRows.filter((r) => r.time.startsWith(`${ymd}T`));
}

/** Overnight = previous calendar day 22:00 → this day 07:00; daytime walk = 08:00–20:00. */
export function buildDayRainBands(hourlyRows, ymd, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  const prevYmd = addDaysYmd(ymd, -1);
  const overnight = hourlyRows.filter((r) => {
    const d = r.time.slice(0, 10);
    const h = Number(r.time.slice(11, 13));
    if (d === prevYmd && h >= 22) return true;
    if (d === ymd && h <= 7) return true;
    return false;
  });
  const daytime = hoursForCalendarDay(hourlyRows, ymd).filter((r) => hourInBand(r.time, 8, 20));
  const sum = (arr) => arr.reduce((s, x) => s + x.precipitation, 0);
  const maxGust = (arr) => arr.reduce((m, x) => Math.max(m, x.wind_gusts_10m || 0), 0);
  const overnightMm = sum(overnight);
  const daytimeMm = sum(daytime);
  const meta = formatDayMeta(ymd, now, timeZone);
  const prevMeta = formatDayMeta(prevYmd, now, timeZone);
  const fmtMm = (mm) => (mm < 0.15 ? "dry" : `~${mm.toFixed(1)} mm`);
  const dayOffset = meta.diff;
  return {
    date: ymd,
    dateLabel: meta.dateShort,
    calendarLabel: meta.dateShort,
    overnight: {
      label: `${prevMeta.dateShort.slice(0, 3)}→${meta.dateShort.slice(0, 3)} night`,
      mm: overnightMm,
      text: fmtMm(overnightMm),
      maxGust: maxGust(overnight),
    },
    daytime: {
      label: `${meta.dateShort.slice(0, 3)} 8 am–8 pm`,
      mm: daytimeMm,
      text: fmtMm(daytimeMm),
      maxGust: maxGust(daytime),
    },
    dayOffset,
    confidence: formatConfidenceLine(dayOffset, "rain"),
  };
}

export function rolling6hRainMax(hourlyRows) {
  let max = 0;
  for (let i = 0; i < hourlyRows.length; i++) {
    let sum = 0;
    for (let j = i; j < Math.min(i + 6, hourlyRows.length); j++) sum += hourlyRows[j].precipitation;
    if (sum > max) max = sum;
  }
  return max;
}

export function rolling3hRainMax(hourlyRows, startIndex = 0) {
  let max = 0;
  for (let i = startIndex; i < hourlyRows.length; i++) {
    let sum = 0;
    for (let j = i; j < Math.min(i + 3, hourlyRows.length); j++) sum += hourlyRows[j].precipitation;
    if (sum > max) max = sum;
  }
  return max;
}

export function maxWalkBandLabel(mm, gust) {
  if (mm >= 1.5 || gust >= 70) return "Wet likely";
  if (mm >= 0.4 || gust >= 45) return "Watch";
  return "Good";
}

export function walkBandHourlyRows(hourlyRows, ymd) {
  return hoursForCalendarDay(hourlyRows, ymd).filter((r) => hourInBand(r.time, 8, 20));
}

export function rolling6hRainMaxWalkBand(hourlyRows, ymd) {
  return rolling6hRainMax(walkBandHourlyRows(hourlyRows, ymd));
}

/** Hero windows for today + tomorrow from hourly mm/gusts (Irish local times). */
export function buildMaxWalkScore(hourlyRows, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  const todayYmd = ymdInTimeZone(now, timeZone);
  const tomorrowYmd = addDaysYmd(todayYmd, 1);
  const targets = [todayYmd, tomorrowYmd];
  const lines = [];

  for (const ymd of targets) {
    const meta = formatDayMeta(ymd, now, timeZone);
    const dayHours = hoursForCalendarDay(hourlyRows, ymd).filter((r) => hourInBand(r.time, 8, 20));
    if (!dayHours.length) continue;
    const blocks = [];
    for (let start = 8; start <= 17; start += 3) {
      const end = Math.min(start + 3, 20);
      const slice = dayHours.filter((r) => {
        const h = Number(r.time.slice(11, 13));
        return h >= start && h < end;
      });
      if (!slice.length) continue;
      const mm = slice.reduce((s, x) => s + x.precipitation, 0);
      const gust = slice.reduce((m, x) => Math.max(m, x.wind_gusts_10m || 0), 0);
      const label = maxWalkBandLabel(mm, gust);
      const start12 = start > 12 ? start - 12 : start;
      const end12 = end > 12 ? end - 12 : end;
      const ap = (h) => (h >= 12 ? "pm" : "am");
      const prefix = meta.relative === "today" ? "Today" : meta.relative === "tomorrow" ? meta.dateShort.split(" ").slice(0, 2).join(" ") : meta.dateShort.split(" ").slice(0, 2).join(" ");
      blocks.push({
        prefix,
        range: `${start12}${ap(start)}–${end12}${ap(end)}`,
        label,
        mm,
        gust,
      });
    }
    const good = blocks.filter((b) => b.label === "Good");
    const summary = blocks
      .slice(0, 4)
      .map((b) => `${b.prefix} ${b.range}: ${b.label}`)
      .join(" · ");
    lines.push({ date: ymd, dateShort: meta.dateShort, relative: meta.relative, blocks, summary, goodCount: good.length });
  }

  const headline = lines.map((l) => l.summary).filter(Boolean).join(" · ") || "Check the hourly outlook below.";
  return { headline, days: lines };
}

export function parseMetEireannJson(json) {
  const regions = json?.forecasts?.[0]?.regions;
  if (!Array.isArray(regions)) return null;
  const out = {};
  for (const block of regions) {
    const key = Object.keys(block || {})[0];
    if (key) out[key] = block[key];
  }
  const issuedRaw = out.issued;
  let issuedAt = null;
  if (issuedRaw) {
    const d = new Date(issuedRaw);
    if (!Number.isNaN(d.getTime())) issuedAt = d.getTime();
  }
  const oneLiner = [out.today, out.tonight].filter(Boolean).join(" ").trim().slice(0, 320);
  return {
    region: out.region || "Leinster",
    issuedRaw,
    issuedAt,
    today: out.today || "",
    tonight: out.tonight || "",
    tomorrow: out.tomorrow || "",
    outlook: out.outlook || "",
    oneLiner: String(oneLiner).trim(),
  };
}

export async function fetchMetEireannBrief(fetchFn = fetch) {
  const headers = { Accept: "application/json", "User-Agent": "BettystownWeather/2.0 (tgollogly.dev)" };
  try {
    const [leinsterRes, nationalRes] = await Promise.all([
      fetchFn(MET_EIREANN_LEINSTER, { headers }),
      fetchFn(MET_EIREANN_NATIONAL, { headers }),
    ]);
    const leinster = leinsterRes.ok ? parseMetEireannJson(await leinsterRes.json()) : null;
    const national = nationalRes.ok ? parseMetEireannJson(await nationalRes.json()) : null;
    const issuedAt = Math.max(leinster?.issuedAt || 0, national?.issuedAt || 0) || null;
    const oneLiner =
      leinster?.oneLiner ||
      [leinster?.today, leinster?.tonight].filter(Boolean).join(" ").trim().slice(0, 280) ||
      national?.today?.slice(0, 200) ||
      "";
    return {
      ok: true,
      leinster,
      national,
      issuedAt,
      oneLiner,
      attribution: "Forecast text © Met Éireann",
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

const DRY_PHRASES = /\b(mostly dry|mainly dry|largely dry|dry with|stay dry|few showers|isolated showers)\b/i;

export function metTextSuggestsDry(metBrief, ymd, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  if (!metBrief?.leinster) return false;
  const diff = dayDiffYmd(ymdInTimeZone(now, timeZone), ymd);
  const text =
    diff === 0
      ? `${metBrief.leinster.today} ${metBrief.leinster.tonight}`
      : diff === 1
        ? metBrief.leinster.tomorrow
        : metBrief.leinster.outlook;
  return DRY_PHRASES.test(text || "");
}

export function buildSourceConflictNote(day, metBrief, now = new Date()) {
  if (!metBrief?.ok || !day) return null;
  const rainMm = Number(day.rainMm ?? 0);
  if (rainMm < 8) return null;
  if (!metTextSuggestsDry(metBrief, day.date, now)) return null;
  return {
    type: "source_conflict",
    severity: "moderate",
    title: "Models disagree on timing",
    message: `Met Éireann suggests mostly dry ${day.dateShort}, but models show ~${rainMm.toFixed(0)} mm — much may fall overnight; use radar before walks.`,
    date: day.date,
    label: day.dateShort,
  };
}

export function buildRainHeadline(bands, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  if (!bands) return null;
  const total = bands.overnight.mm + bands.daytime.mm;
  if (total <= 3) return null;
  const meta = formatDayMeta(bands.date, now, timeZone);
  const prevMeta = formatDayMeta(addDaysYmd(bands.date, -1), now, timeZone);
  if (bands.overnight.mm >= 4 && bands.daytime.mm < 2) {
    return `Wet overnight ${prevMeta.dateShort.slice(0, 3)}→${meta.dateShort.slice(0, 3)}; ${meta.dateShort} daytime mostly dry — good for Max after morning clears.`;
  }
  if (bands.daytime.mm >= 4) {
    return `${meta.dateShort} daytime wet (~${bands.daytime.mm.toFixed(1)} mm) — plan walks for drier windows.`;
  }
  return `${meta.dateShort}: overnight ${bands.overnight.text}, daytime ${bands.daytime.text}.`;
}

/** Walk-focused alert tiers — green / amber / red (not everything red). */
export function buildWeatherAlerts(days, current = null, ctx = {}) {
  const alerts = [];
  const seen = new Set();
  const hourlyRows = ctx.hourlyRows || [];
  const metBrief = ctx.metBrief || null;
  const maxWalkByDate = ctx.maxWalkByDate || {};
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const timeZone = ctx.timeZone || BETTYSTOWN.timezone;

  const blocksAllGood = (date) => {
    const blocks = maxWalkByDate[date]?.blocks;
    return blocks?.length && blocks.every((b) => b.label === "Good");
  };
  const blocksAnyWatch = (date) => maxWalkByDate[date]?.blocks?.some((b) => b.label === "Watch");

  const add = (alert) => {
    const key = `${alert.type}:${alert.date || alert.dates?.join(",")}:${alert.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    alerts.push(alert);
  };

  let farOvernightShown = 0;

  for (const d of days) {
    const bands = d.rainBands || buildDayRainBands(hourlyRows, d.date, now, timeZone);
    const dayOffset = bands.dayOffset ?? dayDiffYmd(ymdInTimeZone(now, timeZone), d.date);
    /* Past calendar days roll off — e.g. Wed overnight rain gone once today is Thu. */
    if (dayOffset < 0) continue;

    const maxT = Number(d.tempMax);
    const minT = Number(d.tempMin);
    const code = Number(d.weatherCode);
    const rainMm = Number(d.rainMm ?? 0);
    const rainProb = Number(d.rainProb ?? 0);
    const wind = Number(d.windMax ?? 0);
    const gust = Number(d.windGust ?? 0);
    const uv = Number(d.uv ?? 0);
    const conf = momConfidencePlain(dayOffset, "rain");
    const dateTag = d.dateShort || d.label;

    const conflict = buildSourceConflictNote(d, metBrief, now);
    if (conflict) add({ ...conflict, confidence: conf, tier: "amber" });

    const headline = buildRainHeadline(bands, now, timeZone);
    const dayTotal = bands.overnight.mm + bands.daytime.mm;
    let rainTimingAdded = false;
    if (headline && dayTotal > 3) {
      const overnightOnly = bands.daytime.mm < 2 && bands.overnight.mm >= 4;
      if (overnightOnly && dayOffset > 3) {
        farOvernightShown += 1;
        if (farOvernightShown > 2) continue;
      }
      rainTimingAdded = true;
      let tier = bands.daytime.mm >= 8 ? "red" : bands.daytime.mm >= 2 ? "amber" : "green";
      if (overnightOnly && dayOffset >= 6) tier = "grey";
      else if (overnightOnly && dayOffset >= 3) tier = "amber";
      const title =
        dayOffset >= 6 && overnightOnly
          ? "Long-range · overnight rain"
          : bands.daytime.mm < 2 && bands.overnight.mm >= 4
            ? "Overnight rain"
            : "Rain timing";
      add({
        type: "rain_timing",
        severity: bands.daytime.mm >= 8 ? "high" : "moderate",
        tier,
        date: d.date,
        label: dateTag,
        title,
        message: headline,
        bands,
        confidence: conf,
        leadDays: dayOffset,
      });
    }

    const walkHours = walkBandHourlyRows(hourlyRows, d.date);
    const roll6Walk = walkHours.length ? rolling6hRainMax(walkHours) : 0;
    const roll3Walk = walkHours.length ? rolling3hRainMax(walkHours) : 0;
    const daytimeMm = bands.daytime.mm;
    const daytimeGust = bands.daytime.maxGust;

    let walkTier = "green";
    if (daytimeMm >= 8 || roll6Walk >= 8) walkTier = "red";
    else if (daytimeMm >= 2 || daytimeGust >= 45 || roll6Walk >= 4) walkTier = "amber";

    if (dayOffset <= 1 && walkTier === "green" && daytimeMm < 2 && daytimeGust < 50 && !rainTimingAdded) {
      add({
        type: "walk_ok",
        severity: "low",
        tier: "green",
        date: d.date,
        label: dateTag,
        title: "Good for Max",
        message: `${dateTag}: daytime ${bands.daytime.text}, gusts about ${Math.round(daytimeGust)} km/h on the beach.`,
        bands,
        confidence: conf,
      });
    } else if (dayOffset <= 4 && walkTier === "amber" && !blocksAllGood(d.date)) {
      if (blocksAnyWatch(d.date) || daytimeMm >= 1 || daytimeGust >= 45 || roll6Walk >= 4) {
        add({
          type: "walk_watch",
          severity: "moderate",
          tier: "amber",
          date: d.date,
          label: dateTag,
          title: "Watch the sky",
          message: `${dateTag}: check the yellow slots above — daytime ${bands.daytime.text}, gusts to ~${Math.round(daytimeGust)} km/h.`,
          bands,
          confidence: conf,
        });
      }
    }

    const heavyFromMm = rainMm >= 8 || roll6Walk >= 8;
    const heavyBurst = roll3Walk >= 4;
    const probOnlyHeavy = !heavyFromMm && !heavyBurst && rainProb >= 90 && rainMm >= 4;
    if ((heavyFromMm || heavyBurst) && !rainTimingAdded) {
      const title = heavyBurst ? "Heavy rain burst" : `Wet spell (~${rainMm.toFixed(0)} mm)`;
      add({
        type: "heavy_rain",
        severity: walkTier === "red" ? "high" : "moderate",
        tier: walkTier === "red" ? "red" : "amber",
        date: d.date,
        label: dateTag,
        title,
        message: `${dateTag}: overnight ${bands.overnight.text}, daytime ${bands.daytime.text}.`,
        bands,
        confidence: conf,
      });
    } else if (heavyBurst && rainTimingAdded) {
      add({
        type: "heavy_rain",
        severity: "moderate",
        tier: "amber",
        date: d.date,
        label: dateTag,
        title: "Heavy rain burst",
        message: `${dateTag}: a short sharp shower possible (~${roll3Walk.toFixed(1)} mm in a few hours).`,
        bands,
        confidence: conf,
      });
    } else if (probOnlyHeavy) {
      /* Data-quality: skip heavy-rain alert from probability alone without mm support. */
    }

    if (STORM_CODES.has(code) && dayOffset <= 5) {
      add({
        type: "storm",
        severity: dayOffset <= 2 ? "high" : "moderate",
        tier: dayOffset <= 2 ? "red" : "amber",
        date: d.date,
        label: dateTag,
        title: "Thunder possible",
        message: `${dateTag}: thunderstorms possible — keep Max off the open beach.`,
        confidence: conf,
      });
    }

    const gustConf = momConfidencePlain(dayOffset, "gust");
    if (gust >= 80 && dayOffset <= 2) {
      add({
        type: "high_wind",
        severity: "high",
        tier: "red",
        date: d.date,
        label: dateTag,
        title: "Warning — coastal gusts",
        message: `${dateTag}: gusts up to ${Math.round(gust)} km/h on the exposed beach.`,
        confidence: gustConf,
      });
    } else if ((gust >= 50 || wind >= 50) && dayOffset <= 5) {
      add({
        type: "high_wind",
        severity: gust >= 70 ? "high" : "moderate",
        tier: gust >= 70 ? "red" : "amber",
        date: d.date,
        label: dateTag,
        title: gust >= 70 ? "Strong gusts" : "Breezy on the coast",
        message: `${dateTag}: gusts up to ${Math.round(gust || wind)} km/h — hold Max's lead.`,
        confidence: gustConf,
      });
    } else if (gust >= 80 && dayOffset >= 6) {
      add({
        type: "high_wind_hint",
        severity: "low",
        tier: "grey",
        date: d.date,
        label: dateTag,
        title: "Early model hint",
        message: `${dateTag}: models hint strong gusts — not an official Met warning. Check again in a few days.`,
        confidence: gustConf,
      });
    }

    if (maxT >= 28) {
      add({ type: "heat", severity: "high", tier: "amber", date: d.date, label: dateTag, title: "Heat alert", message: `${dateTag}: ${formatTempC(maxT)} — hot sand; walk early or late.`, confidence: conf });
    } else if (maxT >= 25) {
      add({ type: "heat", severity: "moderate", tier: "amber", date: d.date, label: dateTag, title: "Warm spell", message: `${dateTag}: ${formatTempC(maxT)} — shade and water for Max.`, confidence: conf });
    }
    if (uv >= 8) {
      add({ type: "uv", severity: "moderate", tier: "amber", date: d.date, label: dateTag, title: "High UV", message: `${dateTag}: very strong sun — limit midday walks.`, confidence: conf });
    }
    if (minT <= 0) {
      add({ type: "frost", severity: "moderate", tier: "amber", date: d.date, label: dateTag, title: "Frost", message: `${dateTag}: freezing overnight — icy paths possible.`, confidence: conf });
    }
  }

  if (current) {
    const curWind = Number(current.wind ?? 0);
    if (curWind >= 45) {
      add({ type: "live_wind", severity: "moderate", tier: "amber", date: "now", label: "Now", title: "Windy now", message: `Currently ${Math.round(curWind)} km/h — hold Max's lead tight`, confidence: "~60–80% (nowcast)" });
    }
  }

  const tierOrder = { green: 0, amber: 1, grey: 2, red: 3 };
  const sevOrder = { low: 0, moderate: 1, high: 2 };
  return alerts.sort(
    (a, b) =>
      (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9) ||
      (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9),
  );
}

/** Calendar YYYY-MM-DD in a named timezone (default Ireland). */
export function ymdInTimeZone(date, timeZone = BETTYSTOWN.timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dayDiffYmd(fromYmd, toYmd) {
  const parse = (ymd) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toYmd) - parse(fromYmd)) / 86400000);
}

function formatYmdLabels(isoDate, timeZone = BETTYSTOWN.timezone) {
  const anchor = new Date(`${isoDate}T12:00:00Z`);
  const fmt = (opts) =>
    new Intl.DateTimeFormat("en-IE", { timeZone, ...opts }).format(anchor);
  return {
    dateShort: fmt({ weekday: "short", day: "numeric", month: "short" }),
    dateLong: fmt({ weekday: "long", day: "numeric", month: "long" }),
  };
}

export function findTomorrow(days, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  const tomorrowYmd = addDaysYmd(ymdInTimeZone(now, timeZone), 1);
  return days.find((d) => d.date === tomorrowYmd);
}

export function formatDayMeta(isoDate, now = new Date(), timeZone = BETTYSTOWN.timezone) {
  const todayYmd = ymdInTimeZone(now, timeZone);
  const diff = dayDiffYmd(todayYmd, isoDate);
  const { dateShort, dateLong } = formatYmdLabels(isoDate, timeZone);
  let label = dateShort;
  let relative = null;
  if (diff === 0) {
    label = "Today";
    relative = "today";
  } else if (diff === 1) {
    label = dateShort;
    relative = "tomorrow";
  }
  return { label, dateShort, dateLong, relative, diff, todayYmd };
}

export function formatDayLabel(isoDate, now = new Date()) {
  return formatDayMeta(isoDate, now).label;
}

export function buildDailyRows(payload, now = new Date(), hourlyRows = []) {
  const daily = payload?.daily;
  if (!daily?.time?.length) return [];
  const timeZone = payload?.timezone || BETTYSTOWN.timezone;
  const rows = [];
  for (let i = 0; i < daily.time.length; i++) {
    const meta = formatDayMeta(daily.time[i], now, timeZone);
    const day = {
      date: daily.time[i],
      label: meta.label,
      dateShort: meta.dateShort,
      dateLong: meta.dateLong,
      relative: meta.relative,
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
    const rainBands = hourlyRows.length ? buildDayRainBands(hourlyRows, day.date, now, timeZone) : null;
    const wmo = wmoInfo(day.weatherCode);
    const enriched = {
      ...day,
      rainBands,
      icon: wmo.icon,
      summary: wmo.label,
      sunshineHours: day.sunshineSec != null ? Math.round(day.sunshineSec / 3600 * 10) / 10 : null,
    };
    const walk = scoreWalkDay(enriched);
    enriched.walkScore = walk.score;
    enriched.walkTier = walk.tier;
    enriched.walkBreakdown = walk.breakdown;
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
  const now = meta.now ? new Date(meta.now) : new Date();
  const timeZone = payload?.timezone || BETTYSTOWN.timezone;
  const hourlyRows =
    meta.hourlyRows ||
    mergeTrustedHourly(payload?.hourly, meta.modelHourlies || []);
  const daily = buildDailyRows(payload, now, hourlyRows);
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
  const tomorrow = findTomorrow(daily, now, timeZone);
  const todayRow = daily.find((d) => d.relative === "today") || daily[0] || null;
  const drySpells = detectDrySunnySpells(daily);
  const heatEvents = detectHeatEvents(daily);
  const metBrief = meta.metBrief || null;
  const maxWalkScore = buildMaxWalkScore(hourlyRows, now, timeZone);
  const maxWalkByDate = Object.fromEntries((maxWalkScore.days || []).map((d) => [d.date, d]));
  const alerts = buildWeatherAlerts(daily, currentOut, {
    hourlyRows,
    metBrief,
    now,
    timeZone,
    maxWalkByDate,
  });
  const fetchedAt = meta.fetchedAt || Date.now();
  const ageMs = meta.cacheAgeMs ?? Date.now() - fetchedAt;
  const stale = Boolean(meta.stale) || ageMs > FORECAST_STALE_MS;
  return {
    ok: true,
    location: BETTYSTOWN,
    today: todayRow
      ? {
          date: todayRow.date,
          dateLong: todayRow.dateLong,
          dateShort: todayRow.dateShort,
          label: todayRow.label,
          ymd: todayRow.date,
        }
      : null,
    timeZone,
    timeLabel: "Irish time / Dublin",
    fetchedAt,
    metEireann: metBrief?.ok
      ? {
          oneLiner: metBrief.oneLiner,
          issuedAt: metBrief.issuedAt,
          leinster: metBrief.leinster
            ? {
                today: metBrief.leinster.today,
                tonight: metBrief.leinster.tonight,
                tomorrow: metBrief.leinster.tomorrow,
                outlook: metBrief.leinster.outlook,
              }
            : null,
          attribution: metBrief.attribution,
        }
      : null,
    maxWalkScore,
    metEireannPage: MET_EIREANN_BETTYSTOWN_PAGE,
    source: "open-meteo+met-eireann",
    attribution: buildBettystownLegal().attributionLine,
    legal: buildBettystownLegal(),
    current: currentOut,
    tomorrow: tomorrow || null,
    drySpells,
    heatEvents,
    alerts,
    bestDays: best,
    forecast: daily,
    timezone: payload?.timezone,
    stale,
    staleHint: stale ? "Stale if older than 2 hours — pull to refresh." : null,
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
        headers: { Accept: "application/json", "User-Agent": "BettystownWeather/2.0 (tgollogly.dev)" },
      });
      if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      const data = await res.json();
      if (!data?.daily?.time?.length) throw new Error("open-meteo missing daily forecast");
      if (data.timezone && data.timezone !== BETTYSTOWN.timezone) {
        /* Open-Meteo should honour Europe/Dublin; keep payload but flag in logs if not. */
      }
      return { ok: true, data, fetchedAt: Date.now() };
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { ok: false, error: String(lastErr?.message || lastErr) };
}

function modelHourlyUrl(model) {
  const q = new URLSearchParams({
    latitude: String(BETTYSTOWN.latitude),
    longitude: String(BETTYSTOWN.longitude),
    timezone: BETTYSTOWN.timezone,
    forecast_days: "14",
    models: model,
    hourly: "precipitation,precipitation_probability,wind_gusts_10m,wind_speed_10m",
  });
  return `${OPEN_METEO_FORECAST}?${q}`;
}

/** Extra model runs for trustworthy hourly rain/mm (best-effort). */
export async function fetchOpenMeteoModelHourlies(fetchFn = fetch) {
  const headers = { Accept: "application/json", "User-Agent": "BettystownWeather/2.0 (tgollogly.dev)" };
  const payloads = [];
  for (const model of OPEN_METEO_HOURLY_MODELS) {
    try {
      const res = await fetchFn(modelHourlyUrl(model), { headers });
      if (res.ok) payloads.push(await res.json());
    } catch {
      /* optional models */
    }
  }
  return payloads;
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
  if (!body?.maxWalkScore?.headline) issues.push("no maxWalkScore");
  if (!body?.legal?.copyright) issues.push("no legal");
  if (body?.timeZone !== BETTYSTOWN.timezone) issues.push("timezone not Dublin");
  for (const d of body?.forecast || []) {
    if (d.walkScore == null || d.walkScore < 0 || d.walkScore > 100) issues.push(`bad score ${d.date}`);
  }
  for (const a of body?.alerts || []) {
    if (a.type === "heavy_rain" && /Tomorrow/i.test(a.message || "") && !/\d/.test(a.label || "")) {
      issues.push("alert uses Tomorrow without date");
    }
  }
  return { ok: issues.length === 0, issues };
}

export function buildSmsForMum(body) {
  if (!body?.ok) return "";
  const lines = ["Bettystown weather for Mom & Max 🐕"];
  if (body.maxWalkScore?.headline) lines.push(body.maxWalkScore.headline);
  if (body.metEireann?.oneLiner) lines.push(`Met Éireann: ${body.metEireann.oneLiner.slice(0, 160)}`);
  const top = (body.alerts || []).slice(0, 3);
  for (const a of top) {
    if (a.title && a.message) lines.push(`${a.title}: ${a.message.slice(0, 120)}`);
  }
  lines.push(`Radar: ${MET_EIREANN_BETTYSTOWN_PAGE}`);
  lines.push(`(Irish time / Dublin · updated ${new Date(body.fetchedAt).toLocaleString("en-IE", { timeZone: BETTYSTOWN.timezone })})`);
  return lines.join("\n");
}

async function attachRadarToForecast(response, env, origin, fetchFn) {
  if (!response?.ok) return response;
  try {
    const radar = await getBettystownRadar(env, origin, fetchFn);
    if (radar?.ok) response.radar = radar;
    else response.radar = { ok: false, error: radar?.error || "radar unavailable" };
  } catch (e) {
    response.radar = { ok: false, error: String(e?.message || e) };
  }
  return response;
}

export async function getBettystownForecast(env, fetchFn = fetch, { origin = "" } = {}) {
  const cacheKey = "bettystown:forecast:v3";
  let cached = null;
  if (env?.PURSUIT_KV) {
    try {
      const raw = await env.PURSUIT_KV.get(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch {
      /* ignore corrupt cache */
    }
  }

  const [live, metBrief, modelHourlies] = await Promise.all([
    fetchOpenMeteoForecast(fetchFn),
    fetchMetEireannBrief(fetchFn),
    fetchOpenMeteoModelHourlies(fetchFn),
  ]);

  if (live.ok) {
    let response;
    try {
      const hourlyRows = mergeTrustedHourly(live.data?.hourly, modelHourlies);
      response = buildForecastResponse(live.data, {
        fetchedAt: live.fetchedAt,
        metBrief,
        modelHourlies,
        hourlyRows,
      });
    } catch (e) {
      response = { ok: false, error: String(e?.message || e), location: BETTYSTOWN };
    }
    if (!response.ok && cached?.data) {
      const hourlyRows = mergeTrustedHourly(cached.data?.hourly, cached.modelHourlies || []);
      const cachedResponse = buildForecastResponse(cached.data, {
        fetchedAt: cached.at,
        stale: true,
        cacheAgeMs: Date.now() - cached.at,
        metBrief: cached.metBrief || metBrief,
        modelHourlies: cached.modelHourlies || [],
        hourlyRows,
      });
      return attachRadarToForecast(cachedResponse, env, origin, fetchFn);
    }
    if (!response.ok) return response;
    if (env?.PURSUIT_KV) {
      await env.PURSUIT_KV.put(
        cacheKey,
        JSON.stringify({
          at: live.fetchedAt,
          data: live.data,
          metBrief,
          modelHourlies,
        }),
        { expirationTtl: FORECAST_REFRESH_TTL_SEC },
      );
    }
    return attachRadarToForecast(response, env, origin, fetchFn);
  }

  if (cached?.data) {
    const hourlyRows = mergeTrustedHourly(cached.data?.hourly, cached.modelHourlies || []);
    const staleResponse = buildForecastResponse(cached.data, {
      fetchedAt: cached.at,
      stale: true,
      cacheAgeMs: Date.now() - cached.at,
      metBrief: cached.metBrief || null,
      modelHourlies: cached.modelHourlies || [],
      hourlyRows,
    });
    return attachRadarToForecast(staleResponse, env, origin, fetchFn);
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

/** Whitelist Met Éireann radar PNG filenames (no path traversal). */
export function sanitizeRadarFilename(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return RADAR_FILENAME_RE.test(trimmed) ? trimmed : null;
}

/** Extract ordered unique frame filenames from Met Éireann radar HTML. */
export function parseRadarFramesFromHtml(html) {
  if (typeof html !== "string" || !html.length) return [];
  const seen = new Set();
  const frames = [];
  for (const m of html.matchAll(RADAR_FRAME_SCRAPE_RE)) {
    const f = m[0];
    if (!seen.has(f)) {
      seen.add(f);
      frames.push(f);
    }
  }
  return frames;
}

/** Frame timestamp in filenames is Irish local time (YYYYMMDDHHmm). */
export function formatRadarFrameIrishLabel(filename) {
  const m = filename.match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\.png$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[Number(mo) - 1] || mo;
  return `${Number(d)} ${month} · ${h}:${mi} Irish time`;
}

export async function fetchMetEireannRadarFrames(fetchFn = fetch) {
  const res = await fetchFn(MET_EIREANN_RADAR_PAGE, {
    headers: {
      Accept: "text/html",
      "User-Agent": "MomBettystownWeather/1.0 (personal family app)",
    },
  });
  if (!res.ok) throw new Error(`Met Éireann radar page HTTP ${res.status}`);
  const html = await res.text();
  const frames = parseRadarFramesFromHtml(html);
  if (!frames.length) throw new Error("No radar frames on Met Éireann page");
  return frames;
}

export function bettystownRadarImagePath(file) {
  const safe = sanitizeRadarFilename(file);
  if (!safe) return null;
  return `/api/bettystown-radar-image?f=${encodeURIComponent(safe)}`;
}

export function buildBettystownRadarResponse(frames, origin) {
  const safeOrigin = typeof origin === "string" && origin.startsWith("http") ? origin : "";
  const play = frames.slice(-RADAR_PLAY_FRAME_COUNT);
  const mapped = play.map((file) => ({
    file,
    imageUrl: bettystownRadarImagePath(file)
      || (safeOrigin
        ? `${safeOrigin}/api/bettystown-radar-image?f=${encodeURIComponent(file)}`
        : `${MET_RADAR_IMAGE_BASE}${file}`),
    label: formatRadarFrameIrishLabel(file),
  }));
  const latest = mapped[mapped.length - 1] || null;
  return {
    ok: true,
    source: "Met Éireann",
    sourceUrl: MET_EIREANN_RADAR_PAGE,
    attribution: "Rainfall radar © Met Éireann · Not an official warning.",
    intervalMinutes: 15,
    pin: {
      label: "Bettystown",
      leftPct: 63.5,
      topPct: 37,
    },
    frames: mapped,
    latest,
  };
}

export async function getBettystownRadar(env, origin, fetchFn = fetch) {
  const cacheKey = "bettystown:radar:v1";
  let cached = null;
  if (env?.PURSUIT_KV) {
    try {
      const raw = await env.PURSUIT_KV.get(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch {
      cached = null;
    }
  }
  if (cached?.frames?.length && cached.at && Date.now() - cached.at < RADAR_REFRESH_TTL_SEC * 1000) {
    return buildBettystownRadarResponse(cached.frames, origin);
  }
  try {
    const frames = await fetchMetEireannRadarFrames(fetchFn);
    if (env?.PURSUIT_KV) {
      await env.PURSUIT_KV.put(cacheKey, JSON.stringify({ at: Date.now(), frames }), {
        expirationTtl: RADAR_REFRESH_TTL_SEC * 2,
      });
    }
    return buildBettystownRadarResponse(frames, origin);
  } catch (e) {
    if (cached?.frames?.length) {
      const body = buildBettystownRadarResponse(cached.frames, origin);
      return { ...body, stale: true, error: String(e?.message || e) };
    }
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function proxyBettystownRadarImage(filename, fetchFn = fetch) {
  const safe = sanitizeRadarFilename(filename);
  if (!safe) return { ok: false, status: 400 };
  const res = await fetchFn(`${MET_RADAR_IMAGE_BASE}${safe}`, {
    headers: { "User-Agent": "MomBettystownWeather/1.0 (personal family app)" },
  });
  if (!res.ok) return { ok: false, status: res.status === 404 ? 404 : 502 };
  return {
    ok: true,
    body: res.body,
    contentType: res.headers.get("content-type") || "image/png",
    cacheControl: "public, max-age=300, stale-while-revalidate=600",
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
