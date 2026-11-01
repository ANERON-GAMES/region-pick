import assert from "node:assert/strict";
import test from "node:test";
import { pickRegion } from "../src/index.js";
import { player } from "./helpers.js";

function lone(samples, extra = {}) {
  return pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": samples })],
    ...extra
  }).regions[0].players[0];
}

test("the median of an odd count is the middle sample after sorting", () => {
  const row = lone([90, 10, 11]);
  assert.equal(row.latency, 11);
  assert.equal(row.count, 3);
  assert.equal(row.used, 3);
  assert.equal(row.reason, null);
});

test("the median of an even count is the mean of the two middle samples", () => {
  const row = lone([30, 10]);
  assert.equal(row.latency, 20);
  assert.equal(row.count, 2);
  assert.equal(row.used, 2);
});

test("one sample is its own median and zero is allowed", () => {
  assert.equal(lone([7]).latency, 7);
  const zero = lone([-0]);
  assert.equal(zero.latency, 0);
  assert.equal(Object.is(zero.latency, -0), false);
  assert.equal(lone([0, 0, 0]).latency, 0);
});

test("sample order and extra own properties do not change the median", () => {
  const samples = [9, 1, 8, 2, 7];
  samples.extra = 999;
  const row = lone(samples);
  assert.equal(row.latency, 7);
  assert.equal(row.count, 5);
  assert.equal(samples.length, 5);
  assert.deepEqual(Array.from(samples), [9, 1, 8, 2, 7]);
  assert.equal(samples.extra, 999);
});

test("trim drops the highest samples and keeps the lowest before the median", () => {
  const row = lone([1, 2, 3, 4, 100], { trim: 0.2 });
  assert.equal(row.latency, 2.5);
  assert.equal(row.count, 5);
  assert.equal(row.used, 4);
  const untrimmed = lone([1, 2, 3, 4, 100]);
  assert.equal(untrimmed.latency, 3);
  assert.equal(untrimmed.used, 5);
});

test("trim of 0.4 on five samples keeps the three lowest", () => {
  const row = lone([300, 10, 200, 20, 100], { trim: 0.4 });
  assert.equal(row.latency, 20);
  assert.equal(row.count, 5);
  assert.equal(row.used, 3);
});

test("a trim that drops nothing leaves an even median in place", () => {
  const row = lone([10, 400], { trim: 0.4 });
  assert.equal(row.latency, 205);
  assert.equal(row.used, 2);
});

test("two Number.MAX_VALUE samples have a non-finite median", () => {
  assert.throws(() => lone([Number.MAX_VALUE, Number.MAX_VALUE]), {
    name: "RangeError",
    message: "median must be finite"
  });
});

test("trim removes a high sample before the median is averaged", () => {
  const row = lone([0, 0, Number.MAX_VALUE], { trim: 0.4 });
  assert.equal(row.latency, 0);
  assert.equal(row.used, 2);
  const kept = lone([0, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], { trim: 0.4 });
  assert.equal(kept.latency, Number.MAX_VALUE);
  assert.equal(kept.used, 3);
});

test("each player-region pair is summarised on its own", () => {
  const result = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [10, 30] }), player("b", { "region-a": [40] })],
    rule: { type: "mean" }
  });
  assert.equal(result.regions[0].players[0].latency, 20);
  assert.equal(result.regions[0].players[1].latency, 40);
  assert.equal(result.regions[0].score, 30);
});

test("a player with more samples is not weighted more heavily in the score", () => {
  const many = [];
  for (let index = 0; index < 100; index += 1) {
    many.push(10);
  }
  const result = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": many }), player("b", { "region-a": [50] })],
    rule: { type: "mean" }
  });
  assert.equal(result.regions[0].players[0].count, 100);
  assert.equal(result.regions[0].players[0].latency, 10);
  assert.equal(result.regions[0].score, 30);
  assert.deepEqual(
    many,
    Array.from({ length: 100 }, () => 10)
  );
});
