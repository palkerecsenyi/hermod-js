import { file } from './files.js'
import { Config } from './parser.js'
import writeUnit from './unit.js'
import * as fs from 'fs'
import path from 'path'
import typescript from 'typescript'
import writeService from './service.js'

const { createProgram, ModuleKind, ScriptTarget } = typescript

export interface Writer {
    _lines: string[]
    _imports: {
        [key: string]: string[]
    }
    write(text: string): void
    writeln(text: string): void
    writelni(i: number, text: string): void
    importModuleRelative(from: string, ...module: string[]): void
    importHermod(...module: string[]): void
}

export function writeFileOutput(
    outDir: string,
    fileRef: file,
    config: Config,
    configs: Config[],
    importBase: string,
    compile: boolean
) {
    const fileName = fileRef.name.replace('.hermod.yaml', '.hermod')
    const w: Writer = {
        _lines: [],
        _imports: {},
        write(text: string) {
            if (this._lines.length === 0) {
                this._lines.push(text)
            } else {
                this._lines[this._lines.length - 1] += text
            }
        },
        writeln(text: string) {
            this._lines.push(text)
        },
        writelni(indentCount: number, text: string) {
            let indent = ''
            for (let i = 0; i < indentCount; i++) {
                indent += '    '
            }

            this._lines.push(indent + text)
        },
        importModuleRelative(from: string, ...module: string[]) {
            if (Object.keys(this._imports).includes(from)) {
                const isStar = this._imports[from].length === 2 && this._imports[from][0] === '*'
                if (isStar) return
                for (const m of module) {
                    if (!this._imports[from].includes(m)) {
                        this._imports[from].push(m);
                    }
                }
            } else {
                this._imports[from] = [...module];
            }
        },
        importHermod(...module: string[]) {
            this.importModuleRelative(importBase, ...module)
        }
    }

    if (config.units) {
        for (const unit of config.units) {
            writeUnit(w, unit, fileName, configs)
        }
    }

    if (config.services) {
        for (const service of config.services) {
            writeService(w, service, fileName, configs)
        }
    }

    let text = ''
    for (let from of Object.keys(w._imports)) {
        const what = w._imports[from]
        if (what.length === 0) continue
        if (what[0] === '*') {
            text += `import * as ${what[1]} from '${from}'`
        } else if (what[0] === '__DEFAULT') {
            text += `import ${what[1]} from '${from}'`
        } else {
            text += `import {${what.join(', ')}} from '${from}'`
        }

        text += '\n'
    }

    text += w._lines.join('\n')
    const joinedFileName = path.join(outDir, fileName + '.ts')
    fs.writeFileSync(joinedFileName, text)

    if (compile) {
        const program = createProgram([joinedFileName], {
            module: ModuleKind.CommonJS,
            target: ScriptTarget.ES5,
            declaration: true,
            noResolve: true,
            removeComments: false,
        })

        program.emit()
        fs.unlinkSync(joinedFileName)
    }
}
