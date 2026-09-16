#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NEWRY,
  SAFE_FUELS,
  FUEL_NEWS_FEEDS,
  normalizePencePerLitre,
  formatPence,
  parseGovDieselCsv,
  movingAverage,
  linearTrend,
  analyzeBuySignal,
  buildBuyGuide,
  buildBuyAlertState,
  buildVerdictWhy,
  buildSharePreviewMeta,
  buildSavingsTable,
  analyzeNewsSentiment,
  analyzeHeadlineDirection,
  buildLiveTrendSeries,
  buildTrendSnapshot,
  buildPredictionOutlook,
  buildShortForecast,
  buildExtendedForecast,
  buildWhenToBuyTimeline,
  buildHoldOutlook,
  createEmptyFuelMemory,
  appendFuelMemory,
  flattenMemoryPrices,
  migrateLegacyHistory,
  recordFuelPrediction,
  updateFuelMemoryOutcomes,
  computeMemoryStats,
  buildMemoryPayload,
  computeSeasonalProfile,
  buildPredictionIndicators,
  computeRsi,
  computeMomentum,
  exponentialMovingAverage,
  backtestBuyModel,
  computeModelConfidence,
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

  const news = analyzeNewsSentiment([
    "Oil prices fall as demand drops",
    "UK weather forecast",
    "Diesel pump prices rise at forecourts",
  ]);
  s.assert("news fuel filter", news.relevant.length >= 2);
  s.assert("news bias", news.bias === "falling" || news.bias === "rising" || news.bias === "neutral");
  s.assert("news price direction", ["down", "up", "steady"].includes(news.priceDirection));
  s.assert("news outlook headline", news.outlookHeadline.includes("News says"));
  s.assert("headline up", analyzeHeadlineDirection("Oil prices surge at pumps").direction === "up");
  s.assert("headline down", analyzeHeadlineDirection("Fuel prices fall across UK").direction === "down");

  const gov = [{ date: "2026-01-01", dieselPpl: 170 }, { date: "2026-01-08", dieselPpl: 172 }, { date: "2026-01-15", dieselPpl: 175 }];
  const trend = buildLiveTrendSeries(gov, [], 182.9, "diesel", 182.9);
  s.assert("trend series length", trend.length >= 4);
  s.assert("trend has now", trend.some((p) => p.live));
  const snap = buildTrendSnapshot(trend);
  s.assert("trend snapshot", snap && snap.label.includes("trend"));

  const pred = buildPredictionOutlook({
    current: 180,
    forecast: [{ day: 1, estimate: 181 }, { day: 7, estimate: 185 }],
  });
  s.assert("prediction up", pred.direction === "up" && pred.headline.includes("GO UP"));

  const csvLong = "Date,ULSP,ULSD\n01/01/2024,140,150\n08/01/2024,141,151\n15/01/2024,142,152\n22/01/2024,143,153\n29/01/2024,144,154\n05/02/2024,145,155\n12/02/2024,146,156\n19/02/2024,147,157\n26/02/2024,148,158\n05/03/2024,149,159\n12/03/2024,150,160\n19/03/2024,151,161\n26/03/2024,152,162\n02/04/2024,153,163\n09/04/2024,154,164\n16/04/2024,155,165\n23/04/2024,156,166\n30/04/2024,157,167\n07/05/2024,158,168\n14/05/2024,159,169\n21/05/2024,160,170\n28/05/2024,161,171\n04/06/2024,162,172\n11/06/2024,163,173\n18/06/2024,164,174\n25/06/2024,165,175\n02/07/2024,166,176\n09/07/2024,167,177\n16/07/2024,168,178\n23/07/2024,169,179\n30/07/2024,170,180\n";
  const seriesLong = parseGovDieselCsv(csvLong + csvLong.replace(/2024/g, "2025"));

  const shortFc = buildShortForecast([100, 102, 104], linearTrend([100, 102, 104]));
  s.assert("short forecast 7d", shortFc.length === 7 && shortFc[0].day === 1);

  const extFc = buildExtendedForecast({
    current: 180,
    recent: [175, 178, 180],
    trend: { slope: 0.5, intercept: 175 },
    govSeries: seriesLong,
    kind: "diesel",
  });
  s.assert("extended forecast has 6mo", extFc.some((f) => f.day === 180));
  s.assert("extended forecast tomorrow", extFc.find((f) => f.day === 1).estimate > 0);

  const waitSignal = analyzeBuySignal({
    current: 120,
    history: [{ price: 108 }, { price: 110 }, { price: 112 }, { price: 114 }, { price: 116 }, { price: 118 }],
    label: "Wait test",
    extendedForecast: extFc,
    govSeries: seriesLong,
  });
  s.assert("wait has hold outlook", waitSignal.holdOutlook && waitSignal.holdOutlook.headline.length > 5);
  s.assert("hold outlook predictable", waitSignal.holdOutlook.predictable.length > 10);
  s.assert("hold outlook risk label", waitSignal.holdOutlook.riskLabel.length > 5);
  s.assert("hold outlook in guide", waitSignal.guide.holdOutlook === waitSignal.holdOutlook);

  const holdDirect = buildHoldOutlook({
    current: 120,
    verdict: "wait",
    extendedForecast: extFc,
    predictionIndicators: { volatility: 1.2 },
    history: [{ price: 110 }, { price: 112 }, { price: 114 }, { price: 116 }, { price: 118 }],
  });
  s.assert("buildHoldOutlook days", holdDirect.holdDaysMin >= 1 && holdDirect.holdDaysMax >= holdDirect.holdDaysMin);
  s.assert("buildHoldOutlook confidence", ["high", "medium", "low"].includes(holdDirect.confidence));
  s.assert("buildHoldOutlook null buy", buildHoldOutlook({ current: 100, verdict: "buy", extendedForecast: extFc }) === null);

  const seasonal = computeSeasonalProfile(seriesLong);
  s.assert("seasonal profile", seasonal && seasonal.avgAll > 0);

  const timeline = buildWhenToBuyTimeline({
    current: 180,
    verdict: "watch",
    extendedForecast: extFc,
    guide: { timing: "Wait", action: "watch" },
    newsSentiment: { priceDirection: "down" },
  });
  s.assert("when to buy timeline", timeline && timeline.windows.length >= 5);
  s.assert("when to buy 6mo outlook", timeline.sixMonthOutlook.includes("6-month"));
  s.assert("buy signal has whenToBuy", buy.guide.whenToBuy && buy.guide.whenToBuy.headline.length > 5);
  s.assert("buy has indicators", buy.predictionIndicators && buy.predictionIndicators.indicators.length === 6);

  let mem = createEmptyFuelMemory();
  mem = appendFuelMemory(mem, "heating", { at: "2026-01-01T06:00:00Z", date: "2026-01-01", price: 110 });
  mem = appendFuelMemory(mem, "heating", { at: "2026-01-01T18:00:00Z", date: "2026-01-01", price: 108 });
  mem = appendFuelMemory(mem, "heating", { at: "2026-01-02T06:00:00Z", date: "2026-01-02", price: 105 });
  s.assert("memory daily rollup", mem.daily.heating.length === 2 && mem.daily.heating[0].low === 108);
  s.assert("memory flatten", flattenMemoryPrices(mem, "heating").length >= 2);
  mem = migrateLegacyHistory(createEmptyFuelMemory(), {
    heating: [{ at: "2026-01-03T12:00:00Z", date: "2026-01-03", price: 112 }],
    diesel: [],
  });
  s.assert("memory migrate legacy", mem.daily.heating.length === 1);
  mem = recordFuelPrediction(mem, "heating", {
    verdict: "wait",
    current: 112,
    guide: { targetPricePpl: 105 },
  });
  s.assert("memory record prediction", mem.predictions.length === 1);
  mem = updateFuelMemoryOutcomes(mem, "heating", 104);
  s.assert("memory outcomes pending", mem.outcomes.heating.tracked === 0);
  mem.predictions[0].at = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  mem = updateFuelMemoryOutcomes(mem, "heating", 104);
  s.assert("memory outcomes scored", mem.outcomes.heating.tracked === 1 && mem.outcomes.heating.wins === 1);
  const memStats = computeMemoryStats(mem, "heating");
  s.assert("memory stats days", memStats.days >= 1);
  s.assert("memory payload", buildMemoryPayload(mem).summary.length > 20);
  const memConf = computeModelConfidence({
    verdict: "wait",
    pattern: { matchRate: 0.85 },
    memoryStats: { days: 45, tracked: 8, accuracyPct: 75 },
  });
  s.assert("memory boosts confidence", memConf.score >= 60 && memConf.memoryNote.includes("45 days"));
  s.assert("buy forecast bands", buy.forecast[0].low != null && buy.forecast[0].high != null);

  const preds = buildPredictionIndicators({
    prices: [120, 122, 121, 119, 118, 117, 116, 115, 114, 113, 112, 110, 108, 106, 105],
    current: 100,
    ma7: 108,
    ma30: 115,
    govSeries: seriesLong,
    newsSentiment: { priceDirection: "down" },
  });
  s.assert("prediction indicators", preds.indicators.length === 6);
  s.assert("prediction bias", ["up", "down", "steady"].includes(preds.nearTermBias));
  s.assert("rsi range", computeRsi([100, 102, 104, 103, 105]) >= 0);
  s.assert("momentum", typeof computeMomentum([100, 101, 102]) === "number");
  s.assert("ema", exponentialMovingAverage([100, 102, 104]) > 100);

  const savings = buildSavingsTable({ savingsPpl: 5, kind: "heating" });
  s.assert("savings table 900L", savings.find((r) => r.litres === 900).savePounds === 45);

  const conf = computeModelConfidence({
    verdict: "buy",
    pattern: { matchRate: 0.92, avgDistance: 0.1 },
    news: { bias: "falling" },
    backtest: { highConfidenceAccuracy: 80, highConfidenceSamples: 10 },
  });
  s.assert("confidence high tier", conf.score >= 95);
  s.assert("confidence high flag", conf.highConfidence === true);

  const bt = backtestBuyModel(seriesLong);
  s.assert("backtest returns accuracy", bt.highConfidenceSamples >= 0);

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

  const buyAlert = buildBuyAlertState(payload);
  s.assert("buy alert active", buyAlert.active === true);
  s.assert("buy alert mode", buyAlert.mode === "buy");
  s.assert("buy alert message", buyAlert.message.includes("Buy now"));
  s.assert("buy alert items", buyAlert.items.length === 2);
  s.assert("hold alert mode", buildBuyAlertState({
    alertWorthy: false,
    signals: { heating: { verdict: "wait", current: 107 }, diesel: { verdict: "wait", current: 176 } },
  }).mode === "hold");
  s.assert("hold alert message", buildBuyAlertState({
    alertWorthy: false,
    signals: { heating: { verdict: "wait", current: 107, why: buildVerdictWhy({
      current: 107, vs7Pct: 3.2, ma7: 103.5, percentile: 88, verdict: "wait",
      guide: { targetPricePpl: 101.6, whenToBuy: { bestWindow: { day: 5, pricePpl: 101.6 } } },
      reasons: ["Near recent highs — consider waiting if you can."],
    }) } },
  }).message.includes("Hold"));
  s.assert("hold has why", buildBuyAlertState({
    alertWorthy: false,
    signals: { heating: { verdict: "wait", current: 107, why: buildVerdictWhy({
      current: 107, vs7Pct: 3.2, ma7: 103.5, percentile: 88, verdict: "wait", reasons: [],
    }) } },
  }).why.length > 0);
  const why = buildVerdictWhy({
    current: 107, vs7Pct: 3.2, ma7: 103.5, vs30Pct: 4, ma30: 102.8,
    percentile: 88, verdict: "wait", trendSlope: 0.1, reasons: [],
    guide: { targetPricePpl: 101.6, whenToBuy: { bestWindow: { day: 5, pricePpl: 101.6 } } },
  });
  s.assert("verdict why hold", why.reasons.length >= 2);
  s.assert("verdict why sources", why.sources.length >= 3);
  s.assert("buy signal has why", buy.why && buy.why.reasons.length >= 0);
  s.assert("buy alert inactive", buildBuyAlertState({ alertWorthy: false, signals: {} }).active === false);

  const share = buildSharePreviewMeta(
    { signals: { heating: { current: 107 }, diesel: { current: 176.9 } } },
    "https://tgollogly.dev",
    "path"
  );
  s.assert("share meta diesel", share.description.includes("176.9p/L"));
  s.assert("share meta og image", share.ogImage.includes("og-preview.png"));

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
  s.assert("html top alert", html.includes("topAlert") && html.includes("top-alert"));
  s.assert("html fixed alert copy", html.includes("fixed alert bar"));
  s.assert("html alert flash anim", html.includes("alertFlash"));
  s.assert("html why box", html.includes("why-box") && html.includes("How we know"));
  s.assert("html og image", html.includes("og:image") && html.includes("og-preview.png"));
  s.assert("html twitter card", html.includes("twitter:card"));
  s.assert("html apple touch 180", html.includes("apple-touch-icon") && html.includes("180x180"));
  s.assert("og preview exists", readFileSync(join(root, "sites/newry-fuel/og-preview.png")).length > 5000);
  s.assert("server share meta inject", server.includes("injectNewryFuelShareMeta"));
  s.assert("html charts split", html.includes("heatingChart") && html.includes("dieselChart"));
  s.assert("html buy guide", html.includes("buy-guide"));
  s.assert("html savings banner", html.includes("savings-banner"));
  s.assert("html news card", html.includes("newsCard"));
  s.assert("html outlook card", html.includes("outlookCard"));
  s.assert("html news verdict", html.includes("newsVerdict"));
  s.assert("lib fuel news feeds", FUEL_NEWS_FEEDS.length >= 3);
  s.assert("html call tel", html.includes("tel:+442830830691"));
  s.assert("html typography", html.includes("DM Serif Display") && html.includes("Plus Jakarta Sans"));
  s.assert("html sw register", html.includes("/newry-fuel/sw.js"));
  s.assert("html hold outlook", html.includes("hold-outlook") && html.includes("predictable or risky"));
  s.assert("html hold alert meta", html.includes("topAlertHold"));
  s.assert("html alert dismiss", html.includes("topAlertDismiss") && html.includes("alertShowBtn"));
  s.assert("html alert hide copy", html.includes("Hide alert bar"));
  s.assert("html alert no default buy", !html.includes('id="topAlert" class="top-alert buy"'));
  s.assert("html alert updating guard", html.includes("is-updating"));
  s.assert("html memory note", html.includes("memoryNote") && html.includes("persistent memory"));

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
