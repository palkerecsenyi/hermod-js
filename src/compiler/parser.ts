import { file } from './files'
import YAML from 'yaml'
import * as fs from 'fs'
import path from 'path'
import { Unit } from '../encoder/encoder';

export interface Service {

}

export interface Config {
    fileName: string // only defined during compilation
    package: string
    units: Unit[]
    services: Service[]
}

export default function parseYamlFile(fileRef: file): Config {
    const f = fs.readFileSync(path.join(fileRef.path, fileRef.name), 'utf-8')
    const parsed = YAML.parse(f)

    if (parsed?.package == null) {
        throw new Error(`file ${fileRef.name} doesn't specify package`)
    }

    parsed.fileName = fileRef.name
    return parsed
}
