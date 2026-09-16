#!/usr/bin/env node
import {
  decodeHtmlEntities,
  mapOpenTdbItem,
  parseRssTitles,
  questionsFromHeadlines,
  questionsFromWikipediaOnThisDay,
} from "../lib/pursuit-news-feeds.js";
import { validateQuestion as validate } from "../lib/pursuit-store.js";

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

ok(decodeHtmlEntities("Tom &amp; Jerry") === "Tom & Jerry", "html entities");
ok(decodeHtmlEntities("Les Mis&eacute;rables") === "Les Misérables", "eacute");

const rssSample = `<rss><channel><title>BBC News</title>
<item><title><![CDATA[UK in talks about defence bank]]></title></item>
<item><title><![CDATA[Water firms complaints jump]]></title></item>
<item><title><![CDATA[AI ads banned by watchdog]]></title></item>
<item><title><![CDATA[Heathrow runway advisers speak]]></title></item>
</channel></rss>`;
const titles = parseRssTitles(rssSample, 10);
ok(titles.length === 4, "rss parse count");
ok(!titles.includes("BBC News"), "rss skips channel title");

const headlineQs = questionsFromHeadlines(titles, "bbc_news", Date.now(), 2);
ok(headlineQs.length >= 1, "headline questions");
ok(headlineQs.every((q) => validate(q)), "headline questions valid");

const otdb = mapOpenTdbItem(
  {
    type: "multiple",
    difficulty: "easy",
    category: "Geography",
    question: "What is the capital of Spain?",
    correct_answer: "Madrid",
    incorrect_answers: ["Barcelona", "Seville", "Toledo"],
  },
  0,
  123
);
ok(otdb && validate(otdb), "opentdb mapping");

const wikiQs = questionsFromWikipediaOnThisDay(
  {
    selected: [
      { text: "Apollo 11 landed on the Moon.", year: 1969 },
      { text: "Malaysia was formed.", year: 1963 },
      { text: "Ozone hole discovered.", year: 1985 },
      { text: "First McDonald's in UK.", year: 1974 },
    ],
  },
  Date.now(),
  2
);
ok(wikiQs.length >= 1, "wikipedia questions");
ok(wikiQs.every((q) => validate(q)), "wikipedia questions valid");

if (failed) process.exit(1);
console.log("pursuit-news-feeds tests OK");
