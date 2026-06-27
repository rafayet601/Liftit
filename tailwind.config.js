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
                // FORGE — deep purple accent
                accent: {
                    DEFAULT: '#8b5cf6',
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
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
                glow: '0 0 32px -10px rgba(139,92,246,0.4)',
                'glow-sm': '0 0 14px -4px rgba(139,92,246,0.45)',
                card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 28px -18px rgba(0,0,0,0.55)',
                'card-lg': '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -28px rgba(0,0,0,0.65)',
                'glass-glow-purple': '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(139,92,246,0.1) inset, 0 8px 32px 0 rgba(0,0,0,0.45), 0 0 20px -5px rgba(139,92,246,0.15)',
                'glass-glow-steel': '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(143,176,207,0.1) inset, 0 8px 32px 0 rgba(0,0,0,0.45), 0 0 20px -5px rgba(143,176,207,0.15)',
                'glass-glow-success': '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(74,222,128,0.1) inset, 0 8px 32px 0 rgba(0,0,0,0.45), 0 0 20px -5px rgba(74,222,128,0.15)',
                'glass-glow-danger': '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(248,113,113,0.1) inset, 0 8px 32px 0 rgba(0,0,0,0.45), 0 0 20px -5px rgba(248,113,113,0.15)',
            },
            backgroundImage: {
                'gradient-purple': 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                'gradient-steel': 'linear-gradient(135deg, #8fb0cf 0%, #b7cde2 100%)',
                'gradient-gold': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fcd34d 100%)',
                'gradient-success': 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                'gradient-purple-steel': 'linear-gradient(135deg, #8b5cf6 0%, #8fb0cf 100%)',
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
                'slide-in-right': {
                    from: { opacity: '0', transform: 'translateX(20px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                pulseGlow: {
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0.35)' },
                    '50%': { boxShadow: '0 0 0 12px rgba(139,92,246,0)' },
                },
                goldenPulse: {
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(251,191,36,0.4), 0 0 20px -4px rgba(251,191,36,0.2)' },
                    '50%': { boxShadow: '0 0 0 6px rgba(251,191,36,0), 0 0 28px -4px rgba(251,191,36,0.35)' },
                },
                'pr-badge-pop': {
                    '0%': { opacity: '0', transform: 'scale(0.6) rotate(-8deg)' },
                    '60%': { opacity: '1', transform: 'scale(1.12) rotate(2deg)' },
                    '80%': { transform: 'scale(0.96) rotate(-1deg)' },
                    '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
                },
                'set-complete': {
                    '0%': { transform: 'scale(1)' },
                    '30%': { transform: 'scale(1.25)' },
                    '60%': { transform: 'scale(0.92)' },
                    '100%': { transform: 'scale(1)' },
                },
                'purple-breathe': {
                    '0%,100%': { opacity: '0.07', transform: 'scale(1)' },
                    '50%': { opacity: '0.13', transform: 'scale(1.08)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 240ms cubic-bezier(0.2,0.7,0.2,1) both',
                'scale-in': 'scale-in 200ms cubic-bezier(0.2,0.7,0.2,1) both',
                'slide-up': 'slide-up 320ms cubic-bezier(0.2,0.7,0.2,1) both',
                'slide-in-right': 'slide-in-right 350ms cubic-bezier(0.2,0.8,0.2,1) both',
                shimmer: 'shimmer 2.2s linear infinite',
                'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
                'golden-pulse': 'goldenPulse 2.5s ease-in-out infinite',
                'pr-badge-pop': 'pr-badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                'set-complete': 'set-complete 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                'purple-breathe': 'purple-breathe 8s ease-in-out infinite',
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
