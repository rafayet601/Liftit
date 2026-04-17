import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
