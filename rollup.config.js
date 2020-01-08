import babel from 'rollup-plugin-babel';
import { eslint } from 'rollup-plugin-eslint';
import process from 'process';
import typescript from 'rollup-plugin-typescript';
import { uglify } from 'rollup-plugin-uglify';

const isDev = process.argv.indexOf('-w') !== -1;

export default [
    {
        input: './src/index.ts',
        plugins: [
            typescript(),
            babel(),
            isDev
                ? null
                : uglify()
        ],
        output: {
            file: './index.iife.js',
            format: 'iife',
            name: 'FT',
            sourcemap: false,
            strict: true
        }
    },
    {
        input: './src/index.ts',
        plugins: [
            eslint(),
            typescript(),
            babel()
        ],
        output: {
            file: './index.js',
            format: 'esm',
            sourcemap: false,
            strict: true
        }
    }
];
