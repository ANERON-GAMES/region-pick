# @aneron/region-pick

Choose a game server region for a group of players from latency samples.

## Purpose

`@aneron/region-pick` chooses one region id for a group of players. Each player supplies round-trip samples for the regions they measured. The module summarises every player-region pair as a median, after an optional high-side trim, then scores each region. The score is the worst player latency, the mean of the player latencies, or that mean with a per-player cap. A region where any player has no samples is excluded. Under the capped rule, a region where any player latency exceeds the cap is excluded. The chosen region is the eligible region with the lowest score. Equal scores keep the earlier region id. If every region is excluded, the result says so.

The module does not mutate its arguments. It does not read a clock, start a timer, draw a random number, or open a socket. It has no runtime dependencies.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/region-pick`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/region-pick.git
cd region-pick
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/region-pick
```

```js
import { pickRegion } from "@aneron/region-pick";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

Latency values below are numbers in one unit chosen by the caller. The module does not treat them as milliseconds.

The default rule minimises the worst player latency. Each array below has one sample, so the latency is that sample.

```js
import { pickRegion } from "@aneron/region-pick";

const players = [
  {
    id: "a",
    samples: { "region-a": [20], "region-b": [70] }
  },
  {
    id: "b",
    samples: { "region-a": [110], "region-b": [80] }
  }
];

const choice = pickRegion({
  regions: ["region-a", "region-b"],
  players
});
```

`choice.status` is `"chosen"`. `choice.region` is `"region-b"`. `choice.rule` is `{ type: "worst" }`. `choice.trim` is `0`.

`choice.regions[0].id` is `"region-a"`. `choice.regions[0].status` is `"eligible"`. `choice.regions[0].score` is `110`. `choice.regions[0].players[0].latency` is `20`. `choice.regions[0].players[1].latency` is `110`.

`choice.regions[1].id` is `"region-b"`. `choice.regions[1].score` is `80`. `choice.regions[1].players[0].latency` is `70`. `choice.regions[1].players[1].latency` is `80`.

Region-a worst is `110`. Region-b worst is `80`. The lower worst wins.

The mean rule on the same players chooses region-a. The mean of `20` and `110` is `65`. The mean of `70` and `80` is `75`.

```js
const averaged = pickRegion({
  regions: ["region-a", "region-b"],
  players,
  rule: { type: "mean" }
});
```

`averaged.region` is `"region-a"`. `averaged.regions[0].score` is `65`. `averaged.regions[1].score` is `75`. `choice.region` is still `"region-b"`. The first call is not affected by the second. `players[0].samples["region-a"]` is still `[20]`.

A cap of `100` excludes region-a because player `b` has latency `110`. The mean rule would have chosen region-a. The capped rule chooses region-b.

```js
const capped = pickRegion({
  regions: ["region-a", "region-b"],
  players,
  rule: { type: "capped-mean", cap: 100 }
});
```

`capped.region` is `"region-b"`. `capped.regions[0].status` is `"excluded"`. `capped.regions[0].reason` is `"cap"`. `capped.regions[0].score` is `null`. `capped.regions[0].players[1].reason` is `"cap"`. `capped.regions[0].players[1].latency` is `110`. `capped.regions[1].status` is `"eligible"`. `capped.regions[1].score` is `75`. `capped.rule.cap` is `100`.

A missing array excludes the region. Player `b` has no samples for region-a. The key is absent. Region-b has samples for both players. Player `b` on region-b has samples `40` and `42`, so the latency is `(40 + 42) / 2`, which is `41`. The mean of `30` and `41` is `35.5`.

```js
const missing = pickRegion({
  regions: ["region-a", "region-b"],
  players: [
    { id: "a", samples: { "region-a": [30], "region-b": [30] } },
    { id: "b", samples: { "region-b": [40, 42] } }
  ],
  rule: { type: "mean" }
});
```

`missing.region` is `"region-b"`. `missing.regions[0].reason` is `"empty"`. `missing.regions[0].players[1].latency` is `null`. `missing.regions[0].players[1].count` is `0`. `missing.regions[0].players[1].used` is `0`. `missing.regions[0].players[1].reason` is `"empty"`. `missing.regions[1].score` is `35.5`. `missing.regions[1].players[1].latency` is `41`. `missing.regions[1].players[1].used` is `2`.

An empty array is the same exclusion as a missing key.

Trim `0.4` drops `floor(5 * 0.4)` highest samples, which is `2`. The kept samples are `10`, `20`, and `100`. The median is `20`. Without trim the median is `100`, and region-b wins. With trim, region-a wins.

```js
const samples = {
  "region-a": [10, 20, 100, 200, 300],
  "region-b": [50]
};

const raw = pickRegion({
  regions: ["region-a", "region-b"],
  players: [{ id: "a", samples }],
  rule: { type: "worst" }
});

const trimmed = pickRegion({
  regions: ["region-a", "region-b"],
  players: [{ id: "a", samples }],
  trim: 0.4,
  rule: { type: "worst" }
});
```

`raw.region` is `"region-b"`. `raw.regions[0].players[0].latency` is `100`. `raw.regions[0].score` is `100`.

`trimmed.region` is `"region-a"`. `trimmed.trim` is `0.4`. `trimmed.regions[0].players[0].latency` is `20`. `trimmed.regions[0].players[0].count` is `5`. `trimmed.regions[0].players[0].used` is `3`. `trimmed.regions[0].score` is `20`. `trimmed.regions[1].score` is `50`. `samples["region-a"]` is still `[10, 20, 100, 200, 300]`.

Equal scores keep the earlier region. Both regions have worst latency `20`. The list order is the tie break. The spelling of the ids is not.

```js
const tiedPlayers = [
  { id: "a", samples: { "region-a": [10], "region-b": [10] } },
  { id: "b", samples: { "region-a": [20], "region-b": [20] } }
];

const forward = pickRegion({
  regions: ["region-a", "region-b"],
  players: tiedPlayers
});

const backward = pickRegion({
  regions: ["region-b", "region-a"],
  players: tiedPlayers
});
```

`forward.region` is `"region-a"`. `forward.regions[0].score` is `20`. `forward.regions[1].score` is `20`. `backward.region` is `"region-b"`. `backward.regions[0].id` is `"region-b"`.

When every region is excluded, `status` is `"none"` and `region` is `null`. Region-a has no samples for player `b`. Region-b latencies `200` and `180` both exceed the cap `100`.

```js
const blocked = pickRegion({
  regions: ["region-a", "region-b"],
  players: [
    { id: "a", samples: { "region-a": [10], "region-b": [200] } },
    { id: "b", samples: { "region-b": [180] } }
  ],
  rule: { type: "capped-mean", cap: 100 }
});
```

`blocked.status` is `"none"`. `blocked.region` is `null`. `blocked.regions[0].reason` is `"empty"`. `blocked.regions[0].players[0].reason` is `null`. `blocked.regions[0].players[0].latency` is `10`. `blocked.regions[1].reason` is `"cap"`. `blocked.regions[1].players[0].reason` is `"cap"`. `blocked.regions[1].players[1].reason` is `"cap"`. `blocked.regions[1].score` is `null`.

A median is the middle of the ordered samples, not the mean of the raw samples. `[90, 10, 11]` sorts to `[10, 11, 90]`. The middle value is `11`.

```js
const middle = pickRegion({
  regions: ["region-a"],
  players: [{ id: "a", samples: { "region-a": [90, 10, 11] } }]
});
```

`middle.region` is `"region-a"`. `middle.regions[0].players[0].latency` is `11`. `middle.regions[0].score` is `11`. The sample array order does not matter.

Two players are not pooled into one sample list. Player `a` has samples `10` and `30`, so that player's latency is `20`. Player `b` has latency `40`. The mean score is `30`.

```js
const split = pickRegion({
  regions: ["region-a"],
  players: [
    { id: "a", samples: { "region-a": [10, 30] } },
    { id: "b", samples: { "region-a": [40] } }
  ],
  rule: { type: "mean" }
});
```

`split.regions[0].players[0].latency` is `20`. `split.regions[0].players[1].latency` is `40`. `split.regions[0].score` is `30`.

## API

`pickRegion` is a function. It has no constructor and no shared state. Each call reads its argument and returns a new result. The same input produces a deep-equal result and a new object tree.

`pickRegion` does not mutate `options`, the `regions` array, player objects, the `samples` object, or sample arrays. A call freezes only the result it creates. The result, its `rule`, its `regions` array, each region entry, each region `players` array, and each player row are frozen.

Own fields are read. Unknown fields are ignored. An omitted optional field, or a field whose value is `undefined`, uses the default. A frozen object and an object with a null prototype are accepted.

Latency numbers share one unit. The module does not convert milliseconds, ticks, or seconds. Comparison is ordinary IEEE-754 with no epsilon. `-0` is stored as `0` on values this module writes. `-0` compares equal to `0` before that normalisation.

### Constants

| Export            | Value                              | Meaning                                                                                  |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `WORST`           | `"worst"`                          | Rule type. The score is the highest player latency.                                      |
| `MEAN`            | `"mean"`                           | Rule type. The score is the arithmetic mean of the player latencies.                     |
| `CAPPED_MEAN`     | `"capped-mean"`                    | Rule type. The score is that mean, and a player latency above `cap` excludes the region. |
| `RULES`           | `["worst", "mean", "capped-mean"]` | Frozen rule types, in that order.                                                        |
| `CHOSEN`          | `"chosen"`                         | Outcome. An eligible region was selected.                                                |
| `NONE`            | `"none"`                           | Outcome. Every region was excluded.                                                      |
| `OUTCOMES`        | `["chosen", "none"]`               | Frozen outcomes, in that order.                                                          |
| `ELIGIBLE`        | `"eligible"`                       | Region status. The region has a score and can be chosen.                                 |
| `EXCLUDED`        | `"excluded"`                       | Region status. The region has a reason and a null score.                                 |
| `REGION_STATUSES` | `["eligible", "excluded"]`         | Frozen region statuses, in that order.                                                   |
| `EMPTY`           | `"empty"`                          | Exclusion. At least one player has no samples for the region.                            |
| `CAP`             | `"cap"`                            | Exclusion. At least one player latency is greater than the cap.                          |
| `EXCLUSIONS`      | `["empty", "cap"]`                 | Frozen exclusion reasons, in that order.                                                 |

### `pickRegion(options)`

```js
pickRegion(options);
```

`options` must be an object and must not be an array. Otherwise the function throws `TypeError` with the message `options must be an object`.

Checks run in this order. The first failure wins. A throw returns no result.

1. `options` is an object.
2. `regions` is a non-empty array of unique non-empty strings.
3. `players` is a non-empty array. Each entry is an object with a unique non-empty string `id` and a `samples` object.
4. `trim`, when present, is inside its range.
5. `rule`, when present, matches a rule type. For `capped-mean`, `cap` is inside its range.
6. Every listed region's sample value, when the player has that own key, is an array of finite numbers greater than or equal to `0`. Players are read in order, and regions are read in order inside each player.
7. Every non-empty sample list is reduced to a median. A non-finite median throws.
8. Every eligible region receives a score. A non-finite score throws.

| Field     | Default             | Accepted values                                                                             |
| --------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `regions` | required            | A non-empty array of unique non-empty strings. Order is the tie break and the result order. |
| `players` | required            | A non-empty array of player objects. Order is the order of player rows in the result.       |
| `trim`    | `0`                 | A finite number greater than or equal to `0` and less than `0.5`. `-0` is stored as `0`.    |
| `rule`    | `{ type: "worst" }` | `{ type: "worst" }`, `{ type: "mean" }`, or `{ type: "capped-mean", cap }`.                 |

### `options.regions`

`regions` must be present and must be a non-empty array. Otherwise `TypeError`: `regions must be a non-empty array`. A string, a plain object, `null`, and `undefined` fail this check.

Each id must be a string of length at least `1`. Otherwise `TypeError`: `region id must be a non-empty string`. Ids are not trimmed and are not case-folded. `"region-a"` and `"region-A"` are different ids. A string of one space is a valid id.

Ids must be unique in the array. Otherwise `TypeError`: `region ids must be unique`. Comparison is exact string equality.

The array order is stable. Result entries follow this order. When two eligible scores are equal, the earlier id is chosen.

### `options.players`

`players` must be present and must be a non-empty array. Otherwise `TypeError`: `players must be a non-empty array`.

Each entry must be an object and must not be an array. Otherwise `TypeError`: `player must be an object`.

Each player is read in order:

1. `id` must be an own property whose value is a string of length at least `1`. Otherwise `TypeError`: `player id must be a non-empty string`.
2. That id must not already have been seen. Otherwise `TypeError`: `player ids must be unique`.
3. `samples` must be an own property whose value is an object and not an array. Otherwise `TypeError`: `samples must be an object`.

Unknown player fields are ignored. Player ids are not trimmed and are not case-folded.

### `options.players[].samples`

`samples` is a map from region id to an array of round-trip samples.

Only own keys whose names appear in `regions` are read. Other own keys are ignored and are not validated. Inherited keys are ignored. A missing key means that player has no samples for that region. An empty array means the same thing. A present own key whose value is not an array throws `TypeError`: `samples must be an array`. `null`, a number, a string, and a plain object fail that check. `undefined` stored as an own value fails it as well. A missing key does not.

Each sample must be a finite number greater than or equal to `0`. Otherwise `RangeError`: `sample must be a finite number greater than or equal to 0`. `-0` is copied as `0`. A hole in the array is `undefined` and fails this check. Own properties of the array that are not elements are ignored. One sample list is not concatenated with another player's list.

`count` in the result is the number of elements in that array. `used` is the number of elements that enter the median after trim.

### `options.trim`

`trim` selects how many high samples to drop before the median. The default is `0`, including when the field is omitted or is `undefined`.

A present value other than `undefined` must be a finite number greater than or equal to `0` and less than `0.5`. Otherwise `RangeError`: `trim must be a finite number greater than or equal to 0 and less than 0.5`.

For a sample list of length `count`:

1. Copy the samples.
2. `drop` is `Math.floor(count * trim)`.
3. `used` is `count - drop`.
4. Sort the copy ascending.
5. Keep the first `used` values. Those are the lowest samples. Discard the higher ones.
6. The latency is the median of the kept values.

When `count` is `0`, `drop` is not applied. `used` is `0` and the latency is `null`.

When `used` is odd, the latency is the middle kept sample. Let `mid` be `Math.floor(used / 2)`. The latency is `kept[mid]`.

When `used` is even, the latency is `(kept[mid - 1] + kept[mid]) / 2`.

`[1, 2, 3, 4, 100]` with trim `0.2` drops `floor(5 * 0.2)`, which is `1`. The kept samples are `1`, `2`, `3`, and `4`. The latency is `2.5`. Without trim the latency is `3`, the middle of the five samples. The low sample stays. A high sample is the one that is removed.

Trim is applied per player-region pair. It is not applied to the list of player latencies and it is not applied to a pool of every player's samples.

If the even-median division is not finite, `pickRegion` throws `RangeError` with the message `median must be finite`. This is checked while building latencies, including for a region that another player leaves empty. Every sample array is validated before any median is computed, so a later invalid sample is reported before an earlier non-finite median.

### `options.rule`

`rule` selects the score. The default is `{ type: "worst" }`, including when the field is omitted or is `undefined`.

`rule` must be an object and must not be an array. Otherwise `TypeError`: `rule must be an object`.

`rule.type` must be `"worst"`, `"mean"`, or `"capped-mean"`. Otherwise `TypeError`: `rule type must be worst, mean, or capped-mean`. The check is case-sensitive. Unknown fields on a `worst` or `mean` rule are ignored, including `cap`.

| Type            | Stored rule                    | Score                                        |
| --------------- | ------------------------------ | -------------------------------------------- |
| `"worst"`       | `{ type: "worst" }`            | The highest player latency.                  |
| `"mean"`        | `{ type: "mean" }`             | The arithmetic mean of the player latencies. |
| `"capped-mean"` | `{ type: "capped-mean", cap }` | The same mean, after the cap exclusion.      |

For `"capped-mean"`, `cap` must be an own property whose value is a finite number greater than or equal to `0`. Otherwise `RangeError`: `cap must be a finite number greater than or equal to 0`. `-0` is stored as `0`. `Infinity` is rejected. Extra fields are ignored. The returned rule is a new object with `type` and `cap` only.

The cap is compared to the summarised latency, not to each raw sample. A sample of `500` does not exclude a region whose median is `2` when the cap is `10`.

A latency greater than `cap` excludes. A latency equal to `cap` stays eligible. There is no epsilon.

The mean divides by the number of players, not by the number of samples. A player with one hundred samples of `10` and a player with one sample of `50` have a mean score of `30`.

### Result

The return value is a frozen object:

| Field     | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `status`  | `"chosen"` or `"none"`.                                    |
| `region`  | The chosen region id, or `null` when `status` is `"none"`. |
| `trim`    | The trim value used for this call.                         |
| `rule`    | A frozen copy of the rule that was applied.                |
| `regions` | One frozen entry per input region, in input order.         |

`status` is `"chosen"` when at least one region is eligible. `region` is then that region's id. `status` is `"none"` when every region is excluded. `region` is then `null`. The `regions` array is still complete.

Each region entry is a frozen object:

| Field     | Meaning                                                   |
| --------- | --------------------------------------------------------- |
| `id`      | The region id from the input.                             |
| `status`  | `"eligible"` or `"excluded"`.                             |
| `reason`  | `null` when eligible. `"empty"` or `"cap"` when excluded. |
| `score`   | The rule score when eligible. `null` when excluded.       |
| `players` | One frozen row per input player, in input order.          |

A region is excluded when any player row has reason `"empty"`. That reason wins even if another player row has reason `"cap"`. Otherwise, under `capped-mean`, a region is excluded when any player row has reason `"cap"`. The score is computed only for an eligible region. An excluded region does not need a finite mean, so a pair of latencies that would overflow the mean does not throw when the cap has already excluded them.

An eligible region whose mean is not finite throws `RangeError` with the message `score must be finite`. The worst score of finite latencies is finite and does not throw. Eligible regions are scored in input order.

Each player row is a frozen object:

| Field     | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `id`      | The player id from the input.                                           |
| `latency` | The median after trim, or `null` when `count` is `0`.                   |
| `count`   | The raw sample count, before trim.                                      |
| `used`    | The number of samples that entered the median. `0` when `count` is `0`. |
| `reason`  | `null`, `"empty"`, or `"cap"`.                                          |

Player reasons are independent of the region reason:

- `count === 0` sets the player reason to `"empty"`.
- Otherwise, under `capped-mean`, a latency greater than `cap` sets the player reason to `"cap"`.
- Otherwise the player reason is `null`.

A player can have reason `"cap"` while the region reason is `"empty"`, because another player has no samples. Under `worst` and `mean`, the player reason is `"empty"` or `null`. The cap is not applied.

The chosen id is the eligible entry with the lowest score. Comparison uses `<`. An equal score does not replace the earlier entry. Excluded entries are skipped. A later eligible region wins only when its score is strictly lower. Reversing `regions` reverses which equal-score id wins. The ids are not sorted.

Raw samples are not copied onto the result. `count` and `used` describe them. The result does not share object or array references with the input or with another call.

### Errors

| When the check fails                                       | Error        | Message                                                                     |
| ---------------------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| `options` is missing, an array, or not an object           | `TypeError`  | `options must be an object`                                                 |
| `regions` is missing, empty, or not an array               | `TypeError`  | `regions must be a non-empty array`                                         |
| A region id is not a non-empty string                      | `TypeError`  | `region id must be a non-empty string`                                      |
| A region id is repeated                                    | `TypeError`  | `region ids must be unique`                                                 |
| `players` is missing, empty, or not an array               | `TypeError`  | `players must be a non-empty array`                                         |
| A player entry is an array or not an object                | `TypeError`  | `player must be an object`                                                  |
| A player id is not a non-empty string                      | `TypeError`  | `player id must be a non-empty string`                                      |
| A player id is repeated                                    | `TypeError`  | `player ids must be unique`                                                 |
| `samples` is missing, an array, or not an object           | `TypeError`  | `samples must be an object`                                                 |
| `trim` is present and outside its range                    | `RangeError` | `trim must be a finite number greater than or equal to 0 and less than 0.5` |
| `rule` is present, an array, or not an object              | `TypeError`  | `rule must be an object`                                                    |
| `rule.type` is not one of the three types                  | `TypeError`  | `rule type must be worst, mean, or capped-mean`                             |
| `capped-mean` has a missing or out-of-range `cap`          | `RangeError` | `cap must be a finite number greater than or equal to 0`                    |
| A listed region key is present and is not an array         | `TypeError`  | `samples must be an array`                                                  |
| A sample is not a finite number greater than or equal to 0 | `RangeError` | `sample must be a finite number greater than or equal to 0`                 |
| An even median is not finite                               | `RangeError` | `median must be finite`                                                     |
| An eligible region's mean is not finite                    | `RangeError` | `score must be finite`                                                      |

## Design

The summary is a median because one stall should not move the reported latency the way it moves a mean. `[90, 10, 11]` has median `11`. The mean of those three samples is `37`, and that mean is not used.

Trim removes high samples only. Round-trip outliers are stalls, so they sit at the high end. A low sample is a fast measurement and stays in the list. Dropping the same number of samples from both ends of `[1, 2, 3, 4, 100]` would leave `[2, 3, 4]`. The latency would stay `3`, the same value as the untrimmed median, so that trim would not change the selection. Dropping the one highest sample leaves `[1, 2, 3, 4]`. The latency is `2.5`.

The three rules answer three different questions.

`worst` asks which region keeps the highest individual latency lowest. A region that is excellent for one player and poor for another loses to a region that is moderate for every player.

`mean` asks which region has the lowest average of those player latencies. Each player counts once. The player who sent more samples is not a heavier vote. The sample count changes only that player's trim and median.

`capped-mean` asks the mean question and refuses a region that breaks a per-player limit. A region with a better average is excluded when one latency is above the cap. The cap is a filter. It is not added into the score. A latency equal to the cap remains eligible.

Missing samples are an exclusion, not a latency of `0` and not a large stand-in value. Treating a gap as `0` would make an unmeasured region look fast. The region is omitted and the reason is reported. `empty` is checked before `cap`, so a region that is both unmeasured for one player and over the cap for another is reported as `empty`. The player rows still show each condition separately.

Ties use the order of `regions`. The caller lists regions in preference order. Sorting the ids would ignore that order. `region-b` listed before `region-a` wins a tie even though `region-a` is earlier in alphabetical order.

Scores use the latency after trim. They do not use a second pass over the raw samples. An excluded region has `score: null` so a score is present only for a region that was allowed to compete. The player latencies remain on excluded regions when that player had samples, so the measurement is still visible.

The result is a pure reduction of the samples the caller already measured. The module does not read a clock, wait, or generate a number. Inputs stay mutable for the caller. Two calls do not share result objects, so freezing one result cannot change the next call. A later edit to a sample array is visible only to a later call. The earlier frozen result keeps the latencies it computed.

## License

MIT. Copyright (c) 2026 Vadim Gubin.
