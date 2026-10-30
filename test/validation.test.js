import assert from "node:assert/strict";
import test from "node:test";
import { pickRegion } from "../src/index.js";
import { player } from "./helpers.js";

const REGIONS = "regions must be a non-empty array";
const REGION_ID = "region id must be a non-empty string";
const REGION_UNIQUE = "region ids must be unique";
const PLAYERS = "players must be a non-empty array";
const PLAYER = "player must be an object";
const PLAYER_ID = "player id must be a non-empty string";
const PLAYER_UNIQUE = "player ids must be unique";
const SAMPLES_OBJECT = "samples must be an object";
const SAMPLES_ARRAY = "samples must be an array";
const SAMPLE = "sample must be a finite number greater than or equal to 0";
const TRIM = "trim must be a finite number greater than or equal to 0 and less than 0.5";
const RULE = "rule must be an object";
const TYPE = "rule type must be worst, mean, or capped-mean";
const CAP = "cap must be a finite number greater than or equal to 0";
const MEDIAN = "median must be finite";
const SCORE = "score must be finite";

function valid(extra = {}) {
  return {
    regions: ["region-a"],
    players: [player("a", { "region-a": [10] })],
    ...extra
  };
}

test("pickRegion rejects a bad options object before it reads fields", () => {
  assert.throws(() => pickRegion(), {
    name: "TypeError",
    message: "options must be an object"
  });
  for (const options of [undefined, null, [], "regions", 1, true, false]) {
    assert.throws(() => pickRegion(options), {
      name: "TypeError",
      message: "options must be an object"
    });
  }
});

test("pickRegion reads regions, players, trim, rule, then samples", () => {
  assert.throws(() => pickRegion({}), {
    name: "TypeError",
    message: REGIONS
  });
  assert.throws(
    () =>
      pickRegion({
        players: [null],
        trim: 9,
        rule: null
      }),
    {
      name: "TypeError",
      message: REGIONS
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: [""],
        players: [null],
        trim: 9,
        rule: null
      }),
    {
      name: "TypeError",
      message: REGION_ID
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [null],
        trim: 9,
        rule: null
      }),
    {
      name: "TypeError",
      message: PLAYER
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [player("a", { "region-a": [Number.NaN] })],
        trim: 9,
        rule: null
      }),
    {
      name: "RangeError",
      message: TRIM
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [player("a", { "region-a": [Number.NaN] })],
        trim: 0,
        rule: null
      }),
    {
      name: "TypeError",
      message: RULE
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [player("a", { "region-a": [Number.NaN] })],
        rule: { type: "nope" }
      }),
    {
      name: "TypeError",
      message: TYPE
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [player("a", { "region-a": [Number.NaN] })],
        rule: { type: "capped-mean", cap: -1 }
      }),
    {
      name: "RangeError",
      message: CAP
    }
  );
  assert.throws(() => pickRegion(valid({ players: [player("a", { "region-a": [Number.NaN] })] })), {
    name: "RangeError",
    message: SAMPLE
  });
});

test("regions must be a non-empty array of unique non-empty strings", () => {
  for (const regions of [undefined, null, "region-a", { "region-a": true }, [], 1]) {
    assert.throws(() => pickRegion(valid({ regions })), {
      name: "TypeError",
      message: REGIONS
    });
  }
  assert.throws(() => pickRegion(valid({ regions: [""] })), {
    name: "TypeError",
    message: REGION_ID
  });
  assert.throws(() => pickRegion(valid({ regions: ["region-a", ""] })), {
    name: "TypeError",
    message: REGION_ID
  });
  for (const id of [1, null, undefined, true, false, ["region-a"], { id: "region-a" }]) {
    assert.throws(() => pickRegion(valid({ regions: [id] })), {
      name: "TypeError",
      message: REGION_ID
    });
  }
  assert.throws(() => pickRegion(valid({ regions: ["region-a", "region-a"] })), {
    name: "TypeError",
    message: REGION_UNIQUE
  });
  assert.throws(() => pickRegion(valid({ regions: ["region-b", "region-a", "region-b"] })), {
    name: "TypeError",
    message: REGION_UNIQUE
  });
  const distinct = pickRegion(
    valid({
      regions: ["region-a", "region-A"],
      players: [player("a", { "region-a": [1], "region-A": [2] })]
    })
  );
  assert.equal(distinct.region, "region-a");
  assert.equal(distinct.regions[1].id, "region-A");
  const spaced = pickRegion(
    valid({
      regions: [" "],
      players: [player("a", { " ": [4] })]
    })
  );
  assert.equal(spaced.region, " ");
});

test("players must be a non-empty array of objects with unique ids and a samples object", () => {
  for (const players of [undefined, null, "a", { id: "a" }, [], 1]) {
    assert.throws(() => pickRegion(valid({ players })), {
      name: "TypeError",
      message: PLAYERS
    });
  }
  for (const entry of [null, [], "a", 1, true]) {
    assert.throws(() => pickRegion(valid({ players: [entry] })), {
      name: "TypeError",
      message: PLAYER
    });
  }
  assert.throws(() => pickRegion(valid({ players: [{ samples: { "region-a": [1] } }] })), {
    name: "TypeError",
    message: PLAYER_ID
  });
  assert.throws(() => pickRegion(valid({ players: [{ id: "", samples: { "region-a": [1] } }] })), {
    name: "TypeError",
    message: PLAYER_ID
  });
  for (const id of [1, null, undefined, true, ["a"]]) {
    assert.throws(() => pickRegion(valid({ players: [{ id, samples: { "region-a": [1] } }] })), {
      name: "TypeError",
      message: PLAYER_ID
    });
  }
  assert.throws(
    () =>
      pickRegion(
        valid({
          players: [player("a", { "region-a": [1] }), player("a", { "region-a": [2] })]
        })
      ),
    {
      name: "TypeError",
      message: PLAYER_UNIQUE
    }
  );
  assert.throws(
    () =>
      pickRegion(
        valid({
          players: [
            player("b", { "region-a": [1] }),
            player("a", { "region-a": [1] }),
            player("b", { "region-a": [1] })
          ]
        })
      ),
    {
      name: "TypeError",
      message: PLAYER_UNIQUE
    }
  );
  assert.throws(() => pickRegion(valid({ players: [{ id: "a" }] })), {
    name: "TypeError",
    message: SAMPLES_OBJECT
  });
  for (const samples of [null, [], "region-a", 1, true]) {
    assert.throws(() => pickRegion(valid({ players: [{ id: "a", samples }] })), {
      name: "TypeError",
      message: SAMPLES_OBJECT
    });
  }
  assert.throws(
    () =>
      pickRegion(
        valid({
          players: [player("a", {}), player("", {})]
        })
      ),
    {
      name: "TypeError",
      message: PLAYER_ID
    }
  );
  const ordered = pickRegion(
    valid({
      regions: ["region-a"],
      players: [player("c", { "region-a": [3] }), player("a", { "region-a": [1] })]
    })
  );
  assert.deepEqual(
    ordered.regions[0].players.map((row) => row.id),
    ["c", "a"]
  );
});

test("trim is an optional finite number from 0 up to but not including 0.5", () => {
  for (const trim of [
    -0.1,
    0.5,
    1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "0",
    null,
    true,
    false,
    [],
    {}
  ]) {
    assert.throws(() => pickRegion(valid({ trim })), {
      name: "RangeError",
      message: TRIM
    });
  }
  assert.equal(pickRegion(valid()).trim, 0);
  assert.equal(pickRegion(valid({ trim: undefined })).trim, 0);
  const negativeZero = pickRegion(valid({ trim: -0 }));
  assert.equal(negativeZero.trim, 0);
  assert.equal(Object.is(negativeZero.trim, -0), false);
  const justUnder = 0.5 - Number.EPSILON;
  const accepted = pickRegion(
    valid({
      trim: justUnder,
      players: [player("a", { "region-a": [4, 8] })]
    })
  );
  assert.equal(accepted.trim, justUnder);
  assert.equal(accepted.regions[0].players[0].latency, 6);
  assert.equal(accepted.regions[0].players[0].used, 2);
});

test("rule type is read before cap, and cap is read only for capped-mean", () => {
  for (const rule of [null, [], "worst", 1, true]) {
    assert.throws(() => pickRegion(valid({ rule })), {
      name: "TypeError",
      message: RULE
    });
  }
  for (const type of [undefined, "WORST", "Worst", "capped_mean", "capped mean", "most", 1, true]) {
    assert.throws(() => pickRegion(valid({ rule: { type, cap: -1 } })), {
      name: "TypeError",
      message: TYPE
    });
  }
  assert.throws(() => pickRegion(valid({ rule: { type: "capped-mean" } })), {
    name: "RangeError",
    message: CAP
  });
  for (const cap of [
    undefined,
    null,
    -1,
    -0.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "100",
    true,
    false
  ]) {
    assert.throws(() => pickRegion(valid({ rule: { type: "capped-mean", cap } })), {
      name: "RangeError",
      message: CAP
    });
  }
  const worst = pickRegion(valid({ rule: { type: "worst", cap: "nope" } }));
  assert.deepEqual(worst.rule, { type: "worst" });
  const mean = pickRegion(
    valid({
      rule: { type: "mean", cap: -1 },
      players: [player("a", { "region-a": [40] })]
    })
  );
  assert.deepEqual(mean.rule, { type: "mean" });
  assert.equal(mean.region, "region-a");
  const capped = pickRegion(valid({ rule: { type: "capped-mean", cap: -0, extra: true } }));
  assert.deepEqual(capped.rule, { type: "capped-mean", cap: 0 });
  assert.equal(Object.is(capped.rule.cap, -0), false);
  assert.equal(pickRegion(valid({ rule: undefined })).rule.type, "worst");
});

test("a listed region's samples must be an array of finite numbers greater than or equal to 0", () => {
  assert.throws(() => pickRegion(valid({ players: [player("a", { "region-a": "10" })] })), {
    name: "TypeError",
    message: SAMPLES_ARRAY
  });
  for (const value of [null, {}, 10, undefined, true]) {
    assert.throws(() => pickRegion(valid({ players: [player("a", { "region-a": value })] })), {
      name: "TypeError",
      message: SAMPLES_ARRAY
    });
  }
  for (const sample of [
    -1,
    -0.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "0",
    null,
    undefined,
    true,
    false,
    1n
  ]) {
    assert.throws(() => pickRegion(valid({ players: [player("a", { "region-a": [sample] })] })), {
      name: "RangeError",
      message: SAMPLE
    });
  }
  const hole = [10, 20, 30];
  delete hole[1];
  assert.throws(() => pickRegion(valid({ players: [player("a", { "region-a": hole })] })), {
    name: "RangeError",
    message: SAMPLE
  });
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a", "region-b"],
        players: [
          player("a", { "region-a": "nope", "region-b": [Number.NaN] }),
          player("b", { "region-a": [Number.NaN], "region-b": [1] })
        ]
      }),
    {
      name: "TypeError",
      message: SAMPLES_ARRAY
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a", "region-b"],
        players: [
          player("a", { "region-a": [1], "region-b": "nope" }),
          player("b", { "region-a": [Number.NaN], "region-b": [1] })
        ]
      }),
    {
      name: "TypeError",
      message: SAMPLES_ARRAY
    }
  );
  const ignored = pickRegion(
    valid({
      players: [
        player("a", {
          "region-a": [5],
          "region-z": "bad",
          other: [Number.NaN]
        })
      ]
    })
  );
  assert.equal(ignored.region, "region-a");
  assert.equal(ignored.regions[0].score, 5);
});

test("every sample array is validated before any median is computed", () => {
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [
          player("a", { "region-a": [Number.MAX_VALUE, Number.MAX_VALUE] }),
          player("b", { "region-a": [Number.NaN] })
        ]
      }),
    {
      name: "RangeError",
      message: SAMPLE
    }
  );
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [
          player("a", { "region-a": [Number.MAX_VALUE, Number.MAX_VALUE] }),
          player("b", { "region-a": [1] })
        ],
        rule: { type: "mean" }
      }),
    {
      name: "RangeError",
      message: MEDIAN
    }
  );
});

test("an eligible non-finite mean throws and an excluded one does not", () => {
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [
          player("a", { "region-a": [Number.MAX_VALUE] }),
          player("b", { "region-a": [Number.MAX_VALUE] })
        ],
        rule: { type: "mean" }
      }),
    {
      name: "RangeError",
      message: SCORE
    }
  );
  const excluded = pickRegion({
    regions: ["region-a"],
    players: [
      player("a", { "region-a": [Number.MAX_VALUE] }),
      player("b", { "region-a": [Number.MAX_VALUE] })
    ],
    rule: { type: "capped-mean", cap: 1 }
  });
  assert.equal(excluded.status, "none");
  assert.equal(excluded.regions[0].reason, "cap");
  assert.equal(excluded.regions[0].score, null);
  const kept = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("a", { "region-a": [Number.MAX_VALUE], "region-b": [4] }),
      player("b", { "region-a": [Number.MAX_VALUE], "region-b": [6] })
    ],
    rule: { type: "capped-mean", cap: 10 }
  });
  assert.equal(kept.region, "region-b");
  assert.equal(kept.regions[0].reason, "cap");
  assert.equal(kept.regions[1].score, 5);
  const worst = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [Number.MAX_VALUE] }), player("b", { "region-a": [1] })],
    rule: { type: "worst" }
  });
  assert.equal(worst.region, "region-a");
  assert.equal(worst.regions[0].score, Number.MAX_VALUE);
});

test("a frozen valid input is accepted and a frozen bad sample still reports the sample error", () => {
  const samples = Object.freeze([3, 1, 2]);
  const samplesObject = Object.freeze({ "region-a": samples });
  const entry = Object.freeze(player("a", samplesObject));
  const options = Object.freeze({
    regions: Object.freeze(["region-a"]),
    players: Object.freeze([entry]),
    rule: Object.freeze({ type: "worst" })
  });
  const result = pickRegion(options);
  assert.equal(result.regions[0].players[0].latency, 2);
  assert.deepEqual(samples, [3, 1, 2]);
  const bad = Object.freeze([1, Number.NaN, 2]);
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [player("a", { "region-a": bad })]
      }),
    {
      name: "RangeError",
      message: SAMPLE
    }
  );
  assert.deepEqual(bad, [1, Number.NaN, 2]);
});

test("a minimal valid call chooses that region", () => {
  const options = valid();
  const result = pickRegion(options);
  assert.equal(result.status, "chosen");
  assert.equal(result.region, "region-a");
  assert.equal(result.regions[0].players[0].latency, 10);
  assert.equal(options.players[0].samples["region-a"][0], 10);
});
