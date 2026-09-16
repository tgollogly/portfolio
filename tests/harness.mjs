/** Shared test harness — aggregates pass/fail across suites. */

export function createSuite(name) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(label, condition, detail) {
    if (condition) {
      passed++;
      return;
    }
    failed++;
    const msg = detail ? `${label}: ${detail}` : label;
    failures.push(msg);
    console.error("FAIL:", msg);
  }

  return {
    name,
    assert,
    summary() {
      return { name, passed, failed, total: passed + failed, failures };
    },
  };
}

export function evaluateResults(suites, { minTests = 100, minPassRate = 0.99 } = {}) {
  let passed = 0;
  let failed = 0;
  for (const s of suites) {
    passed += s.passed;
    failed += s.failed;
  }
  const total = passed + failed;
  const rate = total ? passed / total : 0;

  console.log("\n══════════════════════════════════════");
  console.log(`Total: ${passed}/${total} passed (${(rate * 100).toFixed(1)}%)`);
  for (const s of suites) {
    console.log(`  ${s.name}: ${s.passed}/${s.passed + s.failed}`);
  }
  console.log("══════════════════════════════════════");

  if (total < minTests) {
    console.error(`FAIL: need at least ${minTests} tests, got ${total}`);
    return false;
  }
  if (rate < minPassRate) {
    console.error(`FAIL: pass rate ${(rate * 100).toFixed(2)}% below ${minPassRate * 100}%`);
    return false;
  }
  if (failed > 0) {
    console.error(`FAIL: ${failed} test(s) failed`);
    return false;
  }
  console.log(`OK: ${total} tests, ${(rate * 100).toFixed(1)}% pass rate`);
  return true;
}
