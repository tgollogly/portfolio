#!/usr/bin/env node
import {
  sanitizePlayerId,
  sanitizePursuitName,
  validateQuestion,
} from "../lib/pursuit-store.js";

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

ok(sanitizePursuitName("  Alice O'Brien  ") === "Alice O'Brien", "name trim");
ok(sanitizePursuitName("<script>alert(1)</script>") === "scriptalert1script", "name strip");
ok(sanitizePursuitName("A".repeat(40)).length === 20, "name max len");

ok(sanitizePlayerId("p_abc-123") === "p_abc-123", "player id");
ok(sanitizePlayerId("bad id!@#") === "badid", "player id strip");
ok(sanitizePlayerId("").length === 0, "empty player id");

ok(
  validateQuestion({ q: "Capital of France?", o: ["Paris", "Lyon", "Nice", "Marseille"], a: 0 }),
  "valid question"
);
ok(
  !validateQuestion({ q: "Bad?", o: ["A", "A", "B", "C"], a: 0 }),
  "reject duplicate options"
);
ok(!validateQuestion({ q: "Bad?", o: ["A", "B", "C", "D"], a: 5 }), "reject bad index");

if (failed) process.exit(1);
console.log("pursuit-store tests OK");
