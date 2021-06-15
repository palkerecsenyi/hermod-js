import {program} from 'commander'
import compileFiles from './files'

program.name('hermod-js').version('0.1.0')
    .option('-i, --in <path>', 'compilation context (directory to take .hermod.yaml files from)')
    .option('-o, --out <path>', 'output directory (must exist)')
    .option('-b --base <path>', 'relative root of Hermod imports', 'hermod-js')
    .parse(process.argv)

const opts = program.opts()

compileFiles(opts.in, opts.out, opts.base)
