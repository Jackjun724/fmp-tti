import babel from '@rollup/plugin-babel';
import process from 'process';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const isDev = process.argv.indexOf('-w') !== -1;

export default [
    {
        input: './src/index.ts',
        plugins: [typescript(), babel.babel(), isDev ? null : terser()],
        output: {
            file: './index.iife.js',
            format: 'iife',
            name: 'FT',
            sourcemap: false,
            strict: true,
        },
    },
    {
        input: './src/index.ts',
        plugins: [typescript(), babel.babel()],
        output: {
            file: './index.umd.js',
            format: 'umd',
            name: 'FT',
            sourcemap: false,
            strict: true,
        },
    },
    {
        input: './src/index.ts',
        plugins: [
            // eslint(),
            typescript(),
            babel.babel(),
        ],
        output: {
            file: './index.js',
            format: 'esm',
            sourcemap: false,
            strict: true,
        },
    },
];
