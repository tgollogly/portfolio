#!/usr/bin/env node
import {
  publicQuestion,
  sanitizeQuestionText,
  sanitizePursuitName,
} from "../lib/pursuit-store.js";

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

ok(sanitizeQuestionText("<script>x</script>Hello") === "xHello", "strip script tags");
ok(sanitizeQuestionText("  Normal?  ") === "Normal?", "trim question");

const q = { id: "e1", d: "easy", q: "Test?", o: ["A", "B", "C", "D"], a: 2, source: "seed" };
const pub = publicQuestion(q);
ok(pub.a === undefined, "publicQuestion omits answer");
ok(pub.id === "e1" && pub.q === "Test?", "publicQuestion keeps fields");

ok(sanitizePursuitName("<b>Alice</b>") === "bAliceb", "name strips angle brackets");

if (failed) process.exit(1);
console.log("pursuit-security tests OK");
