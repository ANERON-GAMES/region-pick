export function player(id, samples) {
  return { id, samples };
}

export function playerRow(id, latency, count, used, reason = null) {
  return { id, latency, count, used, reason };
}

export function regionRow(id, status, reason, score, players) {
  return { id, status, reason, score, players };
}
