#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NEWRY,
  SAFE_FUELS,
  normalizePencePerLitre,
  formatPence,
  parseGovDieselCsv,
  movingAverage,
  linearTrend,
  analyzeBuySignal,
  buildBuyGuide,
  buildNewryFuelManifest,
  sanitizePushSubscription,
  buildSlackMessage,
  buildPushPayload,
} from "../lib/newry-fuel.js";
import { createSuite } from "./harness.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function runNewryFuelTests() {
  const s = createSuite("newry-fuel");

  s.assert("newry bt35", NEWRY.postcode === "BT35");
  s.assert("safe fuels tel", SAFE_FUELS.tel === "+442830830691");
  s.assert("normalize pounds", normalizePencePerLitre(1.07) === 107);
  s.assert("normalize pence", normalizePencePerLitre(107.2) === 107.2);
  s.assert("format pence", formatPence(176.9) === "176.9p");

  const csv = "Date,ULSP,ULSD\n01/01/2024,140,150\n08/01/2024,141,151\n";
  const series = parseGovDieselCsv(csv);
  s.assert("parse gov csv", series.length === 2 && series[1].dieselPpl === 151);
  s.assert("moving avg", movingAverage([100, 110, 120], 3) === 110);
  s.assert("linear trend", linearTrend([100, 102, 104]).slope > 0);

  const buy = analyzeBuySignal({
    current: 100,
    history: [{ price: 115 }, { price: 112 }, { price: 110 }, { price: 108 }, { price: 106 }, { price: 104 }],
    label: "Test",
  });
  s.assert("buy signal cheap", buy.verdict === "buy" || buy.verdict === "watch");
  s.assert("buy has headline", buy.headline.length > 5);
  s.assert("buy has guide", buy.guide && buy.guide.summary.length > 10);
  s.assert("buy guide target", buy.guide.targetPricePpl === buy.current);

  const guide = buildBuyGuide({
    current: 120,
    verdict: "wait",
    trend: { slope: -0.3, intercept: 120 },
    forecast: [{ day: 3, estimate: 115 }, { day: 7, estimate: 118 }],
    ma7: 122,
    ma30: 125,
    prices: [128, 126, 124, 123, 122, 121, 120],
  });
  s.assert("wait guide savings", guide.savingsVsNowPpl > 0);
  s.assert("wait guide summary", guide.summary.includes("115") || guide.summary.includes("Wait"));

  const manifest = buildNewryFuelManifest("path");
  s.assert("manifest path", manifest.start_url === "/newry-fuel/");
  s.assert("manifest subdomain", buildNewryFuelManifest("subdomain").start_url === "/");

  const sub = sanitizePushSubscription({
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: "abc", auth: "def" },
  });
  s.assert("sanitize sub", sub && sub.endpoint.startsWith("https://"));
  s.assert("reject bad sub", !sanitizePushSubscription({ endpoint: "http://bad" }));

  const payload = {
    alertWorthy: true,
    signals: {
      heating: { verdict: "buy", current: 107, headline: "Good" },
      diesel: { verdict: "buy", current: 176.9, headline: "Good" },
    },
    diesel: { cheapestStation: { name: "Test Station", brand: "X", pricePpl: 176.9 } },
  };
  s.assert("slack message", buildSlackMessage(payload).includes("‼️"));
  s.assert("slack safe fuels", buildSlackMessage(payload).includes("Safe Fuels"));
  s.assert("push payload tel", buildPushPayload(payload).data.tel === "+442830830691");

  const server = readFileSync(join(root, "server.js"), "utf8");
  s.assert("server newry host", server.includes("newry.tgollogly.dev"));
  s.assert("server newry path", server.includes("/newry-fuel/"));
  s.assert("server prices api", server.includes("/api/newry-fuel/prices"));
  s.assert("server push subscribe", server.includes("/api/newry-fuel/push/subscribe"));
  s.assert("server alert secret", server.includes("NEWRY_FUEL_ALERT_SECRET"));
  s.assert("server fuel cron", server.includes("runFuelAlerts"));
  s.assert("server newry challenge exempt", server.includes("isNewryFuelHost"));

  const html = readFileSync(join(root, "sites/newry-fuel/index.html"), "utf8");
  s.assert("html title", html.includes("Newry Fuel Watch"));
  s.assert("html noindex", html.includes("noindex,nofollow"));
  s.assert("html safe fuels", html.includes("Safe Fuels"));
  s.assert("html push btn", html.includes("pushBtn"));
  s.assert("html charts split", html.includes("heatingChart") && html.includes("dieselChart"));
  s.assert("html buy guide", html.includes("buy-guide"));
  s.assert("html call tel", html.includes("tel:+442830830691"));
  s.assert("html typography", html.includes("DM Serif Display") && html.includes("Plus Jakarta Sans"));
  s.assert("html sw register", html.includes("/newry-fuel/sw.js"));

  const sw = readFileSync(join(root, "sites/newry-fuel/sw.js"), "utf8");
  s.assert("sw notification click", sw.includes("notificationclick"));
  s.assert("sw tel dial", sw.includes("tel:"));

  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runNewryFuelTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}
