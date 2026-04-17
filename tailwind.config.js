/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Canonical brand tokens
                ink: {
                    DEFAULT: '#09090b',
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    300: '#d4d4d8',
                    400: '#a1a1aa',
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#09090b',
                },
                accent: {
                    DEFAULT: '#bef264',
                    50: '#f7fee7',
                    100: '#ecfccb',
                    200: '#d9f99d',
                    300: '#bef264',
                    400: '#a3e635',
                    500: '#84cc16',
                    600: '#65a30d',
                    700: '#4d7c0f',
                    800: '#3f6212',
                    900: '#365314',
                },
            },
            fontFamily: {
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'SF Pro Display',
                    'Segoe UI',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    'sans-serif',
                ],
                mono: [
                    'ui-monospace',
                    'SFMono-Regular',
                    'SF Mono',
                    'Menlo',
                    'monospace',
                ],
            },
            borderRadius: {
                xl: '14px',
                '2xl': '20px',
                '3xl': '28px',
            },
            boxShadow: {
                glow: '0 0 40px -10px rgba(190,242,100,0.35)',
                'glow-sm': '0 0 16px -4px rgba(190,242,100,0.45)',
                card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.5)',
                'card-lg': '0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px -30px rgba(0,0,0,0.6)',
            },
            backgroundImage: {
                'gradient-ink': 'radial-gradient(1200px 600px at 10% -10%, rgba(190,242,100,0.07), transparent 60%), radial-gradient(900px 500px at 90% 110%, rgba(163,230,53,0.05), transparent 60%)',
                'grid-faint':
                    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            },
            backgroundSize: {
                grid: '32px 32px',
            },
            keyframes: {
                'fade-in': {
                    from: { opacity: '0', transform: 'translateY(6px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    from: { opacity: '0', transform: 'scale(0.96)' },
                    to: { opacity: '1', transform: 'scale(1)' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(24px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                pulseGlow: {
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(190,242,100,0.35)' },
                    '50%': { boxShadow: '0 0 0 12px rgba(190,242,100,0)' },
                },
                breathe: {
                    '0%,100%': { transform: 'scale(1)', opacity: '1' },
                    '50%': { transform: 'scale(1.04)', opacity: '0.9' },
                },
            },
            animation: {
                'fade-in': 'fade-in 280ms cubic-bezier(0.2,0.7,0.2,1) both',
                'scale-in': 'scale-in 220ms cubic-bezier(0.2,0.7,0.2,1) both',
                'slide-up': 'slide-up 360ms cubic-bezier(0.2,0.7,0.2,1) both',
                shimmer: 'shimmer 2.2s linear infinite',
                'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
                breathe: 'breathe 3.2s ease-in-out infinite',
            },
            spacing: {
                'safe-top': 'env(safe-area-inset-top)',
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-left': 'env(safe-area-inset-left)',
                'safe-right': 'env(safe-area-inset-right)',
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
