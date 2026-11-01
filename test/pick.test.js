import assert from "node:assert/strict";
import test from "node:test";
import { pickRegion } from "../src/index.js";
import { player, playerRow, regionRow } from "./helpers.js";

const players = [
  player("a", { "region-a": [20], "region-b": [70] }),
  player("b", { "region-a": [110], "region-b": [80] })
];

function row(id, latency, count = 1, used = 1, reason = null) {
  return playerRow(id, latency, count, used, reason);
}

test("the default rule minimises the worst player latency", () => {
  const choice = pickRegion({
    regions: ["region-a", "region-b"],
    players
  });
  assert.deepEqual(choice, {
    status: "chosen",
    region: "region-b",
    trim: 0,
    rule: { type: "worst" },
    regions: [
      regionRow("region-a", "eligible", null, 110, [row("a", 20), row("b", 110)]),
      regionRow("region-b", "eligible", null, 80, [row("a", 70), row("b", 80)])
    ]
  });
  assert.equal(choice.region, "region-b");
  assert.equal(choice.regions[0].score, 110);
  assert.equal(choice.regions[1].score, 80);
});

test("the mean rule on the same players chooses the other region", () => {
  const averaged = pickRegion({
    regions: ["region-a", "region-b"],
    players,
    rule: { type: "mean" }
  });
  assert.equal(averaged.region, "region-a");
  assert.equal(averaged.regions[0].score, 65);
  assert.equal(averaged.regions[1].score, 75);
  assert.deepEqual(averaged.rule, { type: "mean" });
  assert.deepEqual(players[0].samples["region-a"], [20]);
});

test("a cap excludes the region the mean rule would have chosen", () => {
  const capped = pickRegion({
    regions: ["region-a", "region-b"],
    players,
    rule: { type: "capped-mean", cap: 100 }
  });
  assert.equal(capped.region, "region-b");
  assert.equal(capped.regions[0].status, "excluded");
  assert.equal(capped.regions[0].reason, "cap");
  assert.equal(capped.regions[0].score, null);
  assert.equal(capped.regions[0].players[1].reason, "cap");
  assert.equal(capped.regions[0].players[1].latency, 110);
  assert.equal(capped.regions[0].players[0].reason, null);
  assert.equal(capped.regions[1].status, "eligible");
  assert.equal(capped.regions[1].score, 75);
  assert.equal(capped.rule.cap, 100);
});

test("a latency equal to the cap stays eligible and one unit above is excluded", () => {
  const equal = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [100] })],
    rule: { type: "capped-mean", cap: 100 }
  });
  assert.equal(equal.status, "chosen");
  assert.equal(equal.regions[0].players[0].reason, null);
  assert.equal(equal.regions[0].score, 100);
  const over = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [101] })],
    rule: { type: "capped-mean", cap: 100 }
  });
  assert.equal(over.status, "none");
  assert.equal(over.regions[0].reason, "cap");
  const zero = pickRegion({
    regions: ["region-a", "region-b"],
    players: [player("a", { "region-a": [0], "region-b": [1] })],
    rule: { type: "capped-mean", cap: 0 }
  });
  assert.equal(zero.region, "region-a");
  assert.equal(zero.regions[1].reason, "cap");
});

test("a missing key and an empty array both exclude the region as empty", () => {
  const missing = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("a", { "region-a": [30], "region-b": [30] }),
      player("b", { "region-b": [40, 42] })
    ],
    rule: { type: "mean" }
  });
  assert.equal(missing.region, "region-b");
  assert.equal(missing.regions[0].reason, "empty");
  assert.equal(missing.regions[0].score, null);
  assert.equal(missing.regions[0].players[1].latency, null);
  assert.equal(missing.regions[0].players[1].count, 0);
  assert.equal(missing.regions[0].players[1].used, 0);
  assert.equal(missing.regions[0].players[1].reason, "empty");
  assert.equal(missing.regions[1].score, 35.5);
  assert.equal(missing.regions[1].players[1].latency, 41);
  assert.equal(missing.regions[1].players[1].used, 2);
  const emptyArray = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [] })]
  });
  assert.equal(emptyArray.status, "none");
  assert.equal(emptyArray.region, null);
  assert.equal(emptyArray.regions[0].reason, "empty");
  assert.deepEqual(emptyArray.regions[0].players[0], row("a", null, 0, 0, "empty"));
});

test("empty takes priority over cap and the player reasons stay independent", () => {
  const mixed = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [] }), player("b", { "region-a": [150] })],
    rule: { type: "capped-mean", cap: 100 }
  });
  assert.equal(mixed.status, "none");
  assert.equal(mixed.regions[0].reason, "empty");
  assert.equal(mixed.regions[0].score, null);
  assert.equal(mixed.regions[0].players[0].reason, "empty");
  assert.equal(mixed.regions[0].players[1].reason, "cap");
  assert.equal(mixed.regions[0].players[1].latency, 150);
});

test("trim can change the chosen region and does not sort the input", () => {
  const samples = {
    "region-a": [10, 20, 100, 200, 300],
    "region-b": [50]
  };
  const raw = pickRegion({
    regions: ["region-a", "region-b"],
    players: [player("a", samples)],
    rule: { type: "worst" }
  });
  const trimmed = pickRegion({
    regions: ["region-a", "region-b"],
    players: [player("a", samples)],
    trim: 0.4,
    rule: { type: "worst" }
  });
  assert.equal(raw.region, "region-b");
  assert.equal(raw.regions[0].players[0].latency, 100);
  assert.equal(raw.regions[0].score, 100);
  assert.equal(trimmed.region, "region-a");
  assert.equal(trimmed.trim, 0.4);
  assert.equal(trimmed.regions[0].players[0].latency, 20);
  assert.equal(trimmed.regions[0].players[0].count, 5);
  assert.equal(trimmed.regions[0].players[0].used, 3);
  assert.equal(trimmed.regions[0].score, 20);
  assert.equal(trimmed.regions[1].score, 50);
  assert.deepEqual(samples["region-a"], [10, 20, 100, 200, 300]);
});

test("equal scores keep the earlier region id and not the lexicographic id", () => {
  const tiedPlayers = [
    player("a", { "region-a": [10], "region-b": [10] }),
    player("b", { "region-a": [20], "region-b": [20] })
  ];
  const forward = pickRegion({
    regions: ["region-a", "region-b"],
    players: tiedPlayers
  });
  const backward = pickRegion({
    regions: ["region-b", "region-a"],
    players: tiedPlayers
  });
  assert.equal(forward.region, "region-a");
  assert.equal(forward.regions[0].score, 20);
  assert.equal(forward.regions[1].score, 20);
  assert.equal(backward.region, "region-b");
  assert.equal(backward.regions[0].id, "region-b");
  assert.deepEqual(
    backward.regions.map((entry) => entry.id),
    ["region-b", "region-a"]
  );
});

test("a later region wins when its score is strictly lower", () => {
  const result = pickRegion({
    regions: ["region-a", "region-b", "region-c"],
    players: [player("a", { "region-b": [20], "region-c": [10] })]
  });
  assert.equal(result.region, "region-c");
  assert.equal(result.regions[0].reason, "empty");
  assert.equal(result.regions[1].score, 20);
  assert.equal(result.regions[2].score, 10);
  const tied = pickRegion({
    regions: ["region-a", "region-b", "region-c"],
    players: [player("a", { "region-b": [10], "region-c": [10] })]
  });
  assert.equal(tied.region, "region-b");
});

test("scores that differ by one epsilon do not tie", () => {
  const lower = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("a", {
        "region-a": [1],
        "region-b": [1 + Number.EPSILON]
      })
    ]
  });
  assert.equal(lower.region, "region-a");
  const higher = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("a", {
        "region-a": [1 + Number.EPSILON],
        "region-b": [1]
      })
    ]
  });
  assert.equal(higher.region, "region-b");
});

test("negative zero samples tie with zero and are stored as zero", () => {
  const result = pickRegion({
    regions: ["region-a", "region-b"],
    players: [player("a", { "region-a": [-0], "region-b": [0] })]
  });
  assert.equal(result.region, "region-a");
  assert.equal(result.regions[0].score, 0);
  assert.equal(result.regions[1].score, 0);
  assert.equal(Object.is(result.regions[0].players[0].latency, -0), false);
  assert.equal(Object.is(result.regions[1].players[0].latency, -0), false);
});

test("every region excluded produces the none result", () => {
  const blocked = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("a", { "region-a": [10], "region-b": [200] }),
      player("b", { "region-b": [180] })
    ],
    rule: { type: "capped-mean", cap: 100 }
  });
  assert.deepEqual(blocked, {
    status: "none",
    region: null,
    trim: 0,
    rule: { type: "capped-mean", cap: 100 },
    regions: [
      regionRow("region-a", "excluded", "empty", null, [
        row("a", 10),
        row("b", null, 0, 0, "empty")
      ]),
      regionRow("region-b", "excluded", "cap", null, [
        row("a", 200, 1, 1, "cap"),
        row("b", 180, 1, 1, "cap")
      ])
    ]
  });
  assert.equal(blocked.status, "none");
  assert.equal(blocked.region, null);
  assert.equal(blocked.regions[1].reason, "cap");
});

test("a median is not the mean of the raw samples", () => {
  const middle = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [90, 10, 11] })]
  });
  assert.equal(middle.region, "region-a");
  assert.equal(middle.regions[0].players[0].latency, 11);
  assert.equal(middle.regions[0].score, 11);
  const split = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [10, 30] }), player("b", { "region-a": [40] })],
    rule: { type: "mean" }
  });
  assert.equal(split.regions[0].players[0].latency, 20);
  assert.equal(split.regions[0].players[1].latency, 40);
  assert.equal(split.regions[0].score, 30);
});

test("three regions separate the worst rule, the mean rule, and a mean tie", () => {
  const group = [
    player("a", { "region-a": [10], "region-b": [50], "region-c": [70] }),
    player("b", { "region-a": [20], "region-b": [50], "region-c": [10] }),
    player("c", { "region-a": [90], "region-b": [50], "region-c": [10] })
  ];
  const worst = pickRegion({
    regions: ["region-a", "region-b", "region-c"],
    players: group
  });
  assert.equal(worst.region, "region-b");
  assert.deepEqual(
    worst.regions.map((entry) => entry.score),
    [90, 50, 70]
  );
  const mean = pickRegion({
    regions: ["region-a", "region-b", "region-c"],
    players: [
      player("a", { "region-a": [10], "region-b": [50], "region-c": [70] }),
      player("b", { "region-a": [20], "region-b": [50], "region-c": [10] }),
      player("c", { "region-a": [90], "region-b": [50], "region-c": [10] })
    ],
    rule: { type: "mean" }
  });
  assert.equal(mean.regions[0].score, 40);
  assert.equal(mean.regions[1].score, 50);
  assert.equal(mean.regions[2].score, 30);
  assert.equal(mean.region, "region-c");
  const tied = pickRegion({
    regions: ["region-a", "region-b", "region-c"],
    players: [
      player("a", { "region-a": [10], "region-b": [50], "region-c": [70] }),
      player("b", { "region-a": [20], "region-b": [50], "region-c": [10] }),
      player("c", { "region-a": [90], "region-b": [50], "region-c": [40] })
    ],
    rule: { type: "mean" }
  });
  assert.equal(tied.regions[0].score, 40);
  assert.equal(tied.regions[2].score, 40);
  assert.equal(tied.region, "region-a");
});

test("the cap is applied to the summarised latency, not to each raw sample", () => {
  const result = pickRegion({
    regions: ["region-a"],
    players: [player("a", { "region-a": [1, 2, 500] })],
    rule: { type: "capped-mean", cap: 10 }
  });
  assert.equal(result.status, "chosen");
  assert.equal(result.regions[0].players[0].latency, 2);
  assert.equal(result.regions[0].reason, null);
});

test("omitted rule and trim match an explicit worst rule and a trim of 0", () => {
  const implicit = pickRegion({
    regions: ["region-a", "region-b"],
    players
  });
  const explicit = pickRegion({
    regions: ["region-a", "region-b"],
    players,
    rule: { type: "worst" },
    trim: 0
  });
  assert.deepEqual(implicit, explicit);
  assert.notEqual(implicit, explicit);
  assert.notEqual(implicit.rule, explicit.rule);
});

test("results are frozen, do not share references, and do not retain the input", () => {
  const samples = [10, 20, 30];
  const options = {
    regions: ["region-a"],
    players: [player("a", { "region-a": samples })],
    label: "ignored",
    now: 5
  };
  const first = pickRegion(options);
  const second = pickRegion(options);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.regions, second.regions);
  assert.notEqual(first.rule, second.rule);
  assert.notEqual(first.regions[0], second.regions[0]);
  assert.notEqual(first.regions[0].players, second.regions[0].players);
  assert.notEqual(first.regions[0].players[0], second.regions[0].players[0]);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.rule), true);
  assert.equal(Object.isFrozen(first.regions), true);
  assert.equal(Object.isFrozen(first.regions[0]), true);
  assert.equal(Object.isFrozen(first.regions[0].players), true);
  assert.equal(Object.isFrozen(first.regions[0].players[0]), true);
  assert.equal(Object.isFrozen(options), false);
  assert.equal(Object.isFrozen(options.players), false);
  assert.equal(Object.isFrozen(options.players[0]), false);
  assert.equal(Object.isFrozen(samples), false);
  assert.throws(() => {
    first.regions.push(first.regions[0]);
  }, TypeError);
  assert.throws(() => {
    first.region = "region-b";
  }, TypeError);
  assert.equal(first.regions[0].players[0].samples, undefined);
  assert.deepEqual(Object.keys(first).sort(), ["region", "regions", "rule", "status", "trim"]);
  assert.deepEqual(Object.keys(first.regions[0]).sort(), [
    "id",
    "players",
    "reason",
    "score",
    "status"
  ]);
  assert.deepEqual(Object.keys(first.regions[0].players[0]).sort(), [
    "count",
    "id",
    "latency",
    "reason",
    "used"
  ]);
  assert.equal(first.regions[0].players[0].latency, 20);
  samples.push(1000);
  const third = pickRegion(options);
  assert.equal(first.regions[0].players[0].latency, 20);
  assert.equal(first.regions[0].players[0].count, 3);
  assert.equal(third.regions[0].players[0].count, 4);
  assert.equal(third.regions[0].players[0].latency, 25);
  assert.deepEqual(samples, [10, 20, 30, 1000]);
});

test("only own sample keys are read, including on a null prototype", () => {
  const proto = { "region-a": "not-an-array" };
  const inherited = Object.create(proto);
  inherited["region-b"] = [4, 6];
  const result = pickRegion({
    regions: ["region-a", "region-b"],
    players: [player("a", inherited)]
  });
  assert.equal(result.region, "region-b");
  assert.equal(result.regions[0].reason, "empty");
  assert.equal(result.regions[1].players[0].latency, 5);
  const samples = Object.create(null);
  samples["region-a"] = [8];
  const options = Object.create(null);
  options.regions = ["region-a"];
  options.players = [player("a", samples)];
  const bare = pickRegion(options);
  assert.equal(bare.region, "region-a");
  assert.equal(bare.regions[0].score, 8);
});

test("player ids are treated as plain strings", () => {
  const result = pickRegion({
    regions: ["region-a", "region-b"],
    players: [
      player("__proto__", { "region-a": [5, 7], "region-b": [9] }),
      player("constructor", { "region-a": [1], "region-b": [3] })
    ],
    rule: { type: "mean" }
  });
  assert.equal(result.region, "region-a");
  assert.equal(result.regions[0].players[0].id, "__proto__");
  assert.equal(result.regions[0].players[0].latency, 6);
  assert.equal(result.regions[0].score, 3.5);
  assert.equal(result.regions[1].score, 6);
  assert.throws(
    () =>
      pickRegion({
        regions: ["region-a"],
        players: [
          player("__proto__", { "region-a": [1] }),
          player("__proto__", { "region-a": [2] })
        ]
      }),
    {
      name: "TypeError",
      message: "player ids must be unique"
    }
  );
});

test("a second call does not observe a frozen result from the first", () => {
  const options = {
    regions: ["region-a"],
    players: [player("a", { "region-a": [2, 4, 6] })]
  };
  const first = pickRegion(options);
  assert.equal(Object.isFrozen(first.rule), true);
  const second = pickRegion(options);
  assert.equal(second.regions[0].score, 4);
  assert.notEqual(first.rule, second.rule);
});
