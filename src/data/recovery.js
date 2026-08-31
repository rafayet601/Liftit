/**
 * Recovery readiness — on-device, opt-in, private.
 *
 * A "provider" wraps whatever wearable source the platform offers:
 *
 *  - Native (iOS HealthKit / Android Health Connect): the official
 *    `@capacitor/health-fitness` plugin. Permissions are requested up front
 *    for READ access only, then each metric is queried as its own daily
 *    advanced query. Any variable the platform can't provide fails its own
 *    query and stays `null` — it is never proxied or fabricated.
 *  - Legacy/abstracted surface: a `Capacitor.Plugins.Health`-style global
 *    with requestPermissions()/queryDaily() (kept for the earlier provider
 *    contract and as a harmless fallback).
 *  - Web / PWA / tests: a clean no-op. Nothing is available, nothing is
 *    fetched, readiness stays null. No numbers are ever fabricated and no
 *    data leaves the device.
 *
 * computeReadiness is a pure function over real samples only. It produces a
 * coarse readiness signal that may modulate Phase B fatigue thresholds —
 * the deterministic engine always makes the actual call. This is wellness
 * context, not a medical or diagnostic measure.
 */

import { Capacitor } from '@capacitor/core';
import { HealthFitness } from '@capacitor/health-fitness';

export const READINESS_MIN_SAMPLES = 3;
export const READINESS_WINDOW_DAYS = 30;

const MS_PER_HOUR = 60 * 60 * 1000;

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const mean = (nums) => {
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const clamp01to100 = (n) => Math.max(0, Math.min(100, n));

const positiveOrMissing = (v) => (isFiniteNumber(v) && v > 0 ? v : null);

/**
 * First-half vs second-half mean of the window, as a signed percentage.
 * Returns null when the metric has fewer than 2 usable values or the
 * baseline is zero (avoids a divide-by-zero fabrication).
 */
function trendPct(values) {
    const clean = values.filter(isFiniteNumber);
    if (clean.length < 2) return null;
    const mid = Math.floor(clean.length / 2);
    const first = mean(clean.slice(0, mid));
    const second = mean(clean.slice(mid));
    if (!first) return null;
    return ((second - first) / first) * 100;
}

/**
 * Pure readiness from daily samples: [{ date, hrv, sleepHours, restingHr }].
 * Garbage metric values (null / NaN / wrong type) are treated as missing,
 * and a sample with no usable metric at all doesn't count toward the
 * minimum. Every input in the result is either derived from real values or
 * explicitly null.
 *
 * Status: 'insufficient_data' below the sample floor; otherwise 'ready'
 * (score ≥ 70), 'caution' (score ≥ 45) or 'fatigued' below that.
 */
export function computeReadiness(samples) {
    const list = Array.isArray(samples) ? samples : [];
    const valid = list.filter(
        (s) =>
            s
            && typeof s === 'object'
            && (isFiniteNumber(s.hrv)
                || isFiniteNumber(s.sleepHours)
                || isFiniteNumber(s.restingHr)),
    );

    const inputs = { hrvTrendPct: null, sleepAvgHrs: null, rhrTrendPct: null };
    if (valid.length < READINESS_MIN_SAMPLES) {
        return { score: 0, inputs, status: 'insufficient_data' };
    }

    // Trends compare the second half of the window against the first, so
    // samples must be chronological regardless of the order the provider
    // returned them in.
    const ordered = [...valid].sort((a, b) => {
        const ta = new Date(a.date).getTime() || 0;
        const tb = new Date(b.date).getTime() || 0;
        return ta - tb;
    });

    inputs.hrvTrendPct = trendPct(ordered.map((s) => s.hrv));
    inputs.rhrTrendPct = trendPct(ordered.map((s) => s.restingHr));
    const sleepValues = ordered.map((s) => s.sleepHours).filter(isFiniteNumber);
    inputs.sleepAvgHrs = sleepValues.length ? mean(sleepValues) : null;

    // Weighted components: falling HRV and rising RHR lower the score,
    // short sleep lowers it. Only metrics that actually exist contribute;
    // weights are renormalized over what's present.
    const parts = [];
    if (inputs.hrvTrendPct !== null) {
        parts.push({ weight: 0.4, value: clamp01to100(50 + inputs.hrvTrendPct * 2) });
    }
    if (inputs.sleepAvgHrs !== null) {
        parts.push({ weight: 0.4, value: clamp01to100((inputs.sleepAvgHrs / 8) * 100) });
    }
    if (inputs.rhrTrendPct !== null) {
        parts.push({ weight: 0.2, value: clamp01to100(50 - inputs.rhrTrendPct * 2) });
    }

    const weightSum = parts.reduce((a, p) => a + p.weight, 0);
    const score = weightSum
        ? Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0) / weightSum)
        : 0;

    const status = score >= 70 ? 'ready' : score >= 45 ? 'caution' : 'fatigued';
    return { score, inputs, status };
}

/* ------------------------------------------------------------------ */
/* Official plugin: @capacitor/health-fitness                          */
/* ------------------------------------------------------------------ */

/**
 * Platform variable per readiness metric. HEART_RATE_VARIABILITY and
 * RESTING_HEART_RATE are queried as daily AVG buckets, SLEEP as a daily SUM
 * bucket. If a variable is unsupported on a platform the query rejects and
 * that metric stays null — renormalization in computeReadiness handles it.
 * HEART_RATE is requested for permissions (per the official variable list)
 * but its data is never used: no heart-rate proxying for resting heart rate.
 */
const OFFICIAL_VARIABLES = {
    hrv: { variable: 'HEART_RATE_VARIABILITY', operation: 'AVG' },
    sleep: { variable: 'SLEEP', operation: 'SUM' },
    restingHr: { variable: 'RESTING_HEART_RATE', operation: 'AVG' },
};

const ACCESS_READ = 'READ';
const PERMISSION_VARIABLES = [
    'HEART_RATE_VARIABILITY',
    'SLEEP',
    'RESTING_HEART_RATE',
    'HEART_RATE',
];

// The native date parser only accepts "yyyy-MM-dd'T'HH:mm:ssZ" — no
// fractional seconds, so toISOString()'s ".SSS" suffix must be trimmed.
const isoNoMs = (d) => `${d.toISOString().split('.')[0]}Z`;

function isNativePlatform() {
    try {
        return typeof Capacitor?.isNativePlatform === 'function'
            && Capacitor.isNativePlatform() === true;
    } catch {
        return false;
    }
}

/** The official plugin object, or null when it can't be used here. */
function officialPlugin() {
    if (!isNativePlatform()) return null;
    try {
        if (
            !HealthFitness
            || typeof HealthFitness.requestHealthPermissions !== 'function'
            || typeof HealthFitness.getData !== 'function'
        ) {
            return null;
        }
        return HealthFitness;
    } catch {
        return null;
    }
}

/** READ-only request for exactly the variables this feature consumes. */
async function requestReadPermissions() {
    await HealthFitness.requestHealthPermissions({
        customPermissions: JSON.stringify(
            PERMISSION_VARIABLES.map((Variable) => ({ Variable, AccessType: ACCESS_READ })),
        ),
        allVariables: JSON.stringify({ IsActive: false, AccessType: ACCESS_READ }),
        fitnessVariables: JSON.stringify({ IsActive: false, AccessType: ACCESS_READ }),
        healthVariables: JSON.stringify({ IsActive: false, AccessType: ACCESS_READ }),
        profileVariables: JSON.stringify({ IsActive: false, AccessType: ACCESS_READ }),
        workoutVariables: JSON.stringify({ IsActive: false, AccessType: ACCESS_READ }),
    });
}

const RESULT_ROW_DATE_KEYS = [
    'startdate',
    'start',
    'date',
    'day',
    'datetime',
    'timestamp',
    'enddate',
    'end',
];

// Deliberately excludes keys like "count" (a sample count, not a metric).
// A row with none of these names yields no value — honest missing, never a
// guess from unrelated fields.
const RESULT_ROW_VALUE_KEYS = [
    'value',
    'val',
    'datavalue',
    'datavalues',
    'avg',
    'average',
    'mean',
    'sum',
    'total',
    'quantity',
    'amount',
];

/** ISO day ("YYYY-MM-DD") from an ISO string or epoch number, else null. */
function toIsoDay(v) {
    if (typeof v === 'string') {
        const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const t = Date.parse(v);
        return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
    }
    if (isFiniteNumber(v) && v > 0) {
        const ms = v < 1e11 ? v * 1000 : v; // epoch seconds vs milliseconds
        const d = new Date(ms);
        return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
    }
    return null;
}

/** First finite metric value from the documented row shapes, else null. */
function normalizeRowValue(v) {
    if (isFiniteNumber(v)) return v;
    if (Array.isArray(v)) return mean(v.filter(isFiniteNumber));
    if (v && typeof v === 'object') {
        if (isFiniteNumber(v.value)) return v.value;
        const nums = Object.values(v).filter(isFiniteNumber);
        // One number is a value; several are ambiguous — refuse to guess.
        return nums.length === 1 ? nums[0] : null;
    }
    return null;
}

function extractRow(row) {
    if (!row || typeof row !== 'object') return null;
    const keys = new Map(
        Object.entries(row).map(([k, v]) => [String(k).toLowerCase(), v]),
    );
    let date = null;
    for (const key of RESULT_ROW_DATE_KEYS) {
        if (keys.has(key)) {
            date = toIsoDay(keys.get(key));
            if (date) break;
        }
    }
    if (!date) return null;
    let value = null;
    for (const key of RESULT_ROW_VALUE_KEYS) {
        if (!keys.has(key)) continue;
        value = normalizeRowValue(keys.get(key));
        if (value !== null) break;
    }
    return value === null ? null : { date, value };
}

/**
 * `results` is a JSON-encoded string of raw result blocks whose exact shape
 * varies per platform — parse defensively and accept the array plus a few
 * plausible wrapper objects. Anything else parses as empty.
 */
function parseResultRows(results) {
    let parsed;
    try {
        parsed = JSON.parse(results ?? '[]');
    } catch {
        return [];
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        for (const key of ['results', 'data', 'blocks', 'dataPoints']) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return [];
}

/** Daily bucket query for one variable, merged into date → value. */
async function queryDailyRaw(variable, operation, start, end) {
    const { results } = await HealthFitness.getData({
        parameters: JSON.stringify({
            Variable: variable,
            StartDate: isoNoMs(start),
            EndDate: isoNoMs(end),
            TimeUnit: 'DAY',
            OperationType: operation,
            TimeUnitLength: 1,
            AdvancedQueryReturnType: 'ALL_DATA',
            AdvancedQueryResultType: 'RAW_DATA',
        }),
    });
    const rows = parseResultRows(results)
        .map(extractRow)
        .filter(Boolean);
    // One block per day is the expected shape for DAY buckets; if a day
    // produces several rows, they combine the way the requested operation
    // combines (sums add, averages mean) rather than last-write-wins.
    const byDay = new Map();
    for (const { date, value } of rows) {
        const prev = byDay.get(date);
        if (prev) {
            prev.total += value;
            prev.count += 1;
        } else {
            byDay.set(date, { total: value, count: 1 });
        }
    }
    const merged = new Map();
    for (const [date, { total, count }] of byDay) {
        merged.set(date, operation === 'SUM' ? total : total / count);
    }
    return merged;
}

const warnedVariables = new Set();

/**
 * One variable failing (unsupported on this platform, permission gap,
 * unexpected payload) must not kill the others — it degrades to an empty
 * map so the metric lands as null in the samples.
 */
async function queryDailySafe(variable, operation, start, end) {
    try {
        return await queryDailyRaw(variable, operation, start, end);
    } catch (err) {
        if (!warnedVariables.has(variable)) {
            warnedVariables.add(variable);
            console.warn(
                `[recovery] ${variable} unavailable on this platform:`,
                err?.message ?? err,
            );
        }
        return new Map();
    }
}

/**
 * Sleep arrives in whatever unit the platform emits (hours, minutes,
 * seconds or milliseconds have all been observed across HealthKit/Health
 * Connect pipelines). Normalize by magnitude, sanity-clamp to a real day,
 * and log the first non-hour conversion once. Values that still don't fit a
 * single day become null — missing, never rescaled into plausibility.
 */
let sleepUnitWarned = false;
function sleepRawToHours(raw) {
    if (!isFiniteNumber(raw) || raw <= 0) return null;
    let hours;
    let unit = null;
    if (raw <= 24) {
        hours = raw; // already hours
    } else if (raw <= 1800) {
        hours = raw / 60; // up to 30h expressed in minutes
        unit = 'minutes';
    } else if (raw <= 172800) {
        hours = raw / 3600; // up to 48h expressed in seconds
        unit = 'seconds';
    } else {
        hours = raw / MS_PER_HOUR;
        unit = 'milliseconds';
    }
    if (unit && !sleepUnitWarned) {
        sleepUnitWarned = true;
        console.warn(`[recovery] sleep duration arrived in ${unit}; normalized to hours`);
    }
    return hours > 0 && hours <= 24 ? hours : null;
}

async function fetchOfficialSamples(days) {
    // Permissions first — a rejection propagates to the caller, which
    // degrades to an empty list. No queries are made without it.
    await requestReadPermissions();

    const windowDays = Number.isFinite(days) && days >= 1
        ? Math.floor(days)
        : READINESS_WINDOW_DAYS;
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const hrv = await queryDailySafe(
        OFFICIAL_VARIABLES.hrv.variable,
        OFFICIAL_VARIABLES.hrv.operation,
        start,
        end,
    );
    const sleepRaw = await queryDailySafe(
        OFFICIAL_VARIABLES.sleep.variable,
        OFFICIAL_VARIABLES.sleep.operation,
        start,
        end,
    );
    const restingHr = await queryDailySafe(
        OFFICIAL_VARIABLES.restingHr.variable,
        OFFICIAL_VARIABLES.restingHr.operation,
        start,
        end,
    );

    const dates = new Set([...hrv.keys(), ...sleepRaw.keys(), ...restingHr.keys()]);
    const samples = [];
    for (const date of dates) {
        const sample = {
            date,
            hrv: positiveOrMissing(hrv.get(date)),
            sleepHours: sleepRaw.has(date) ? sleepRawToHours(sleepRaw.get(date)) : null,
            restingHr: positiveOrMissing(restingHr.get(date)),
        };
        if (
            sample.hrv === null
            && sample.sleepHours === null
            && sample.restingHr === null
        ) {
            continue;
        }
        samples.push(sample);
    }
    samples.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return samples;
}

/* ------------------------------------------------------------------ */
/* Legacy global-plugin surface (kept as a fallback)                   */
/* ------------------------------------------------------------------ */

function healthPlugin() {
    try {
        const plugins = globalThis.Capacitor?.Plugins;
        return plugins?.Health ?? plugins?.HealthPlugin ?? null;
    } catch {
        return null;
    }
}

const cleanMetric = (v) => (isFiniteNumber(v) ? v : null);

function cleanSample(row) {
    if (!row || typeof row !== 'object') return null;
    const sample = {
        date: typeof row.date === 'string' ? row.date : null,
        hrv: cleanMetric(row.hrv),
        sleepHours: cleanMetric(row.sleepHours),
        restingHr: cleanMetric(row.restingHr),
    };
    if (sample.hrv === null && sample.sleepHours === null && sample.restingHr === null) {
        return null;
    }
    return sample;
}

async function fetchLegacySamples(plugin, days) {
    if (typeof plugin.requestPermissions === 'function') {
        await plugin.requestPermissions();
    }
    if (typeof plugin.queryDaily !== 'function') return [];
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const result = await plugin.queryDaily({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
    });
    const rows = Array.isArray(result?.days) ? result.days : [];
    return rows.map(cleanSample).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

/**
 * Real provider, guarded on every path. Preference: the official
 * @capacitor/health-fitness plugin on a native platform, then the legacy
 * global surface. Any error — no platform, no plugin, denied permission,
 * unexpected shape — degrades to an empty sample list, never a throw and
 * never synthetic data.
 */
export function createRecoveryProvider() {
    return {
        available() {
            return Boolean(officialPlugin()) || Boolean(healthPlugin());
        },
        async fetchRecent(days = READINESS_WINDOW_DAYS) {
            try {
                if (officialPlugin()) {
                    return await fetchOfficialSamples(days);
                }
                const legacy = healthPlugin();
                if (legacy) {
                    return await fetchLegacySamples(legacy, days);
                }
                return [];
            } catch {
                return [];
            }
        },
    };
}

/** Default: nothing available, clean no-op. */
const noopProvider = {
    available: () => false,
    fetchRecent: async () => [],
};

export { noopProvider };
export default noopProvider;
