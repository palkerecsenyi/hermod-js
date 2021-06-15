import * as fs from 'fs'
import path from 'path'
import parseYamlFile from './parser'
import { writeFileOutput } from './output';

export interface file {
    path: string
    name: string
}

function getYamlFilesInDirectory(dir: string): file[] {
    const files: file[] = []
    const directory = fs.readdirSync(dir)

    for (const file of directory) {
        const completePath = path.join(dir, file)
        const stat = fs.lstatSync(completePath)
        if (stat.isDirectory()) {
            files.push(...getYamlFilesInDirectory(completePath))
            continue
        }

        if (file.endsWith('.hermod.yaml')) {
            files.push({
                path: dir,
                name: file,
            })
        }
    }

    return files
}

export default function compileFiles(inDir: string, outDir: string, importBase: string) {
    if (inDir == null || outDir == null) {
        console.error("No inDir/outDir provided!")
        process.exit(1)
    }

    const files = getYamlFilesInDirectory(inDir)
    const configs = files.map(f => {
        return {
            file: f,
            config: parseYamlFile(f),
        }
    })

    for (const configPair of configs) {
        writeFileOutput(outDir, configPair.file, configPair.config, configs.map(e => e.config), importBase)
    }
}
