const { argv } = require('process');
const { babel } = require('@rollup/plugin-babel');
const { eslint } = require('rollup-plugin-eslint');
const typescript = require('@rollup/plugin-typescript');
const { terser } = require('rollup-plugin-terser');

const isDev = argv.indexOf('-w') !== -1;

export default [
    // {
    //     input: './src/index.ts',
    //     plugins: [eslint(), typescript(), babel({ babelHelpers: 'bundled' }), isDev ? null : terser()],
    //     output: {
    //         file: './index.iife.js',
    //         format: 'iife',
    //         name: 'FT',
    //         sourcemap: false,
    //         strict: true,
    //     }
    // },
    // {
    //     input: './src/index.ts',
    //     plugins: [typescript(), babel({ babelHelpers: 'bundled' })],
    //     output: {
    //         file: './index.umd.js',
    //         format: 'umd',
    //         name: 'FT',
    //         sourcemap: false,
    //         strict: true,
    //     }
    // },
    // {
    //     input: './src/index.ts',
    //     plugins: [typescript(), babel({ babelHelpers: 'bundled' })],
    //     output: {
    //         file: './index.js',
    //         format: 'esm',
    //         sourcemap: false,
    //         strict: true,
    //     }
    // },
    {
        input: './src/size.ts',
        plugins: [eslint(), typescript(), babel({ babelHelpers: 'bundled' }), isDev ? null : terser()],
        output: {
            file: './size.iife.js',
            format: 'iife',
            name: 'FT',
            sourcemap: false,
            strict: true,
        }
    },
    {
        input: './src/size.ts',
        plugins: [typescript(), babel({ babelHelpers: 'bundled' })],
        output: {
            file: './size.umd.js',
            format: 'umd',
            name: 'FT',
            sourcemap: false,
            strict: true,
        },
    },
];
