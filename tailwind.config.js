/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // FORGE — carbon base
                ink: {
                    DEFAULT: '#0b0b0c',
                    50: '#f7f6f4',
                    100: '#efedea',
                    200: '#dedbd5',
                    300: '#c4c1ba',
                    400: '#a3a19b',
                    500: '#7c7a75',
                    600: '#55534f',
                    700: '#33322f',
                    800: '#1b1b1f',
                    900: '#131316',
                    950: '#0b0b0c',
                },
                // FORGE — ember accent
                accent: {
                    DEFAULT: '#ff6b3a',
                    50: '#fff3ec',
                    100: '#ffe4d4',
                    200: '#ffc5a6',
                    300: '#ffa06d',
                    400: '#ff8551',
                    500: '#ff6b3a',
                    600: '#f04e1d',
                    700: '#c83d15',
                    800: '#9e3214',
                    900: '#7f2d16',
                },
                // FORGE — steel secondary (informational)
                steel: {
                    DEFAULT: '#8fb0cf',
                    300: '#b7cde2',
                    400: '#a0bed9',
                    500: '#8fb0cf',
                    600: '#6c92b5',
                },
            },
            fontFamily: {
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    'sans-serif',
                ],
                display: [
                    'Space Grotesk',
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'sans-serif',
                ],
                mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'monospace'],
            },
            borderRadius: {
                xl: '12px',
                '2xl': '16px',
                '3xl': '22px',
            },
            boxShadow: {
                glow: '0 0 32px -10px rgba(255,107,58,0.4)',
                'glow-sm': '0 0 14px -4px rgba(255,107,58,0.45)',
                card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 28px -18px rgba(0,0,0,0.55)',
                'card-lg': '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -28px rgba(0,0,0,0.65)',
            },
            backgroundImage: {
                'gradient-ember': 'linear-gradient(135deg, #ff6b3a 0%, #ffa03d 100%)',
                'grid-faint':
                    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
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
                    from: { opacity: '0', transform: 'scale(0.97)' },
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
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(255,107,58,0.35)' },
                    '50%': { boxShadow: '0 0 0 12px rgba(255,107,58,0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 240ms cubic-bezier(0.2,0.7,0.2,1) both',
                'scale-in': 'scale-in 200ms cubic-bezier(0.2,0.7,0.2,1) both',
                'slide-up': 'slide-up 320ms cubic-bezier(0.2,0.7,0.2,1) both',
                shimmer: 'shimmer 2.2s linear infinite',
                'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
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
