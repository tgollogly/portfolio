#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BETTYSTOWN,
  buildBettystownManifest,
  buildDailyRows,
  buildForecastResponse,
  buildWeatherAlerts,
  detectDrySunnySpells,
  detectHeatEvents,
  explainWalkDay,
  pickBestDaysChronological,
  forecastUrl,
  scoreWalkDay,
  validateForecastResponse,
  wmoInfo,
} from "../lib/bettystown-weather.js";
import { createSuite } from "./harness.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function runBettystownWeatherTests() {
  const s = createSuite("bettystown-weather");

  s.assert("coords ireland", BETTYSTOWN.latitude > 53 && BETTYSTOWN.longitude < 0);
  s.assert("wmo clear", wmoInfo(0).icon === "☀️");
  s.assert("wmo unknown fallback", wmoInfo(999).label === "Unknown");

  const perfect = scoreWalkDay({
    tempMax: 18,
    tempMin: 12,
    rainProb: 5,
    rainMm: 0,
    windMax: 12,
    weatherCode: 1,
  });
  s.assert("perfect score high", perfect.score >= 75);
  s.assert("perfect tier excellent", perfect.tier === "excellent");

  const awful = scoreWalkDay({
    tempMax: 8,
    tempMin: 3,
    rainProb: 90,
    rainMm: 8,
    windMax: 45,
    weatherCode: 65,
  });
  s.assert("awful score low", awful.score < 45);
  s.assert("awful tier poor", awful.tier === "poor");

  const rainyDay = {
    tempMax: 14,
    tempMin: 9,
    rainProb: 85,
    rainMm: 4.5,
    windMax: 38,
    weatherCode: 63,
    sunshineHours: 1.2,
  };
  const explain = explainWalkDay(rainyDay);
  s.assert("explain rainy verdict", explain.verdict === "skip" || explain.verdict === "caution");
  s.assert("explain rainy has negatives", explain.negatives.length >= 2);
  s.assert("explain headline", explain.headline.length > 10);

  const samplePayload = {
    timezone: "Europe/Dublin",
    current: {
      temperature_2m: 16,
      apparent_temperature: 15,
      relative_humidity_2m: 70,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 14,
      is_day: 1,
    },
    daily: {
      time: ["2026-09-16", "2026-09-17"],
      weather_code: [1, 63],
      temperature_2m_max: [19, 14],
      temperature_2m_min: [11, 9],
      apparent_temperature_max: [18, 13],
      apparent_temperature_min: [10, 8],
      precipitation_sum: [0.1, 4.2],
      precipitation_probability_max: [10, 80],
      wind_speed_10m_max: [18, 28],
      wind_gusts_10m_max: [25, 40],
      sunshine_duration: [25200, 3600],
      uv_index_max: [4, 2],
    },
  };

  const rows = buildDailyRows(samplePayload);
  s.assert("daily rows count", rows.length === 2);
  s.assert("forecast chronological", rows[0].date <= rows[1].date);

  const best = pickBestDaysChronological(rows);
  if (best.length >= 2) {
    s.assert("best days chronological", best[0].date <= best[1].date);
  }

  const body = buildForecastResponse(samplePayload, { fetchedAt: 1 });
  s.assert("bestDays chronological", body.bestDays.every((d, i, arr) => i === 0 || arr[i - 1].date <= d.date));
  s.assert("response ok", body.ok === true);
  s.assert("has current", body.current.temp === 16);
  s.assert("has forecast", body.forecast.length === 2);
  s.assert("has bestDays", Array.isArray(body.bestDays));
  s.assert("validation pass", validateForecastResponse(body).ok === true);
  s.assert("response has tomorrow", body.tomorrow != null || body.forecast.length <= 1);
  s.assert("response has alerts array", Array.isArray(body.alerts));
  s.assert("response has drySpells", Array.isArray(body.drySpells));
  s.assert("response has heatEvents", Array.isArray(body.heatEvents));
  s.assert("forecast has explanation", body.forecast.every((d) => d.explanation?.headline));

  const dryDays = Array.from({ length: 4 }, (_, i) => ({
    date: `2026-07-${10 + i}`,
    label: `Day ${i}`,
    rainMm: 0,
    rainProb: 10,
    weatherCode: 1,
    sunshineHours: 8,
    tempMax: 21,
  }));
  s.assert("dry spell detect", detectDrySunnySpells(dryDays).length === 1);
  s.assert("dry spell length", detectDrySunnySpells(dryDays)[0].days === 4);

  const hotDays = Array.from({ length: 3 }, (_, i) => ({
    date: `2026-07-${20 + i}`,
    label: `Hot ${i}`,
    tempMax: 26,
    feelsMax: 28,
    rainMm: 0,
    rainProb: 5,
    weatherCode: 0,
    sunshineHours: 10,
  }));
  s.assert("heat wave detect", detectHeatEvents(hotDays).some((e) => e.type === "heat_wave"));

  s.assert("storm alert", buildWeatherAlerts([{
    date: "2026-08-01",
    label: "Mon",
    weatherCode: 95,
    tempMax: 18,
    tempMin: 12,
    rainMm: 2,
    rainProb: 50,
    windMax: 20,
    uv: 3,
  }]).some((a) => a.type === "storm"));

  s.assert("forecast url open-meteo", forecastUrl().includes("api.open-meteo.com"));
  s.assert("forecast url lat", forecastUrl().includes(String(BETTYSTOWN.latitude)));

  const pathManifest = buildBettystownManifest("path");
  s.assert("manifest path start_url", pathManifest.start_url === "/bettystown/");
  s.assert("manifest path scope", pathManifest.scope === "/bettystown/");
  s.assert("manifest path not portfolio root", pathManifest.start_url !== "/");

  const subManifest = buildBettystownManifest("subdomain");
  s.assert("manifest subdomain start_url", subManifest.start_url === "/");
  s.assert("manifest subdomain scope", subManifest.scope === "/");

  const server = readFileSync(join(root, "server.js"), "utf8");
  s.assert("server bettystown host", server.includes("bettystown.tgollogly.dev"));
  s.assert("server weather api", server.includes("/api/bettystown-weather"));
  s.assert("server health api", server.includes("/api/bettystown-health"));
  s.assert("server challenge exempt", server.includes("isBettystownHost"));

  const html = readFileSync(join(root, "sites/bettystown/index.html"), "utf8");
  s.assert("html title", html.includes("Mom's Bettystown Weather"));
  s.assert("html mom max", html.includes("Max"));
  s.assert("html auto refresh api", html.includes("/api/bettystown-weather"));
  s.assert("html localStorage cache", html.includes("localStorage"));
  s.assert("html tomorrow card", html.includes("tomorrowCard"));
  s.assert("html alerts bar", html.includes("alertsBar"));
  s.assert("html fluid blobs", html.includes("blobDrift"));
  s.assert("html patterns row", html.includes("patternsRow"));
  s.assert("html music toggle", html.includes("musicToggle"));
  s.assert("html three little birds", html.includes("Three Little Birds"));
  s.assert("html tomorrow not doubled", !html.includes("Tomorrow · Tomorrow"));
  s.assert("html artistic typography", html.includes("text-art") && html.includes("Cormorant"));
  s.assert("now-temp no ios clip bug", !/\.now-temp\{[^}]*background-clip:text/.test(html));
  s.assert("now-temp tabular nums", html.includes("font-variant-numeric:tabular-nums"));
  s.assert("html music loop guard", html.includes("watchLoop"));
  s.assert("server audio route", server.includes("three-little-birds.mp3"));
  s.assert("html og image", html.includes("assets/og/bettystown-weather.png"));
  s.assert("html og secure url", html.includes("og:image:secure_url"));
  s.assert("html manifest path", html.includes("/bettystown/manifest.webmanifest"));
  s.assert("html apple touch path", html.includes("/bettystown/apple-touch-icon.png"));
  s.assert("html apple touch", html.includes("apple-touch-icon"));
  s.assert("html ios standalone", html.includes("apple-mobile-web-app-capable"));
  s.assert("og preview exists", readFileSync(join(root, "sites/bettystown/og-preview.png")).length > 1000);
  s.assert("apple icon exists", readFileSync(join(root, "sites/bettystown/apple-touch-icon.png")).length > 500);
  s.assert("server bettystown assets", server.includes("BETTYSTOWN_ASSETS"));
  s.assert("server dynamic manifest", server.includes("serveBettystownManifest"));
  s.assert("server manifest path route", server.includes("/bettystown/manifest.webmanifest"));
  s.assert("server ios omit manifest", server.includes("isIosSafari"));
  s.assert("server bettystown path assets", server.includes("BETTYSTOWN_PATH_ASSETS"));
  s.assert("server legacy redirect", server.includes("/bettystown/`, 301"));
  s.assert("server preview bot bypass", server.includes("LINK_PREVIEW_BOT_RE"));
  s.assert("assets og png exists", readFileSync(join(root, "assets/og/bettystown-weather.png")).length > 1000);

  const wf = readFileSync(join(root, ".github/workflows/bettystown-weather-check.yml"), "utf8");
  s.assert("daily workflow", wf.includes("0 8 * * *"));
  s.assert("health endpoint check", wf.includes("bettystown-health"));

  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  s.assert("ci tests only no gh deploy", ci.includes("test:") && !/\n  deploy:/.test(ci));
  const btReadme = readFileSync(join(root, "sites/bettystown/README.md"), "utf8");
  s.assert("readme workers builds deploy", btReadme.includes("Workers Builds"));

  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runBettystownWeatherTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}
