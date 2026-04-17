import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: false, // We ship a hand-written manifest.webmanifest
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
                navigateFallback: '/index.html',
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.origin === 'https://rsms.me',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'inter-font',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                    {
                        urlPattern: /\/api\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    server: {
        host: true,
    },
    build: {
        target: 'es2018',
        sourcemap: false,
    },
});
