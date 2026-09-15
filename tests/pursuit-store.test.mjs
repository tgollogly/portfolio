#!/usr/bin/env node
import {
  sanitizePlayerId,
  sanitizePursuitName,
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

if (failed) process.exit(1);
console.log("pursuit-store tests OK");
