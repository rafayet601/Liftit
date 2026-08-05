import { post } from '../lib/api';

/**
 * Web checkout via Stripe. The server owns every secret; this module only
 * ever sees redirect URLs. Native (App Store / Play) builds must not call
 * these — purchases there go through in-app purchase instead, which is why
 * Settings only renders buy buttons on the web (see BILLING.md).
 */

export const startCheckout = async (plan) => {
    const res = await post('/billing/checkout', { plan });
    const url = res.data?.url;
    if (!url) throw new Error('Checkout could not be started.');
    window.location.assign(url);
};

export const openBillingPortal = async () => {
    const res = await post('/billing/portal');
    const url = res.data?.url;
    if (!url) throw new Error('The billing portal is unavailable.');
    window.location.assign(url);
};
