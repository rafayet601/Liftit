import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no WebGL renderer. Model an unavailable GPU without emitting an
// unsupported-canvas warning for every route; shader tests provide a GL double.
if (typeof HTMLCanvasElement !== 'undefined') {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return originalGetContext.call(this, type, ...args);
    };
}

// jsdom polyfills for APIs the app uses but jsdom lacks
if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
        window.matchMedia = (query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        });
    }
    if (!window.scrollTo) {
        window.scrollTo = () => {};
    }
    // ResizeObserver used by recharts
    class RO {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    if (!window.ResizeObserver) window.ResizeObserver = RO;
}

afterEach(() => cleanup());
