import { CAPPED_MEAN, MEAN, WORST } from "./constants.js";
import { isObject, normalizeZero } from "./shape.js";

const RULE_MESSAGE = "rule must be an object";
const TYPE_MESSAGE = "rule type must be worst, mean, or capped-mean";
const CAP_MESSAGE = "cap must be a finite number greater than or equal to 0";

export function readRule(options) {
  if (!Object.hasOwn(options, "rule") || options.rule === undefined) {
    return { type: WORST };
  }
  const rule = options.rule;
  if (!isObject(rule)) {
    throw new TypeError(RULE_MESSAGE);
  }
  if (rule.type === WORST) {
    return { type: WORST };
  }
  if (rule.type === MEAN) {
    return { type: MEAN };
  }
  if (rule.type === CAPPED_MEAN) {
    return { type: CAPPED_MEAN, cap: readCap(rule) };
  }
  throw new TypeError(TYPE_MESSAGE);
}

function readCap(rule) {
  if (
    !Object.hasOwn(rule, "cap") ||
    typeof rule.cap !== "number" ||
    !Number.isFinite(rule.cap) ||
    rule.cap < 0
  ) {
    throw new RangeError(CAP_MESSAGE);
  }
  return normalizeZero(rule.cap);
}
