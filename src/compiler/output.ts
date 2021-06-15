import { file } from "./files"
import { Config } from './parser'
import writeUnit from './unit';
import * as fs from 'fs';
import path from 'path';

export interface Writer {
    _lines: string[]
    _imports: {
        [key: string]: string[]
    }
    writeln(text: string): void
    writelni(i: number, text: string): void
    importStar(from: string, relative: boolean, as: string): void
    importModule(from: string, relative: boolean, ...module: string[]): void
}

export function writeFileOutput(outDir: string, fileRef: file, config: Config, configs: Config[], importBase: string) {
    const w: Writer = {
        _lines: [],
        _imports: {},
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
        importStar(from: string, relative: boolean, as: string) {
            if (!relative) {
                from = importBase + from
            }
            this._imports[from] = ['*', as]
        },
        importModule(from: string, relative: boolean, ...module: string[]) {
            if (!relative) {
                from = importBase + from
            }

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
        }
    }

    w.writeln(`// GENERATED CODE — DO NOT MODIFY`)
    w.writeln(`// Package: ${config.package}\n`)

    for (const unit of config.units) {
        writeUnit(w, unit, fileRef.name.replace('.hermod.yaml', ''), configs)
    }

    let text = ''
    for (let from of Object.keys(w._imports)) {
        const what = w._imports[from]
        if (what.length === 0) continue
        if (what[0] === '*') {
            text += `import * as ${what[1]} from '${from}'`
        } else {
            text += `import {${what.join(', ')}} from '${from}'`
        }

        text += '\n'
    }

    text += w._lines.join('\n')
    fs.writeFileSync(path.join(outDir, fileRef.name.replace('hermod.yaml', 'ts')), text)
}
