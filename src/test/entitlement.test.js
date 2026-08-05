import { describe, it, expect } from 'vitest';
import { effectiveEntitlement, PLANS } from '../../functions/api/_lib';

/**
 * The launch-switch invariant: until BILLING_ENFORCED flips to "true",
 * entitlements must be invisible — every account resolves to Pro regardless
 * of what the table says, so shipping the rails cannot change anything for
 * the beta cohort. These tests pin both sides of the switch.
 */

describe('effectiveEntitlement — enforcement off (beta)', () => {
    it('resolves to Pro with no row at all', () => {
        const e = effectiveEntitlement(null, { enforced: false });
        expect(e.plan).toBe(PLANS.PRO);
        expect(e.billingEnforced).toBe(false);
    });

    it('resolves to Pro even for an explicit free row', () => {
        const e = effectiveEntitlement(
            { plan: 'free', source: 'none', expires_at: null },
            { enforced: false },
        );
        expect(e.plan).toBe(PLANS.PRO);
    });

    it('defaults to enforcement off when no options are given', () => {
        expect(effectiveEntitlement(null).plan).toBe(PLANS.PRO);
    });

    it('keeps a grandfathered source visible for the UI', () => {
        const e = effectiveEntitlement(
            { plan: 'pro', source: 'beta-grandfather', expires_at: null },
            { enforced: false },
        );
        expect(e.source).toBe('beta-grandfather');
    });
});

describe('effectiveEntitlement — enforcement on (launch)', () => {
    const now = 1_800_000_000_000;

    it('no row means the free plan', () => {
        const e = effectiveEntitlement(null, { now, enforced: true });
        expect(e.plan).toBe(PLANS.FREE);
        expect(e.billingEnforced).toBe(true);
    });

    it('a grandfathered row is Pro forever (null expiry)', () => {
        const e = effectiveEntitlement(
            { plan: 'pro', source: 'beta-grandfather', expires_at: null },
            { now, enforced: true },
        );
        expect(e.plan).toBe(PLANS.PRO);
        expect(e.expiresAt).toBeNull();
    });

    it('an unexpired subscription is Pro', () => {
        const e = effectiveEntitlement(
            { plan: 'pro', source: 'stripe', expires_at: now + 1 },
            { now, enforced: true },
        );
        expect(e.plan).toBe(PLANS.PRO);
        expect(e.expiresAt).toBe(now + 1);
    });

    it('an expired subscription lapses to free', () => {
        const e = effectiveEntitlement(
            { plan: 'pro', source: 'stripe', expires_at: now },
            { now, enforced: true },
        );
        expect(e.plan).toBe(PLANS.FREE);
    });

    it('a free row stays free even when unexpired', () => {
        const e = effectiveEntitlement(
            { plan: 'free', source: 'none', expires_at: null },
            { now, enforced: true },
        );
        expect(e.plan).toBe(PLANS.FREE);
    });
});
