/**
 * Bring-your-own-model AI layer.
 *
 * The user picks a provider in Settings and pastes their own API key; the
 * key lives only in db.settings on this device (excluded from export and
 * never synced). Chat calls go straight from the browser to the provider —
 * the app's own backend is never in the path.
 *
 * This is deliberate: a hosted coach would bill the operator's key for every
 * message, which is the one thing that stops Liftit's hosting from being
 * free. BYO keeps inference cost with whoever chose the model.
 */

import { db } from '../data/db';

export const AI_PROVIDERS = {
    none: { label: 'Off', defaultModel: '' },
    anthropic: { label: 'Anthropic', defaultModel: 'claude-sonnet-4-6' },
    openai: { label: 'OpenAI', defaultModel: 'gpt-5.2' },
    groq: { label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
    custom: { label: 'Custom', defaultModel: '' },
};

export function getAiConfig() {
    return db.settings.get().ai;
}

export function hasUserProvider() {
    const ai = getAiConfig();
    return ai.provider !== 'none' && Boolean(ai.apiKey) && (ai.provider !== 'custom' || Boolean(ai.baseUrl));
}

/** True if a path to an AI coach exists. */
export function coachAvailable() {
    return hasUserProvider();
}

/**
 * Send a chat turn. messages: [{ role: 'user'|'assistant', content }].
 * Returns the assistant's reply text. Throws with a friendly message.
 */
export async function chat(messages, systemPrompt) {
    if (!hasUserProvider()) {
        throw new Error('No AI provider configured. Add your API key in Settings → AI Coach.');
    }
    const ai = getAiConfig();
    if (ai.provider === 'anthropic') return anthropicChat(ai, messages, systemPrompt);
    return openAiCompatChat(ai, messages, systemPrompt);
}

/* ------------------------------------------------------------------ */
/* Provider adapters                                                   */
/* ------------------------------------------------------------------ */

async function anthropicChat(ai, messages, systemPrompt) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': ai.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: ai.model || AI_PROVIDERS.anthropic.defaultModel,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
    });
    if (!res.ok) throw await apiError(res, 'Anthropic');
    const data = await res.json();
    const text = data?.content?.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('Anthropic returned an empty reply.');
    return text;
}

const OPENAI_COMPAT_BASES = {
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
};

async function openAiCompatChat(ai, messages, systemPrompt) {
    const base = (ai.provider === 'custom' ? ai.baseUrl : OPENAI_COMPAT_BASES[ai.provider])?.replace(/\/$/, '');
    if (!base) throw new Error('Missing base URL for the custom provider.');
    // SECURITY: never send the API key + grounded prompt over plaintext or a
    // non-HTTP(S) scheme. Require https for custom endpoints.
    if (ai.provider === 'custom' && !/^https:\/\//i.test(base)) {
        throw new Error('Custom provider base URL must start with https://');
    }
    const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${ai.apiKey}`,
        },
        body: JSON.stringify({
            model: ai.model || AI_PROVIDERS[ai.provider]?.defaultModel,
            max_tokens: 1024,
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
        }),
    });
    if (!res.ok) throw await apiError(res, AI_PROVIDERS[ai.provider]?.label ?? 'provider');
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('The provider returned an empty reply.');
    return text;
}

async function apiError(res, label) {
    let detail = '';
    try {
        const body = await res.json();
        detail = body?.error?.message ?? '';
    } catch {
        /* plain text */
    }
    if (res.status === 401) return new Error(`${label} rejected the API key — check it in Settings.`);
    if (res.status === 429) return new Error(`${label} rate limit hit — try again shortly.`);
    return new Error(`${label} error (${res.status})${detail ? `: ${detail}` : ''}`);
}
