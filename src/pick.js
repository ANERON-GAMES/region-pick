import { CAP, CAPPED_MEAN, CHOSEN, ELIGIBLE, EMPTY, EXCLUDED, NONE, WORST } from "./constants.js";
import { readRule } from "./rule.js";
import { isObject, normalizeZero } from "./shape.js";
import { summariseSamples } from "./summary.js";

const OPTIONS_MESSAGE = "options must be an object";
const REGIONS_MESSAGE = "regions must be a non-empty array";
const REGION_ID_MESSAGE = "region id must be a non-empty string";
const REGION_UNIQUE_MESSAGE = "region ids must be unique";
const PLAYERS_MESSAGE = "players must be a non-empty array";
const PLAYER_MESSAGE = "player must be an object";
const PLAYER_ID_MESSAGE = "player id must be a non-empty string";
const PLAYER_UNIQUE_MESSAGE = "player ids must be unique";
const SAMPLES_OBJECT_MESSAGE = "samples must be an object";
const SAMPLES_ARRAY_MESSAGE = "samples must be an array";
const SAMPLE_MESSAGE = "sample must be a finite number greater than or equal to 0";
const TRIM_MESSAGE = "trim must be a finite number greater than or equal to 0 and less than 0.5";
const SCORE_MESSAGE = "score must be finite";

export function pickRegion(options) {
  if (!isObject(options)) {
    throw new TypeError(OPTIONS_MESSAGE);
  }
  const regionIds = readRegions(options);
  const players = readPlayers(options);
  const trim = readTrim(options);
  const rule = readRule(options);
  const table = readTable(regionIds, players);
  const summarised = summariseTable(table, trim);
  const regions = scoreRegions(regionIds, players, summarised, rule);
  const decision = choose(regions);
  return freezeResult({
    status: decision.status,
    region: decision.region,
    trim,
    rule,
    regions
  });
}

function readRegions(options) {
  if (
    !Object.hasOwn(options, "regions") ||
    !Array.isArray(options.regions) ||
    options.regions.length === 0
  ) {
    throw new TypeError(REGIONS_MESSAGE);
  }
  const seen = Object.create(null);
  const regionIds = [];
  for (const id of options.regions) {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError(REGION_ID_MESSAGE);
    }
    if (Object.hasOwn(seen, id)) {
      throw new TypeError(REGION_UNIQUE_MESSAGE);
    }
    seen[id] = true;
    regionIds.push(id);
  }
  return regionIds;
}

function readPlayers(options) {
  if (
    !Object.hasOwn(options, "players") ||
    !Array.isArray(options.players) ||
    options.players.length === 0
  ) {
    throw new TypeError(PLAYERS_MESSAGE);
  }
  const seen = Object.create(null);
  const players = [];
  for (const player of options.players) {
    if (!isObject(player)) {
      throw new TypeError(PLAYER_MESSAGE);
    }
    if (!Object.hasOwn(player, "id") || typeof player.id !== "string" || player.id.length === 0) {
      throw new TypeError(PLAYER_ID_MESSAGE);
    }
    if (Object.hasOwn(seen, player.id)) {
      throw new TypeError(PLAYER_UNIQUE_MESSAGE);
    }
    seen[player.id] = true;
    if (!Object.hasOwn(player, "samples") || !isObject(player.samples)) {
      throw new TypeError(SAMPLES_OBJECT_MESSAGE);
    }
    players.push({ id: player.id, samples: player.samples });
  }
  return players;
}

function readTrim(options) {
  if (!Object.hasOwn(options, "trim") || options.trim === undefined) {
    return 0;
  }
  const value = options.trim;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 0.5) {
    throw new RangeError(TRIM_MESSAGE);
  }
  return normalizeZero(value);
}

function readTable(regionIds, players) {
  const table = [];
  for (const player of players) {
    const columns = [];
    for (const regionId of regionIds) {
      columns.push(readSamples(player.samples, regionId));
    }
    table.push(columns);
  }
  return table;
}

function readSamples(samples, regionId) {
  if (!Object.hasOwn(samples, regionId)) {
    return [];
  }
  const value = samples[regionId];
  if (!Array.isArray(value)) {
    throw new TypeError(SAMPLES_ARRAY_MESSAGE);
  }
  const copy = [];
  for (const sample of value) {
    if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0) {
      throw new RangeError(SAMPLE_MESSAGE);
    }
    copy.push(normalizeZero(sample));
  }
  return copy;
}

function summariseTable(table, trim) {
  const rows = [];
  for (const columns of table) {
    const summarised = [];
    for (const samples of columns) {
      summarised.push(summariseSamples(samples, trim));
    }
    rows.push(summarised);
  }
  return rows;
}

function scoreRegions(regionIds, players, summarised, rule) {
  const regions = [];
  for (let regionIndex = 0; regionIndex < regionIds.length; regionIndex += 1) {
    const playerRows = [];
    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      const summary = summarised[playerIndex][regionIndex];
      playerRows.push({
        id: players[playerIndex].id,
        latency: summary.latency,
        count: summary.count,
        used: summary.used,
        reason: playerReason(rule, summary)
      });
    }
    const reason = regionReason(playerRows);
    const status = reason === null ? ELIGIBLE : EXCLUDED;
    const score = status === ELIGIBLE ? regionScore(rule, playerRows) : null;
    regions.push({
      id: regionIds[regionIndex],
      status,
      reason,
      score,
      players: playerRows
    });
  }
  return regions;
}

function playerReason(rule, summary) {
  if (summary.count === 0) {
    return EMPTY;
  }
  if (rule.type === CAPPED_MEAN && summary.latency > rule.cap) {
    return CAP;
  }
  return null;
}

function regionReason(playerRows) {
  let sawCap = false;
  for (const row of playerRows) {
    if (row.reason === EMPTY) {
      return EMPTY;
    }
    if (row.reason === CAP) {
      sawCap = true;
    }
  }
  if (sawCap) {
    return CAP;
  }
  return null;
}

function regionScore(rule, playerRows) {
  const latencies = [];
  for (const row of playerRows) {
    latencies.push(row.latency);
  }
  if (rule.type === WORST) {
    return worstScore(latencies);
  }
  return meanScore(latencies);
}

function worstScore(latencies) {
  let worst = latencies[0];
  for (let index = 1; index < latencies.length; index += 1) {
    if (latencies[index] > worst) {
      worst = latencies[index];
    }
  }
  return worst;
}

function meanScore(latencies) {
  let sum = 0;
  for (const latency of latencies) {
    sum += latency;
  }
  const score = sum / latencies.length;
  if (!Number.isFinite(score)) {
    throw new RangeError(SCORE_MESSAGE);
  }
  return normalizeZero(score);
}

function choose(regions) {
  let best = null;
  for (const entry of regions) {
    if (entry.status !== ELIGIBLE) {
      continue;
    }
    if (best === null || entry.score < best.score) {
      best = entry;
    }
  }
  if (best === null) {
    return { status: NONE, region: null };
  }
  return { status: CHOSEN, region: best.id };
}

function freezeResult(result) {
  Object.freeze(result.rule);
  for (const entry of result.regions) {
    for (const player of entry.players) {
      Object.freeze(player);
    }
    Object.freeze(entry.players);
    Object.freeze(entry);
  }
  Object.freeze(result.regions);
  return Object.freeze(result);
}
