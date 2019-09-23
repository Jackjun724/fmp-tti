const process = require('process');
const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const typescript = require('rollup-plugin-typescript');
const { eslint } = require('rollup-plugin-eslint');
const { uglify } = require('rollup-plugin-uglify');

const isDev = process.argv.indexOf('-d') !== -1;

const input = 'src/index.ts';
const esOutput = {
    format: 'esm',
    file: './index.js'
};
const iifeOutput = {
    format: 'iife',
    name: 'FT',
    file: './index.iife.js'
};

async function build() {
    if (isDev) {
        rollup
            .watch({
                input,
                plugins: [typescript(), babel()],
                output: [esOutput, iifeOutput]
            })
            .on('event', event => console.log(`>> ${event.code}`));
    } else {
        const esBundle = await rollup.rollup({
            input,
            plugins: [
                eslint(),
                typescript(),
                babel()
            ]
        });
        await esBundle.write(esOutput);
        const iifeBundle = await rollup.rollup({
            input,
            plugins: [typescript(), uglify(), babel()]
        });
        await iifeBundle.write(iifeOutput);
    }
}

build();
