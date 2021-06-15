import { FieldType } from '../encoder/encoder';
import { Config } from './parser';
import { Writer } from './output';
import camelcase from 'camelcase';
import { isNumeric } from '../encoder/types';

export function hermodTypeToTsType(t: FieldType): string {
    switch (t) {
        case FieldType.String:
            return 'string'
        case FieldType.Boolean:
            return 'boolean'
    }

    if (isNumeric(t)) {
        return 'number'
    }

    throw new Error(`cannot find TS type for Hermod type ${t}`)
}

export function resolveTypeName(w: Writer, type: string | undefined, currentFileName: string, configs: Config[], native = false): string {
    type = type ?? FieldType.String
    if (Object.values(FieldType).includes(type as FieldType)) {
        if (native) {
            return hermodTypeToTsType(type as FieldType)
        } else {
            w.importModule("src/encoder/encoder", false, "FieldType")
            return `'${type}' as FieldType`
        }
    } else {
        const unitName = camelcase(type, {pascalCase: true})
        let unitFileName: string | null = null

        for (const config of configs) {
            const matchingUnit = config.units.find(e => camelcase(e.name, {pascalCase: true}) === unitName)
            if (matchingUnit != null) {
                unitFileName = config.fileName.replace('.hermod.yaml', '')
                break
            }
        }

        if (unitFileName === null) {
            throw new Error(`couldn't find type ${type}`)
        }

        if (!native) {
            return `new${unitName}()`;
        }

        if (currentFileName !== unitFileName) {
            w.importModule(`./${unitFileName}`, true, unitName)
        }

        return unitName
    }
}
