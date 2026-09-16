#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BETTYSTOWN,
  buildDailyRows,
  buildForecastResponse,
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
  s.assert("sorted by score", rows[0].walkScore >= rows[1].walkScore);

  const body = buildForecastResponse(samplePayload, { fetchedAt: 1 });
  s.assert("response ok", body.ok === true);
  s.assert("has current", body.current.temp === 16);
  s.assert("has forecast", body.forecast.length === 2);
  s.assert("has bestDays", Array.isArray(body.bestDays));
  s.assert("validation pass", validateForecastResponse(body).ok === true);

  s.assert("forecast url open-meteo", forecastUrl().includes("api.open-meteo.com"));
  s.assert("forecast url lat", forecastUrl().includes(String(BETTYSTOWN.latitude)));

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

  const wf = readFileSync(join(root, ".github/workflows/bettystown-weather-check.yml"), "utf8");
  s.assert("daily workflow", wf.includes("0 8 * * *"));
  s.assert("health endpoint check", wf.includes("bettystown-health"));

  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runBettystownWeatherTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}
