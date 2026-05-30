/** How often to sample RTT with ping_rtt while connected (ms). */
export const RTT_PING_INTERVAL_MS = 10_000;

/** EMA weight for new RTT samples (0–1). */
const RTT_EMA_ALPHA = 0.2;

/**
 * @param {number | null} prev smoothed RTT ms
 * @param {number} sampleMs new sample
 * @returns {number}
 */
export function smoothRttMs(prev, sampleMs) {
  if (prev == null) return sampleMs;
  return (1 - RTT_EMA_ALPHA) * prev + RTT_EMA_ALPHA * sampleMs;
}

/**
 * @param {number | null} rttMs smoothed round-trip ms
 * @returns {number} estimated one-way delay for clock correction
 */
export function oneWayMsFromRtt(rttMs) {
  return rttMs == null ? 0 : rttMs / 2;
}
