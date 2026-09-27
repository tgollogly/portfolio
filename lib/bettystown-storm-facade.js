/**
 * Temporary public facade — torrential rain / storm story while the full app is owner-only.
 * Toggle via BETTYSTOWN_STORM_FACADE_ENABLED in server.js.
 */

import {
  BETTYSTOWN,
  buildBettystownLegal,
  formatDayMeta,
  ymdInTimeZone,
  addDaysYmd,
  MET_EIREANN_BETTYSTOWN_PAGE,
} from "./bettystown-weather.js";

export const BETTYSTOWN_STORM_FACADE_REASON =
  "Status checks show torrential rain, thunderstorms, and flooding risk along the Meath coast — not safe for beach walks.";

export const BETTYSTOWN_STORM_FACADE_HEADLINE = "Torrential rain & thunderstorms";

export const BETTYSTOWN_STORM_FACADE_MET_ONELINER =
  "Torrential rain and thunderstorms with flooding on low ground. Stay indoors and avoid exposed coasts.";

function stormHour(h) {
  return {
    hour: h,
    timeLabel: h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`,
    temp: 11,
    rainMm: 8.4,
    gust: 72,
    icon: "⛈️",
    summary: "Thunderstorm",
    walkLabel: "Wet likely",
    walkClass: "wet",
    isPast: h < 12,
    isNow: h === 12,
  };
}

function stormDayRow(ymd, now) {
  const meta = formatDayMeta(ymd, now, BETTYSTOWN.timezone);
  return {
    date: ymd,
    label: meta.label,
    dateShort: meta.dateShort,
    dateLong: meta.dateLong,
    relative: meta.relative,
    weatherCode: 95,
    tempMax: 13,
    tempMin: 9,
    feelsMax: 11,
    rainProb: 98,
    rainMm: 42,
    windMax: 58,
    windGust: 78,
    sunshineHours: 0.2,
    uv: 1,
    icon: "⛈️",
    summary: "Thunderstorm",
    walkScore: 8,
    walkTier: "poor",
    walkBreakdown: { temp: 10, dry: 0, wind: 5 },
    explanation: {
      headline: "Not a beach day — stay cosy indoors",
      verdict: "skip",
      score: 8,
      tier: "poor",
      negatives: [
        "Torrential rain during walk hours — stay off the beach",
        "Thunderstorms possible — stay off the open beach",
        "Wind up to 58 km/h (gusts 78) — sand in your eyes",
      ],
      positives: [],
      tips: ["Keep Max indoors until conditions ease"],
    },
  };
}

/** Forecast-shaped JSON for cached clients while the storm facade is active. */
export function buildBettystownStormFacadeWeather(now = new Date()) {
  const timeZone = BETTYSTOWN.timezone;
  const todayYmd = ymdInTimeZone(now, timeZone);
  const forecast = [];
  for (let i = 0; i < 14; i++) {
    forecast.push(stormDayRow(addDaysYmd(todayYmd, i), now));
  }
  const todayRow = forecast[0];
  const tomorrowRow = forecast[1] || null;
  const hours = [];
  for (let h = 6; h <= 22; h++) hours.push(stormHour(h));

  const fetchedAt = Date.now();
  return {
    ok: true,
    facade: true,
    facadeReason: BETTYSTOWN_STORM_FACADE_REASON,
    location: BETTYSTOWN,
    today: {
      date: todayRow.date,
      dateLong: todayRow.dateLong,
      dateShort: todayRow.dateShort,
      label: todayRow.label,
      ymd: todayRow.date,
    },
    timeZone,
    timeLabel: "Irish time / Dublin",
    fetchedAt,
    metEireann: {
      oneLiner: BETTYSTOWN_STORM_FACADE_MET_ONELINER,
      issuedAt: fetchedAt,
      leinster: {
        today: BETTYSTOWN_STORM_FACADE_MET_ONELINER,
        tonight: "Further torrential rain and isolated thunderstorms.",
        tomorrow: "Heavy showers and thunderstorms continuing.",
        outlook: "Unsettled with further spells of torrential rain.",
      },
      attribution: "Status message (app maintenance)",
    },
    maxWalkScore: {
      headline: "Today 8am–11am: Wet likely · Today 11am–2pm: Wet likely · Today 2pm–5pm: Wet likely · Today 5pm–8pm: Wet likely",
      days: [
        {
          date: todayYmd,
          dateShort: todayRow.dateShort,
          relative: "today",
          blocks: [],
          summary: "Torrential rain all day — Max stays indoors",
          goodCount: 0,
        },
      ],
    },
    todayHourly: {
      date: todayYmd,
      dateShort: todayRow.dateShort,
      label: "Today",
      hours,
    },
    metEireannPage: MET_EIREANN_BETTYSTOWN_PAGE,
    source: "storm-facade",
    attribution: buildBettystownLegal().attributionLine,
    legal: buildBettystownLegal(),
    current: {
      temp: 11,
      feels: 9,
      humidity: 96,
      wind: 52,
      rain: 6.2,
      code: 95,
      icon: "⛈️",
      summary: "Thunderstorm",
      isDay: true,
    },
    tomorrow: tomorrowRow,
    drySpells: [],
    heatEvents: [],
    alerts: [
      {
        type: "storm",
        severity: "high",
        tier: "red",
        date: todayYmd,
        label: "Today",
        title: "Thunderstorms",
        message: `${todayYmd}: torrential rain and thunderstorms — keep Max off the open beach.`,
        confidence: "Status checks",
      },
      {
        type: "heavy_rain",
        severity: "high",
        tier: "red",
        date: todayYmd,
        label: "Today",
        title: "Torrential rain",
        message: `${todayYmd}: flooding risk on coast roads — no beach walks.`,
        confidence: "Status checks",
      },
    ],
    bestDays: [],
    forecast,
    timezone: timeZone,
    stale: false,
    staleHint: null,
    cacheAgeMs: 0,
    radar: { ok: false, error: "radar paused during storm status" },
  };
}

export function buildBettystownStormFacadeRadar() {
  return {
    ok: false,
    error: "Rain radar paused — torrential rain reported along the coast.",
    facade: true,
  };
}
