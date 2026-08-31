import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    computeReadiness,
    createRecoveryProvider,
    noopProvider,
    READINESS_MIN_SAMPLES,
} from '../data/recovery';
import { default as defaultProvider } from '../data/recovery';

/**
 * Mock strategy for the official @capacitor/health-fitness plugin:
 * vi.mock factories are file-wide, so they are backed by a hoisted mutable
 * state object. `hf.state.native` stands in for Capacitor.isNativePlatform()
 * and `hf.state.impl` is swapped per test; the Proxy keeps the module export
 * identity stable while delegating every property access to the current
 * impl (null impl = unimplemented plugin, as on web).
 */
const hf = vi.hoisted(() => {
    const state = { native: false, impl: null };
    const HealthFitness = new Proxy(
        {},
        {
            get(_target, prop) {
                const impl = state.impl;
                if (!impl) return undefined;
                const v = impl[prop];
                return typeof v === 'function' ? v.bind(impl) : v;
            },
            has(_target, prop) {
                return Boolean(state.impl) && prop in state.impl;
            },
        },
    );
    return { state, HealthFitness };
});

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => hf.state.native },
}));

vi.mock('@capacitor/health-fitness', () => ({
    HealthFitness: hf.HealthFitness,
}));

const day = (i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();
const d = (i) => day(i).slice(0, 10); // ISO day, as the provider emits
const epochSeconds = (isoDay) => Math.floor(new Date(`${isoDay}T12:00:00Z`).getTime() / 1000);

/** Build a mock official plugin whose getData serves rows per variable. */
function makeOfficialPlugin(rowsByVariable = {}, { permissionError = null } = {}) {
    const queries = [];
    return {
        requestHealthPermissions: vi.fn(
            permissionError
                ? () => Promise.reject(permissionError)
                : () => Promise.resolve(),
        ),
        getData: vi.fn(async ({ parameters }) => {
            const params = JSON.parse(parameters);
            queries.push(params);
            return { results: JSON.stringify(rowsByVariable[params.Variable] ?? []) };
        }),
        queries,
    };
}

function enableOfficialPlugin(plugin) {
    hf.state.native = true;
    hf.state.impl = plugin;
}

afterEach(() => {
    delete globalThis.Capacitor;
    hf.state.native = false;
    hf.state.impl = null;
});

describe('computeReadiness — sample-count edges', () => {
    it('reports insufficient data for 0 samples', () => {
        const r = computeReadiness([]);
        expect(r.status).toBe('insufficient_data');
        expect(r.score).toBe(0);
        expect(r.inputs).toEqual({ hrvTrendPct: null, sleepAvgHrs: null, rhrTrendPct: null });
    });

    it('reports insufficient data below the 3-sample floor', () => {
        expect(READINESS_MIN_SAMPLES).toBe(3);
        const two = computeReadiness([
            { date: day(1), hrv: 60, sleepHours: 8, restingHr: 50 },
            { date: day(0), hrv: 61, sleepHours: 8, restingHr: 50 },
        ]);
        expect(two.status).toBe('insufficient_data');
    });

    it('becomes computable at exactly 3 samples', () => {
        const r = computeReadiness([
            { date: day(2), hrv: 60, sleepHours: 8, restingHr: 50 },
            { date: day(1), hrv: 60, sleepHours: 8, restingHr: 50 },
            { date: day(0), hrv: 60, sleepHours: 8, restingHr: 50 },
        ]);
        expect(r.status).toBe('ready');
        expect(r.score).toBeGreaterThan(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('handles non-array input', () => {
        expect(computeReadiness(null).status).toBe('insufficient_data');
        expect(computeReadiness(undefined).status).toBe('insufficient_data');
    });
});

describe('computeReadiness — garbage handling', () => {
    it('treats null/NaN metrics as missing, not zero', () => {
        const r = computeReadiness([
            { date: day(2), hrv: NaN, sleepHours: null, restingHr: undefined },
            { date: day(1), hrv: 60, sleepHours: '8', restingHr: NaN },
            { date: day(0), hrv: 'junk', sleepHours: 8, restingHr: 50 },
        ]);
        // Sample 0 has no usable metric at all → only 2 usable samples remain.
        expect(r.status).toBe('insufficient_data');
    });

    it('keeps partial samples when only some metrics are real', () => {
        const r = computeReadiness([
            { date: day(2), hrv: 60, sleepHours: NaN, restingHr: 50 },
            { date: day(1), hrv: 60, sleepHours: null, restingHr: 50 },
            { date: day(0), hrv: 60, sleepHours: undefined, restingHr: 50 },
        ]);
        // Flat HRV/RHR score 50 each; no sleep data → 50 weighted overall.
        expect(r.status).toBe('caution');
        expect(r.score).toBe(50);
        expect(r.inputs.sleepAvgHrs).toBeNull();
        expect(r.inputs.hrvTrendPct).toBe(0);
    });

    it('never fabricates a baseline from a single value', () => {
        const r = computeReadiness([
            { date: day(2), hrv: 60 },
            { date: day(1), hrv: NaN },
            { date: day(0), hrv: 90 },
        ]);
        // Only 2 usable HRV values → no trend claim.
        expect(r.inputs.hrvTrendPct).toBeNull();
    });
});

describe('computeReadiness — synthetic series', () => {
    it('scores a strong week ready', () => {
        const samples = [2, 1, 0].map((i) => ({
            date: day(i),
            hrv: 60 + (2 - i) * 3, // rising HRV: 60, 63, 66
            sleepHours: 8,
            restingHr: 50,
        }));
        const r = computeReadiness(samples);
        expect(r.status).toBe('ready');
        expect(r.inputs.hrvTrendPct).toBeGreaterThan(0);
        expect(r.score).toBeGreaterThanOrEqual(70);
    });

    it('scores a rough week fatigued', () => {
        const samples = [2, 1, 0].map((i) => ({
            date: day(i),
            hrv: 66 - (2 - i) * 5, // falling HRV: 66, 61, 56
            sleepHours: 5,
            restingHr: 55 + (2 - i) * 2, // rising RHR: 55, 57, 59
        }));
        const r = computeReadiness(samples);
        expect(r.status).toBe('fatigued');
        expect(r.inputs.rhrTrendPct).toBeGreaterThan(0);
        expect(r.score).toBeLessThan(45);
    });

    it('lands caution between the extremes', () => {
        const samples = [2, 1, 0].map((i) => ({
            date: day(i),
            hrv: 60,
            sleepHours: 6.5,
            restingHr: 50,
        }));
        const r = computeReadiness(samples);
        expect(r.status).toBe('caution');
        expect(r.score).toBeGreaterThanOrEqual(45);
        expect(r.score).toBeLessThan(70);
    });

    it('clamps scores into 0..100 even for extreme inputs', () => {
        const samples = [2, 1, 0].map((i) => ({
            date: day(i),
            hrv: i === 0 ? 5000 : 10,
            sleepHours: 14,
            restingHr: i === 0 ? 30 : 120,
        }));
        const r = computeReadiness(samples);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('splits trend halves first vs second (not start vs end)', () => {
        const r = computeReadiness([
            { date: day(3), hrv: 50, sleepHours: 8, restingHr: 50 },
            { date: day(2), hrv: 50, sleepHours: 8, restingHr: 50 },
            { date: day(1), hrv: 100, sleepHours: 8, restingHr: 50 },
            { date: day(0), hrv: 100, sleepHours: 8, restingHr: 50 },
        ]);
        expect(r.inputs.hrvTrendPct).toBeCloseTo(100, 5);
    });
});

describe('providers', () => {
    it('default export is a clean no-op', async () => {
        expect(defaultProvider).toBe(noopProvider);
        expect(noopProvider.available()).toBe(false);
        await expect(noopProvider.fetchRecent(30)).resolves.toEqual([]);
    });

    it('real provider is unavailable without a health plugin and degrades to []', async () => {
        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(false);
        await expect(provider.fetchRecent(30)).resolves.toEqual([]);
    });

    it('cleans real plugin rows and drops garbage rows', async () => {
        const d1 = day(1);
        globalThis.Capacitor = {
            Plugins: {
                Health: {
                    async requestPermissions() {},
                    async queryDaily() {
                        return {
                            days: [
                                { date: d1, hrv: 60, sleepHours: 7.5, restingHr: 52 },
                                { date: day(0), hrv: NaN, sleepHours: null, restingHr: 'x' },
                                null,
                            ],
                        };
                    },
                },
            },
        };
        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(true);
        const samples = await provider.fetchRecent(30);
        expect(samples).toHaveLength(1);
        expect(samples[0]).toEqual({ date: d1, hrv: 60, sleepHours: 7.5, restingHr: 52 });
    });

    it('denied permission is a clean no-op, not a throw', async () => {
        globalThis.Capacitor = {
            Plugins: {
                HealthPlugin: {
                    requestPermissions: async () => {
                        throw new Error('Permission denied');
                    },
                    queryDaily: async () => ({ days: [] }),
                },
            },
        };
        const provider = createRecoveryProvider();
        await expect(provider.fetchRecent(30)).resolves.toEqual([]);
    });

    it('unexpected plugin shapes degrade to []', async () => {
        globalThis.Capacitor = {
            Plugins: {
                Health: {
                    async queryDaily() {
                        return { nonsense: true };
                    },
                },
            },
        };
        await expect(createRecoveryProvider().fetchRecent(7)).resolves.toEqual([]);
    });
});

describe('official plugin — happy path mapping', () => {
    it('maps all variables into chronological daily samples', async () => {
        // Rows deliberately out of chronological order and using the
        // millisecond magnitude for sleep (8h in ms).
        const plugin = makeOfficialPlugin({
            HEART_RATE_VARIABILITY: [
                { startDate: d(0), value: 66 },
                { startDate: d(2), value: 60 },
                { startDate: d(1), value: 63 },
            ],
            SLEEP: [
                { startDate: d(2), value: 7.5 * 3600000 },
                { startDate: d(1), value: 8 * 3600000 },
                { startDate: d(0), value: 6 * 3600000 },
            ],
            RESTING_HEART_RATE: [
                { startDate: d(1), value: 52 },
                { startDate: d(2), value: 52 },
                { startDate: d(0), value: 53 },
            ],
        });
        enableOfficialPlugin(plugin);

        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(true);
        const samples = await provider.fetchRecent(30);

        expect(samples.map((s) => s.date)).toEqual([d(2), d(1), d(0)]);
        expect(samples[0]).toEqual({ date: d(2), hrv: 60, sleepHours: 7.5, restingHr: 52 });
        expect(samples[1]).toEqual({ date: d(1), hrv: 63, sleepHours: 8, restingHr: 52 });
        expect(samples[2]).toEqual({ date: d(0), hrv: 66, sleepHours: 6, restingHr: 53 });
    });

    it('requests READ-only permissions for exactly the four variables first', async () => {
        const plugin = makeOfficialPlugin({});
        enableOfficialPlugin(plugin);

        await createRecoveryProvider().fetchRecent(30);

        expect(plugin.requestHealthPermissions).toHaveBeenCalledTimes(1);
        const arg = plugin.requestHealthPermissions.mock.calls[0][0];
        expect(JSON.parse(arg.customPermissions)).toEqual([
            { Variable: 'HEART_RATE_VARIABILITY', AccessType: 'READ' },
            { Variable: 'SLEEP', AccessType: 'READ' },
            { Variable: 'RESTING_HEART_RATE', AccessType: 'READ' },
            { Variable: 'HEART_RATE', AccessType: 'READ' },
        ]);
        // Group descriptors are passed inactive — nothing beyond the four.
        for (const group of ['allVariables', 'fitnessVariables', 'healthVariables', 'profileVariables', 'workoutVariables']) {
            expect(JSON.parse(arg[group])).toEqual({ IsActive: false, AccessType: 'READ' });
        }
    });

    it('queries daily buckets with the documented parameters (no ms in dates)', async () => {
        const plugin = makeOfficialPlugin({});
        enableOfficialPlugin(plugin);

        await createRecoveryProvider().fetchRecent(30);

        expect(plugin.queries).toHaveLength(3);
        const byVar = Object.fromEntries(plugin.queries.map((q) => [q.Variable, q]));
        expect(byVar.HEART_RATE_VARIABILITY.OperationType).toBe('AVG');
        expect(byVar.SLEEP.OperationType).toBe('SUM');
        expect(byVar.RESTING_HEART_RATE.OperationType).toBe('AVG');
        for (const q of plugin.queries) {
            expect(q.TimeUnit).toBe('DAY');
            expect(q.TimeUnitLength).toBe(1);
            expect(q.AdvancedQueryReturnType).toBe('ALL_DATA');
            expect(q.AdvancedQueryResultType).toBe('RAW_DATA');
            // The native parser rejects fractional seconds — dates must be
            // "yyyy-MM-dd'T'HH:mm:ssZ".
            expect(q.StartDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
            expect(q.EndDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        }
    });

    it('respects the requested window in the query range', async () => {
        const plugin = makeOfficialPlugin({});
        enableOfficialPlugin(plugin);

        await createRecoveryProvider().fetchRecent(7);

        const q = plugin.queries[0];
        const spanDays = (new Date(q.EndDate) - new Date(q.StartDate)) / (24 * 60 * 60 * 1000);
        expect(spanDays).toBeCloseTo(7, 5);
    });
});

describe('official plugin — per-variable degradation', () => {
    it('keeps SLEEP and RHR when the HRV variable fails', async () => {
        hf.state.native = true;
        hf.state.impl = {
            requestHealthPermissions: vi.fn().mockResolvedValue(undefined),
            getData: vi.fn(async ({ parameters }) => {
                const p = JSON.parse(parameters);
                if (p.Variable === 'HEART_RATE_VARIABILITY') {
                    throw new Error('variable not supported on this platform');
                }
                if (p.Variable === 'SLEEP') {
                    return {
                        results: JSON.stringify([
                            { startDate: d(1), value: 8 * 3600000 },
                            { startDate: d(0), value: 8 * 3600000 },
                        ]),
                    };
                }
                return {
                    results: JSON.stringify([
                        { startDate: d(1), value: 52 },
                        { startDate: d(0), value: 51 },
                    ]),
                };
            }),
        };

        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(true);
        // Resolves, does not throw — the failed variable is just missing.
        const samples = await provider.fetchRecent(30);
        expect(samples.map((s) => s.date)).toEqual([d(1), d(0)]);
        expect(samples[0]).toEqual({ date: d(1), hrv: null, sleepHours: 8, restingHr: 52 });
        expect(samples[1]).toEqual({ date: d(0), hrv: null, sleepHours: 8, restingHr: 51 });
    });

    it('keeps HRV when the RHR variable fails (no heart-rate proxy)', async () => {
        hf.state.native = true;
        hf.state.impl = {
            requestHealthPermissions: vi.fn().mockResolvedValue(undefined),
            getData: vi.fn(async ({ parameters }) => {
                const p = JSON.parse(parameters);
                if (p.Variable === 'RESTING_HEART_RATE') {
                    throw new Error('unsupported');
                }
                if (p.Variable === 'SLEEP') {
                    return { results: JSON.stringify([{ startDate: d(0), value: 7 * 3600000 }]) };
                }
                return { results: JSON.stringify([{ startDate: d(0), value: 65 }]) };
            }),
        };

        const samples = await createRecoveryProvider().fetchRecent(30);
        expect(samples).toEqual([{ date: d(0), hrv: 65, sleepHours: 7, restingHr: null }]);
    });
});

describe('official plugin — availability gating', () => {
    it('permission rejection degrades to a no-op without any query', async () => {
        const plugin = makeOfficialPlugin({}, { permissionError: new Error('denied') });
        enableOfficialPlugin(plugin);

        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(true); // plugin exists, consent doesn't
        await expect(provider.fetchRecent(30)).resolves.toEqual([]);
        expect(plugin.getData).not.toHaveBeenCalled();
    });

    it('web/jsdom (not native) is unavailable and never touches the plugin', async () => {
        const plugin = makeOfficialPlugin({});
        // Deliberately leave hf.state.native = false: jsdom/PWA path.
        hf.state.impl = plugin;

        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(false);
        await expect(provider.fetchRecent(30)).resolves.toEqual([]);
        expect(plugin.requestHealthPermissions).not.toHaveBeenCalled();
        expect(plugin.getData).not.toHaveBeenCalled();
    });

    it('an unimplemented plugin object (methods missing) stays unavailable', async () => {
        hf.state.native = true;
        hf.state.impl = {}; // no requestHealthPermissions / getData

        const provider = createRecoveryProvider();
        expect(provider.available()).toBe(false);
        await expect(provider.fetchRecent(30)).resolves.toEqual([]);
    });
});

describe('official plugin — defensive row normalization', () => {
    it('handles PascalCase rows, dataValues arrays, epoch dates and wrappers', async () => {
        hf.state.native = true;
        hf.state.impl = {
            requestHealthPermissions: vi.fn().mockResolvedValue(undefined),
            getData: vi.fn(async ({ parameters }) => {
                const p = JSON.parse(parameters);
                if (p.Variable === 'HEART_RATE_VARIABILITY') {
                    return {
                        results: JSON.stringify([
                            { StartDate: d(1), Value: 63 }, // PascalCase block
                            { startDate: d(0), dataValues: [62, 64] }, // array → mean 63
                            { startDate: d(2) }, // no value key → dropped
                        ]),
                    };
                }
                if (p.Variable === 'SLEEP') {
                    return {
                        results: JSON.stringify([
                            { startDate: d(1), value: 28800 }, // seconds → 8h
                            { startDate: d(0), value: 5000000000 }, // absurd → missing
                        ]),
                    };
                }
                if (p.Variable === 'RESTING_HEART_RATE') {
                    return {
                        // Wrapper object instead of a bare array; epoch-second date.
                        results: JSON.stringify({
                            blocks: [{ startDate: epochSeconds(d(1)), value: 52 }],
                        }),
                    };
                }
                return { results: '[]' };
            }),
        };

        const samples = await createRecoveryProvider().fetchRecent(30);
        expect(samples).toEqual([
            { date: d(1), hrv: 63, sleepHours: 8, restingHr: 52 },
            // d(0): sleep absurd → null, RHR zero → missing; only HRV survives.
            { date: d(0), hrv: 63, sleepHours: null, restingHr: null },
        ]);
    });

    it('parses a junk results payload as empty, not as a throw', async () => {
        hf.state.native = true;
        hf.state.impl = {
            requestHealthPermissions: vi.fn().mockResolvedValue(undefined),
            getData: vi.fn(async () => ({ results: 'not json at all {{{' })),
        };
        await expect(createRecoveryProvider().fetchRecent(30)).resolves.toEqual([]);
    });
});

describe('official plugin — sleep unit normalization', () => {
    function implWithSleep(sleepRows) {
        hf.state.native = true;
        hf.state.impl = {
            requestHealthPermissions: vi.fn().mockResolvedValue(undefined),
            getData: vi.fn(async ({ parameters }) => {
                const p = JSON.parse(parameters);
                if (p.Variable === 'SLEEP') {
                    return { results: JSON.stringify(sleepRows) };
                }
                return { results: '[]' };
            }),
        };
    }

    it('normalizes hours, minutes, seconds and milliseconds to hours', async () => {
        implWithSleep([
            { startDate: d(4), value: 8 }, // already hours
            { startDate: d(3), value: 480 }, // minutes → 8h
            { startDate: d(2), value: 28800 }, // seconds → 8h
            { startDate: d(1), value: 28800000 }, // milliseconds → 8h
        ]);
        const samples = await createRecoveryProvider().fetchRecent(30);
        expect(samples.map((s) => s.sleepHours)).toEqual([8, 8, 8, 8]);
    });

    it('treats magnitudes that cannot be one day as missing', async () => {
        // 5e9 ms ≈ 1388h — not a plausible day of sleep → null → sample dropped.
        implWithSleep([{ startDate: d(0), value: 5000000000 }]);
        await expect(createRecoveryProvider().fetchRecent(30)).resolves.toEqual([]);
    });

    it('treats zero-value buckets as missing data, not zero sleep', async () => {
        implWithSleep([{ startDate: d(0), value: 0 }]);
        await expect(createRecoveryProvider().fetchRecent(30)).resolves.toEqual([]);
    });
});
