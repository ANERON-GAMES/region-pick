import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  CAP,
  CAPPED_MEAN,
  CHOSEN,
  ELIGIBLE,
  EMPTY,
  EXCLUDED,
  EXCLUSIONS,
  MEAN,
  NONE,
  OUTCOMES,
  REGION_STATUSES,
  RULES,
  WORST
} from "../src/index.js";
import * as api from "../src/index.js";

const root = new URL("..", import.meta.url);

test("public exports stay limited to the documented surface", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "CAP",
    "CAPPED_MEAN",
    "CHOSEN",
    "ELIGIBLE",
    "EMPTY",
    "EXCLUDED",
    "EXCLUSIONS",
    "MEAN",
    "NONE",
    "OUTCOMES",
    "REGION_STATUSES",
    "RULES",
    "WORST",
    "pickRegion"
  ]);
  assert.equal(typeof api.pickRegion, "function");
  assert.equal(WORST, "worst");
  assert.equal(MEAN, "mean");
  assert.equal(CAPPED_MEAN, "capped-mean");
  assert.deepEqual(RULES, ["worst", "mean", "capped-mean"]);
  assert.equal(CHOSEN, "chosen");
  assert.equal(NONE, "none");
  assert.deepEqual(OUTCOMES, ["chosen", "none"]);
  assert.equal(ELIGIBLE, "eligible");
  assert.equal(EXCLUDED, "excluded");
  assert.deepEqual(REGION_STATUSES, ["eligible", "excluded"]);
  assert.equal(EMPTY, "empty");
  assert.equal(CAP, "cap");
  assert.deepEqual(EXCLUSIONS, ["empty", "cap"]);
  for (const list of [RULES, OUTCOMES, REGION_STATUSES, EXCLUSIONS]) {
    assert.equal(Object.isFrozen(list), true);
  }
});

test("package metadata names the module and the author", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.name, "@aneron/region-pick");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.author, "Vadim Gubin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports, "./src/index.js");
  assert.equal(pkg.repository.type, "git");
  assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/region-pick.git");
  assert.deepEqual(pkg.files, ["src", "LICENSE", "README.md"]);
  assert.equal(pkg.scripts.test, "node --test test/*.test.js");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.format, "prettier --write .");
  assert.equal(pkg.scripts["format:check"], "prettier --check .");
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.equal(license.includes("Copyright (c) 2026 Vadim Gubin"), true);
  assert.equal(license.includes("anerongames"), false);
  const readme = readFileSync(new URL("README.md", root), "utf8");
  for (const heading of [
    "## Purpose",
    "## Install",
    "## Usage",
    "## API",
    "## Design",
    "## License"
  ]) {
    assert.equal(readme.includes(heading), true, heading);
  }
  assert.equal(readme.includes("## Design notes"), false);
  assert.equal(readme.includes("## API reference"), false);
  assert.equal(readme.includes('`choice.region` is `"region-b"`'), true);
  assert.equal(readme.includes("`choice.regions[0].score` is `110`"), true);
  assert.equal(readme.includes("`choice.regions[1].score` is `80`"), true);
  assert.equal(readme.includes('`averaged.region` is `"region-a"`'), true);
  assert.equal(readme.includes("`averaged.regions[0].score` is `65`"), true);
  assert.equal(readme.includes("`averaged.regions[1].score` is `75`"), true);
  assert.equal(readme.includes('`capped.region` is `"region-b"`'), true);
  assert.equal(readme.includes('`capped.regions[0].reason` is `"cap"`'), true);
  assert.equal(readme.includes("`capped.regions[0].score` is `null`"), true);
  assert.equal(readme.includes('`missing.region` is `"region-b"`'), true);
  assert.equal(readme.includes('`missing.regions[0].reason` is `"empty"`'), true);
  assert.equal(readme.includes("`missing.regions[1].score` is `35.5`"), true);
  assert.equal(readme.includes('`raw.region` is `"region-b"`'), true);
  assert.equal(readme.includes('`trimmed.region` is `"region-a"`'), true);
  assert.equal(readme.includes("`trimmed.regions[0].players[0].latency` is `20`"), true);
  assert.equal(readme.includes("`trimmed.regions[0].players[0].used` is `3`"), true);
  assert.equal(readme.includes('`forward.region` is `"region-a"`'), true);
  assert.equal(readme.includes('`backward.region` is `"region-b"`'), true);
  assert.equal(readme.includes('`blocked.status` is `"none"`'), true);
  assert.equal(readme.includes("`blocked.region` is `null`"), true);
  assert.equal(readme.includes('`blocked.regions[1].reason` is `"cap"`'), true);
  assert.equal(readme.includes("`middle.regions[0].players[0].latency` is `11`"), true);
  assert.equal(readme.includes("`split.regions[0].score` is `30`"), true);
  assert.equal(readme.includes("The latency is `2.5`."), true);
});

test("source files do not contain comments, clocks, timers, or network calls", () => {
  const files = readdirSync(new URL("src/", root)).sort();
  assert.deepEqual(files, [
    "constants.js",
    "index.js",
    "pick.js",
    "rule.js",
    "shape.js",
    "summary.js"
  ]);
  for (const name of files) {
    const source = readFileSync(new URL("src/" + name, root), "utf8");
    const specifiers = source.match(/from "[^"]+"/g) ?? [];
    assert.equal(specifiers.length > 0 || !source.includes("import "), true, name);
    for (const specifier of specifiers) {
      assert.match(specifier, /^from "\.\/[a-z]+\.js"$/);
    }
    assert.equal(source.includes("node:"), false, name);
    assert.equal(source.includes("require("), false, name);
    assert.equal(source.includes("/*"), false, name);
    assert.equal(source.includes("//"), false, name);
    for (const token of [
      "Date",
      "setTimeout",
      "setInterval",
      "Math.random",
      "process",
      "fetch(",
      "globalThis",
      "queueMicrotask",
      "setImmediate",
      "performance"
    ]) {
      assert.equal(source.includes(token), false, name + " " + token);
    }
  }
});

test("the lockfile resolves only from the npm registry", () => {
  const lockPath = new URL("package-lock.json", root);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.lockfileVersion >= 2, true);
  const text = readFileSync(lockPath, "utf8");
  assert.equal(text.includes("git+"), false);
  assert.equal(text.includes("github:"), false);
  assert.equal(text.includes("registry.yarnpkg.com"), false);
  let resolved = 0;
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (value !== null && typeof value === "object") {
      if (typeof value.resolved === "string") {
        resolved += 1;
        assert.equal(
          value.resolved.startsWith("https://registry.npmjs.org/"),
          true,
          value.resolved
        );
      }
      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }
  };
  walk(lock);
  assert.equal(resolved > 0, true);
});
