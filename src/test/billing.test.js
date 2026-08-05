import { describe, it, expect } from 'vitest';
import {
    hexToBytes,
    parseStripeSignature,
    resolveEntitlementUpdate,
    PLANS,
} from '../../functions/api/_lib';

/**
 * Billing safety rules. The one that matters most: no webhook, from any
 * billing system, may ever strip a lifetime grant — that's what makes the
 * beta-grandfather promise ("Pro for life") enforceable in code.
 */

describe('resolveEntitlementUpdate', () => {
    const grandfather = { plan: 'pro', source: 'beta-grandfather', expires_at: null };
    const stripeSub = { plan: 'pro', source: 'stripe', expires_at: 2_000_000_000_000 };

    it('applies an upgrade to a user with no entitlement', () => {
        const update = { plan: PLANS.PRO, source: 'stripe', expiresAt: 123 };
        expect(resolveEntitlementUpdate(null, update)).toBe(update);
    });

    it('never lets a Stripe cancellation strip a beta grandfather', () => {
        const update = { plan: PLANS.FREE, source: 'stripe', expiresAt: null };
        expect(resolveEntitlementUpdate(grandfather, update)).toBeNull();
    });

    it('never lets an expiring plan shorten a lifetime grant', () => {
        const update = { plan: PLANS.PRO, source: 'stripe', expiresAt: 123 };
        expect(resolveEntitlementUpdate(grandfather, update)).toBeNull();
    });

    it('lets a lifetime purchase replace an expiring subscription', () => {
        const update = { plan: PLANS.PRO, source: 'stripe', expiresAt: null };
        expect(resolveEntitlementUpdate(stripeSub, update)).toBe(update);
    });

    it('applies a same-source downgrade to an expiring subscription', () => {
        const update = { plan: PLANS.FREE, source: 'stripe', expiresAt: null };
        expect(resolveEntitlementUpdate(stripeSub, update)).toBe(update);
    });

    it('ignores a cross-source downgrade (App Store expiry vs Stripe sub)', () => {
        const update = { plan: PLANS.FREE, source: 'apple', expiresAt: null };
        expect(resolveEntitlementUpdate(stripeSub, update)).toBeNull();
    });

    it('applies a downgrade when the user is already free', () => {
        const existing = { plan: 'free', source: 'none', expires_at: null };
        const update = { plan: PLANS.FREE, source: 'stripe', expiresAt: null };
        expect(resolveEntitlementUpdate(existing, update)).toBe(update);
    });
});

describe('parseStripeSignature', () => {
    it('parses a standard header', () => {
        expect(parseStripeSignature('t=1712000000,v1=abc123')).toEqual({
            t: 1712000000,
            signatures: ['abc123'],
        });
    });

    it('collects multiple v1 signatures and ignores other schemes', () => {
        const parsed = parseStripeSignature('t=1712000000,v1=aaa,v0=zzz,v1=bbb');
        expect(parsed.signatures).toEqual(['aaa', 'bbb']);
    });

    it('rejects headers missing a timestamp or signature', () => {
        expect(parseStripeSignature('v1=abc')).toBeNull();
        expect(parseStripeSignature('t=1712000000')).toBeNull();
        expect(parseStripeSignature('t=soon,v1=abc')).toBeNull();
        expect(parseStripeSignature('')).toBeNull();
        expect(parseStripeSignature(undefined)).toBeNull();
    });
});

describe('hexToBytes', () => {
    it('decodes hex of either case', () => {
        expect(Array.from(hexToBytes('deadBEEF'))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it('rejects anything that is not clean hex', () => {
        expect(hexToBytes('abc')).toBeNull(); // odd length
        expect(hexToBytes('zz')).toBeNull(); // not hex
        expect(hexToBytes('')).toBeNull();
        expect(hexToBytes(null)).toBeNull();
    });
});
