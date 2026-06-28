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
        pool: 'threads',
        threads: {
            singleThread: true,
        },
        // Each test file gets a fresh module registry. Required because
        // e2e.test.jsx uses vi.mock() on lib/api, lib/platform and recharts —
        // with isolate:false those mocks fail to apply once another file has
        // already loaded the real modules into the shared registry, and the
        // db singleton's in-memory cache leaks across files.
        isolate: true,
    },
});
