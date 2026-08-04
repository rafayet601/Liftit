import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        css: false,
        include: ['src/**/*.{test,spec}.{js,jsx}'],
        // NOTE: Vitest cannot spawn workers when the checkout path contains a
        // curly apostrophe (U+2019), e.g. ".../Mohammad’s MacBook Pro (2)/".
        // Every run dies with "Failed to start <pool> worker" after a 10-minute
        // timeout having collected zero tests — with both the threads and forks
        // pools. Clone to an ASCII path to run tests locally; CI is unaffected
        // because it checks out to a clean path.
        pool: 'forks',
        // Each test file gets a fresh module registry. Required because
        // e2e.test.jsx uses vi.mock() on lib/api, lib/platform and recharts —
        // with isolate:false those mocks fail to apply once another file has
        // already loaded the real modules into the shared registry, and the
        // db singleton's in-memory cache leaks across files.
        isolate: true,
    },
});
