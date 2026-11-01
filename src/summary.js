import { normalizeZero } from "./shape.js";

const MEDIAN_MESSAGE = "median must be finite";

export function summariseSamples(samples, trim) {
  const count = samples.length;
  if (count === 0) {
    return { latency: null, count: 0, used: 0 };
  }
  const drop = Math.floor(count * trim);
  const used = count - drop;
  const sorted = samples.slice().sort(compareNumber);
  const kept = sorted.slice(0, used);
  return {
    latency: median(kept),
    count,
    used
  };
}

function median(sorted) {
  const length = sorted.length;
  const mid = Math.floor(length / 2);
  if (length % 2 === 1) {
    return normalizeZero(sorted[mid]);
  }
  const value = (sorted[mid - 1] + sorted[mid]) / 2;
  if (!Number.isFinite(value)) {
    throw new RangeError(MEDIAN_MESSAGE);
  }
  return normalizeZero(value);
}

function compareNumber(left, right) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
