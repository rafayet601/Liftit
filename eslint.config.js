import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    {
        ignores: [
            'dist',
            'build',
            'node_modules',
            'server/**',
            'ios/**',
            'android/**',
            'coverage',
            'public/**',
            '*.config.js',
            '*.config.cjs',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { react: { version: '18.2' } },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'react/react-in-jsx-scope': 'off',
            'react-refresh/only-export-components': 'off',
            // React Compiler-style rules from eslint-plugin-react-hooks v7 are
            // too aggressive for our existing initialization patterns.
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/immutability': 'off',
            'react-hooks/preserve-manual-memoization': 'off',
            'react-hooks/exhaustive-deps': 'warn',
            'no-unused-vars': ['off'],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-undef': 'error',
            'no-case-declarations': 'off',
        },
    },
    {
        files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser, ...globals.vitest },
        },
    },
];
