/**
 * CSV importer core — canonical parsing pipeline shared by the Strong,
 * Hevy and FitNotes adapters (see .agents/v2/explorer-formats/specs/).
 *
 * This module is PURE on purpose: it never imports `db.js`. Parsing,
 * unit normalization, date handling and exercise-name matching live here;
 * custom-exercise creation and document commits happen in `db.importers`
 * so there is no import cycle and the preview step can never mutate data.
 *
 * Canonical intermediate shape (specs/canonical-shape.md §1):
 *   { date, startedAt, endedAt, name, notes, durationSec, source,
 *     exercises: [{ sourceName, sets: [{ weight, reps, rpe, setNumber, isWarmup }] }] }
 * All weights arrive in KG (converted at the adapter edge).
 */

import { matchExerciseByName, getLibraryExercise, searchLibrary } from '../exercises';

export const LB_TO_KG = 0.45359237;

/* ------------------------------------------------------------------ */
/* CSV text parsing (RFC 4180, hand-rolled — no new dependencies)      */
/* ------------------------------------------------------------------ */

/** Strip a UTF-8 BOM before any header matching (seen in Strong exports). */
export function stripBom(text) {
    const s = String(text ?? '');
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Sniff `,` vs `;` from the first non-empty line, counting outside quotes. */
function sniffDelimiter(text) {
    let commas = 0;
    let semis = 0;
    let inQuotes = false;
    for (const ch of text) {
        if (ch === '\n') break;
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch === ',') commas += 1;
        else if (!inQuotes && ch === ';') semis += 1;
    }
    return semis > commas ? ';' : ',';
}

/**
 * Parse CSV text into rows of string cells. Handles quoted cells
 * (embedded delimiters/newlines, `""` escapes), CRLF and trailing
 * newlines. Completely blank lines are skipped; all-empty *rows with
 * columns* are the adapters' concern (counted as dropped there).
 */
export function parseCsvText(rawText) {
    const text = stripBom(rawText);
    const delim = sniffDelimiter(text);
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    const endRow = () => {
        row.push(cell);
        cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delim) {
            row.push(cell);
            cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
            endRow();
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length > 0) endRow();
    return rows;
}

/** Lowercase/trim a header cell so matching is by name, never position. */
export function normalizeHeader(h) {
    return String(h ?? '').trim().toLowerCase().replace(/^"|"$/g, '');
}

/** Map normalized header names to column indexes. */
export function headerIndex(headers) {
    const map = new Map();
    headers.forEach((h, i) => {
        if (!map.has(h)) map.set(h, i);
    });
    return map;
}

/** First missing required header (normalized), or null when complete. */
export function findMissingHeaders(headers, required) {
    const present = new Set(headers);
    return required.filter((r) => !present.has(r));
}

/* ------------------------------------------------------------------ */
/* Numeric cells — decimal-comma / thousands defensiveness (§3)        */
/* ------------------------------------------------------------------ */

/**
 * Parse a numeric CSV cell. Rules (specs/canonical-shape.md §3):
 *  - `72,5`   → 72.5   (single comma, 1–2 digit final group = decimal comma)
 *  - `1,275`  → 1275   (exactly-3-digit final group = thousands separator)
 *  - `1,275,000` → 1275000
 * Blank → null; garbage → null. Never throws.
 */
export function parseCsvNumber(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s) return null;
    s = s.replace(/\s+/g, '');
    if (/^-?\d+(,\d{3})+(,\d{3})*$/.test(s) || /^-?\d+,\d{3}$/.test(s)) {
        s = s.replace(/,/g, ''); // thousands groups
    } else if (/^-?\d+,\d{1,2}$/.test(s)) {
        s = s.replace(',', '.'); // decimal comma
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

export function round2(n) {
    return Math.round(n * 100) / 100;
}

/** lbs → kg at the adapter edge (house rule), 2 decimals. */
export function lbToKg(lbs) {
    return round2(lbs * LB_TO_KG);
}

/* ------------------------------------------------------------------ */
/* Dates — every format the three apps emit (per-source specs §3)      */
/* ------------------------------------------------------------------ */

const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad2 = (n) => String(n).padStart(2, '0');

function localIso(y, mo, d, h = 0, mi = 0, s = 0) {
    const date = new Date(y, mo - 1, d, h, mi, s);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function amPmAdjust(hour, ampm) {
    const a = String(ampm ?? '').trim().toUpperCase();
    if (a === 'PM' && hour < 12) return hour + 12;
    if (a === 'AM' && hour === 12) return 0;
    return hour;
}

/**
 * Parse a session timestamp into { date: 'YYYY-MM-DD', startedAt: ISO | null }.
 * Accepted shapes (canonical §2 + per-source specs):
 *  - `YYYY-MM-DD HH:MM:SS` / `HH:MM` / `YYYY-MM-DDTHH:MM:SS` (Strong, local)
 *  - `22 Dec 2025, 08:00` and `10 Jun 2024, 8:15 PM` (Hevy, local)
 *  - ISO 8601
 *  - `YYYY-MM-DD` / `YYYY/MM/DD` (FitNotes, date only → startedAt null)
 * Returns null for anything else — callers report the row instead of
 * guessing day/month order.
 */
export function parseSessionDate(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    // ISO 8601 (with optional T/time) — let Date handle the real ISO forms.
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return null;
        return {
            date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
            startedAt: d.toISOString(),
        };
    }

    // 2020-12-30 18:51:52 | 2020-12-30 18:51 | 2020-12-30
    let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (m) {
        const [, y, mo, d, h, mi, sec] = m;
        return {
            date: `${y}-${mo}-${d}`,
            startedAt: h === undefined ? null : localIso(+y, +mo, +d, +h, +mi, +(sec ?? 0)),
        };
    }

    // 2026/04/29 (slash-date variant; date-only)
    m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
    if (m) {
        const [, y, mo, d] = m;
        return { date: `${y}-${pad2(+mo)}-${pad2(+d)}`, startedAt: null };
    }

    // 22 Dec 2025, 08:00 | 10 Jun 2024, 8:15 PM | 10 Jun 2024 08:15
    m = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(s);
    if (m) {
        const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
        if (!mo) return null;
        const h = amPmAdjust(+m[4], m[6]);
        if (h > 23) return null;
        return {
            date: `${m[3]}-${pad2(mo)}-${pad2(+m[1])}`,
            startedAt: localIso(+m[3], mo, +m[1], h, +m[5]),
        };
    }

    // Jun 10, 2024, 8:15 PM (12-hour emission variant)
    m = /^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(s);
    if (m) {
        const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
        if (!mo) return null;
        const h = amPmAdjust(+m[4], m[6]);
        if (h > 23) return null;
        return {
            date: `${m[3]}-${pad2(mo)}-${pad2(+m[2])}`,
            startedAt: localIso(+m[3], mo, +m[2], h, +m[5]),
        };
    }

    return null;
}

/**
 * Strong `Duration` token: `45m` / `2h 38m` / `3h` / `1h 8m 30s` → seconds.
 * Empty → 0. Not an HH:MM:SS clock — an elapsed length.
 */
export function parseDurationToken(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    let seconds = 0;
    let matched = false;
    for (const m of s.matchAll(/(\d+)\s*(h|m|s)\b/gi)) {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        if (!Number.isFinite(n)) continue;
        matched = true;
        if (unit === 'h') seconds += n * 3600;
        else if (unit === 'm') seconds += n * 60;
        else seconds += n;
    }
    return matched ? seconds : 0;
}

/** FitNotes `Time` cell: `HH:MM:ss` or `MM:ss` → seconds. Else null. */
export function parseTimeToken(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    return (+(m[1] ?? 0)) * 3600 + +m[2] * 60 + +m[3];
}

/* ------------------------------------------------------------------ */
/* Exercise matching ladder (canonical §2)                             */
/* ------------------------------------------------------------------ */

/**
 * Alias table for the known hard cases — Strong/Hevy library style
 * (`Exercise (Equipment)`) vs Liftit's word-reversed names.
 */
export const NAME_ALIASES = {
    squat: 'barbell-back-squat',
    squats: 'barbell-back-squat',
    'back squat': 'barbell-back-squat',
    'bench press': 'barbell-bench-press',
    deadlift: 'conventional-deadlift',
    'bent over row': 'barbell-row',
};

function stripParenGroups(name) {
    return name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** FitNotes machine names: `Preacher Curl - Star Trac` → `Preacher Curl`. */
function stripTrailingTail(name) {
    const idx = name.lastIndexOf(' - ');
    return idx > 0 ? name.slice(0, idx).trim() : name;
}

const tokenize = (name) => name.split(/[^a-z0-9]+/i).filter(Boolean);

/** Word-order-insensitive token match with short-needle guard (§2 step 3). */
function tokenMatch(normalizedName) {
    const src = tokenize(normalizedName);
    if (!src.length) return null;
    let best = null;
    let bestOverlap = 0;
    for (const e of getLibraryList()) {
        const lib = tokenize(e.name.toLowerCase());
        const forward = src.every((t) => lib.includes(t));
        // Reverse-direction contains is only safe for ≥2-token needles —
        // otherwise "squat" would wrongly match "Front Squat" first.
        const reverse = src.length >= 2 && lib.every((t) => src.includes(t));
        if (!forward && !reverse) continue;
        const overlap = src.filter((t) => lib.includes(t)).length;
        if (overlap > bestOverlap) {
            best = e;
            bestOverlap = overlap;
        }
    }
    return best;
}

// The ladder only needs contains/token matches, which searchLibrary with
// an empty query exposes without touching db state (library is static).
let libraryList = null;
function getLibraryList() {
    if (!libraryList) libraryList = searchLibrary('');
    return libraryList;
}

/**
 * The full matching ladder for one source name. Returns a library
 * exercise or null — the caller (db.importers.commit) owns custom-exercise
 * creation for null results. Never mutates `sourceName`.
 */
export function resolveSourceName(sourceName) {
    const raw = String(sourceName ?? '').trim();
    if (!raw) return null;

    // 1. Full string (exact map hits live here).
    const full = matchExerciseByName(raw);
    if (full) return full;

    // 2. De-parenthesized (`Bench Press (Barbell)` → `bench press`).
    const deparen = stripParenGroups(raw).toLowerCase();
    if (deparen) {
        const hit = matchExerciseByName(deparen);
        if (hit) return hit;
    }

    // 2b. Strip trailing ` - <machine/brand>` segments and retry.
    const stripped = stripTrailingTail(deparen);
    if (stripped && stripped !== deparen) {
        const hit = matchExerciseByName(stripped);
        if (hit) return hit;
    }

    // 3. Alias table + word-order-insensitive token match.
    const aliasId = NAME_ALIASES[stripped] ?? NAME_ALIASES[deparen];
    if (aliasId) {
        const aliased = getLibraryExercise(aliasId);
        if (aliased) return aliased;
    }
    return tokenMatch(stripped || deparen);
}

/* ------------------------------------------------------------------ */
/* Canonical shaping helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Final sanity assertion for a set weight (canonical rule 2): must be a
 * finite number ≥ 0. Returns the number or null (caller drops + reports).
 */
export function saneWeight(kg) {
    if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < 0) return null;
    return round2(kg);
}

/** Stable sort by raw order index, then renumber setNumber 1..N (§4). */
export function renumberSets(sets) {
    return [...sets]
    // Array#sort is stable — equal keys keep file order.
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map(({ orderIndex, ...rest }, i) => ({ ...rest, setNumber: i + 1 }));
}

/** Deterministic content hash for preview rows (FNV-1a over the payload). */
export function contentHash(canonicalWorkout) {
    const payload = JSON.stringify([
        canonicalWorkout.date,
        canonicalWorkout.name,
        canonicalWorkout.exercises.map((e) => [e.sourceName, e.sets.length, e.sets.map((s) => [s.weight, s.reps, s.rpe, s.isWarmup])]),
    ]);
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i += 1) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16);
}

/**
 * Ordered session grouping shared by all adapters: rows arrive in file
 * order; a session boundary is a changed key. Returns array of
 * { key, rows } — never reorders rows within a session.
 */
export function groupSessions(rows, keyOf) {
    const groups = [];
    const byKey = new Map();
    for (const row of rows) {
        const key = keyOf(row);
        if (!byKey.has(key)) {
            const group = { key, rows: [] };
            byKey.set(key, group);
            groups.push(group);
        }
        byKey.get(key).rows.push(row);
    }
    return groups;
}

/** Standard failure payload for malformed files. */
export function importError(source, message, extra = {}) {
    return { ok: false, source, error: message, ...extra };
}

/** Shared empty-stats template so every adapter reports the same fields. */
export function newParseStats() {
    return {
        totalRows: 0,
        parsedSets: 0,
        emptyRowsDropped: 0,
        skippedRows: 0,
        cardioRows: 0,
        setNotesObserved: 0,
        dropSetCount: 0,
        failureSetCount: 0,
        supersetExercises: 0,
        warnings: [],
    };
}

export function warn(stats, message) {
    if (!stats.warnings.includes(message)) stats.warnings.push(message);
}
