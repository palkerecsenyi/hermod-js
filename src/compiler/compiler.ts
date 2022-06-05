import {program} from 'commander'
import compileFiles from './files.js'

program.name('hermod-js').version('0.2.1')
    .option('-i, --in <path>', 'compilation context (directory to take .hermod.yaml files from)')
    .option('-o, --out <path>', 'output directory (must exist)')
    .option('-b --base <path>', 'relative root of Hermod imports', 'hermod-js')
    .option('-c --compile', 'generate ES5 JavaScript (plus type declarations) instead of TypeScript', false)
    .parse(process.argv)

const opts = program.opts()

compileFiles(opts.in, opts.out, opts.base, opts.compile)
