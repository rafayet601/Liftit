/**
 * Routine share links — programs as compact URL fragments.
 *
 * Serialization is JSON → UTF-8 bytes → hand-rolled base64url (no padding,
 * URL-safe alphabet), so a whole block fits in a `?program=` query param.
 * Decoding validates and clamps like functions/api/_lib.js does for server
 * payloads: size ceilings first, charset checks, JSON.parse in try/catch,
 * then createProgram normalization plus hard array/number clamps so a
 * hostile link can never allocate megabytes or hijack the active program.
 */

import { createProgram, uid } from './schema';

export class ShareLinkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShareLinkError';
    }
}

/** Mirrors LIMITS.programPayload on the server (100 KB). */
export const MAX_SHARE_FRAGMENT_CHARS = 100_000;
const MAX_DAYS = 14;
const MAX_EXERCISES_PER_DAY = 20;
const MAX_NAME_CHARS = 200;
const MAX_TEXT_CHARS = 2000;

const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || min)));

const clampText = (value, max) => {
    const s = typeof value === 'string' ? value : '';
    return s.slice(0, max);
};

/* ------------------------------------------------------------------ */
/* base64url (hand-rolled, dependency-free)                            */
/* ------------------------------------------------------------------ */

export function bytesToBase64Url(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(fragment) {
    let b64 = fragment.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/* ------------------------------------------------------------------ */
/* Encode / decode                                                     */
/* ------------------------------------------------------------------ */

export function programToFragment(program) {
    // Sanitize on the way out too: a shared link should already be within
    // every clamp (days, exercises, string lengths) no matter what fed it.
    const json = JSON.stringify(sanitizeProgram(program ?? {}));
    const fragment = bytesToBase64Url(new TextEncoder().encode(json));
    if (fragment.length > MAX_SHARE_FRAGMENT_CHARS) {
        throw new ShareLinkError('This program is too large to share.');
    }
    return fragment;
}

export function programFromFragment(fragment) {
    if (typeof fragment !== 'string' || !fragment.length) {
        throw new ShareLinkError('This share link is empty.');
    }
    if (fragment.length > MAX_SHARE_FRAGMENT_CHARS) {
        throw new ShareLinkError('This share link is too large.');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(fragment)) {
        throw new ShareLinkError('This share link is malformed.');
    }

    let json;
    try {
        json = new TextDecoder().decode(base64UrlToBytes(fragment));
    } catch {
        throw new ShareLinkError('This share link is malformed.');
    }

    let raw;
    try {
        raw = JSON.parse(json);
    } catch {
        throw new ShareLinkError('This share link is not a valid program.');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ShareLinkError('This share link is not a valid program.');
    }

    return sanitizeProgram(raw);
}

/**
 * Normalize through createProgram (fills every field with safe defaults,
 * coerces numbers) then hard-clamp collection sizes and ranges. The
 * imported program always gets a fresh id and is never active on arrival —
 * activating it is an explicit user decision.
 */
function sanitizeProgram(raw) {
    const program = createProgram(raw);
    program.id = uid('prog');
    program.isActive = false;
    program.name = clampText(program.name, MAX_NAME_CHARS) || 'Shared Program';
    program.description = clampText(program.description, MAX_TEXT_CHARS);
    program.rationale = clampText(program.rationale, MAX_TEXT_CHARS);
    program.goal = ['strength', 'hypertrophy', 'general'].includes(program.goal)
        ? program.goal
        : 'general';
    program.experience = ['beginner', 'intermediate', 'advanced'].includes(program.experience)
        ? program.experience
        : 'intermediate';
    program.daysPerWeek = clampInt(program.daysPerWeek, 1, 7);
    program.durationWeeks = clampInt(program.durationWeeks, 1, 52);

    const rawDays = Array.isArray(program.days) ? program.days : [];
    program.days = rawDays.slice(0, MAX_DAYS).map((day, i) => ({
        ...day,
        dayNumber: i + 1,
        name: clampText(day.name, 100) || `Day ${i + 1}`,
        focus: clampText(day.focus, 100),
        isRestDay: Boolean(day.isRestDay),
        exercises: (Array.isArray(day.exercises) ? day.exercises : [])
            .slice(0, MAX_EXERCISES_PER_DAY)
            .map((e, j) => ({
                ...e,
                order: j + 1,
                restSec: clampInt(e.restSec, 0, 600),
                targetSets: clampInt(e.targetSets, 1, 8),
                targetRepsMin: clampInt(e.targetRepsMin, 1, 100),
                targetRepsMax: clampInt(e.targetRepsMax, 1, 100),
                targetRpe: Math.max(1, Math.min(10, Number(e.targetRpe) || 8)),
                notes: clampText(e.notes, 500),
            })),
    }));
    return program;
}

/** Full share URL for a program, e.g. https://app/?program=<fragment>. */
export function buildShareUrl(program, { origin, path } = {}) {
    const base = `${origin ?? globalThis.location.origin}${path ?? globalThis.location.pathname}`;
    return `${base}?program=${programToFragment(program)}`;
}

/** Pull and validate the ?program= fragment from a query string. Returns null when absent. */
export function programFromSearchParams(searchParams) {
    const fragment = searchParams?.get?.('program');
    if (!fragment) return null;
    return programFromFragment(fragment);
}
