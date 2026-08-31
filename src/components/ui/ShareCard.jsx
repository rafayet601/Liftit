import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import { db } from '../../data/db';
import { useUnit } from '../../contexts/UnitContext';

/**
 * PR share card — renders a 1080×1920 (9:16) canvas card from a `prTimeline`
 * event ({ date, exerciseId, prs: [{ type: 'weight'|'reps'|'e1rm', ... }] })
 * and hands the PNG to navigator.share, falling back to a download.
 * Canvas is fully guarded: environments without 2D context (jsdom, blocked
 * APIs) degrade to a console warning, never a crash.
 */

const W = 1080;
const H = 1920;
const BG = '#0b0b0c';
const ACCENT = '#8b5cf6';
const FONT_STACK = "'Space Grotesk', 'Inter', system-ui, sans-serif";

function pickPr(prs) {
    return (
        prs?.find((p) => p.type === 'weight') ??
        prs?.find((p) => p.type === 'e1rm') ??
        prs?.[0] ??
        null
    );
}

/** Builds the text model drawn onto the card. Pure + testable. */
export function buildPrCardModel(event, unit, displayWeight) {
    const pr = pickPr(event?.prs);
    if (!pr) return null;
    let label;
    let value;
    let sub;
    if (pr.type === 'weight') {
        label = 'Heaviest set';
        value = `${displayWeight(pr.value)} ${unit}`;
    } else if (pr.type === 'e1rm') {
        label = 'Est. 1RM';
        value = `${displayWeight(pr.value)} ${unit}`;
    } else {
        label = 'Rep record';
        value = `${pr.value} reps`;
        if (pr.weight > 0) sub = `@ ${displayWeight(pr.weight)} ${unit}`;
    }
    return {
        label,
        value,
        sub,
        date: new Date(event.date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }),
    };
}

function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function drawCentered(ctx, text, y, font, color, maxWidth = W - 160) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const size = Number((/(\d+)px/.exec(font) || [])[1]) || 40;
    for (const line of wrapText(ctx, text, maxWidth)) {
        ctx.fillText(line, W / 2, y);
        y += Math.round(size * 1.15);
    }
    return y;
}

/** Draws the card onto a 2D context. Returns false if the context is unusable. */
export function drawPrCard(ctx, { exerciseName, label, value, sub, date }) {
    if (!ctx) return false;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 340, 60, W / 2, 340, 900);
    glow.addColorStop(0, 'rgba(139, 92, 246, 0.28)');
    glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 1100);

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
    ctx.lineWidth = 6;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    let y = drawCentered(ctx, 'NEW PR', 400, `700 44px ${FONT_STACK}`, ACCENT);
    y = drawCentered(ctx, exerciseName, y + 130, `700 104px ${FONT_STACK}`, '#fafafa', W - 200);

    y = drawCentered(ctx, label.toUpperCase(), y + 140, `700 34px ${FONT_STACK}`, '#71717a');
    y = drawCentered(ctx, value, y + 170, `700 220px ${FONT_STACK}`, '#fafafa');
    if (sub) y = drawCentered(ctx, sub, y + 90, `600 64px ${FONT_STACK}`, '#a1a1aa');

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 90, y + 110);
    ctx.lineTo(W / 2 + 90, y + 110);
    ctx.stroke();

    drawCentered(ctx, date, y + 210, `600 40px ${FONT_STACK}`, '#71717a');

    ctx.textAlign = 'left';
    ctx.font = `700 56px ${FONT_STACK}`;
    ctx.fillStyle = '#fafafa';
    ctx.fillText('Liftit', 96, H - 130);
    const wordmarkWidth = ctx.measureText('Liftit').width;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(96 + wordmarkWidth + 14, H - 160, 16, 16);
    return true;
}

async function canvasToBlob(canvas) {
    return new Promise((resolve) => {
        try {
            canvas.toBlob(resolve, 'image/png');
        } catch {
            resolve(null);
        }
    });
}

export default function ShareCard({ event, className }) {
    const { unit, displayWeight } = useUnit();

    const exerciseName = useMemo(() => {
        try {
            return db.exercises.byId(event?.exerciseId)?.name ?? 'Exercise';
        } catch {
            return 'Exercise';
        }
    }, [event]);

    const card = useMemo(
        () => buildPrCardModel(event, unit, displayWeight),
        [event, unit, displayWeight],
    );

    const share = useCallback(async () => {
        if (!card) return;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
            if (!ctx || !drawPrCard(ctx, { exerciseName, ...card })) {
                console.warn('[ShareCard] canvas rendering unavailable');
                return;
            }
            const blob = await canvasToBlob(canvas);
            if (!blob) {
                console.warn('[ShareCard] PNG export unavailable');
                return;
            }
            const file = new File([blob], 'liftit-pr.png', { type: 'image/png' });
            if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Liftit — new PR',
                    text: `${exerciseName}: ${card.value}`,
                });
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'liftit-pr.png';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.warn('[ShareCard] share failed', err);
        }
    }, [card, exerciseName]);

    if (!card) return null;

    return (
        <button type="button" onClick={share} className={clsx('btn-secondary w-full', className)}>
            <Share2 className="h-4 w-4" /> Share PR
        </button>
    );
}
