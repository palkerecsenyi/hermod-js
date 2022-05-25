import { FieldType, Unit } from '../encoder/encoder';
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

export function resolveTypeName(
    w: Writer,
    type: string | undefined,
    currentFileName: string,
    configs: Config[],
    native = false,
    onlyUnits = false,
): string {
    type = type ?? FieldType.String
    if (Object.values(FieldType).includes(type as FieldType) && !onlyUnits) {
        if (native) {
            return hermodTypeToTsType(type as FieldType)
        } else {
            w.importHermod("FieldType")
            return `'${type}' as FieldType`
        }
    } else {
        const unitName = camelcase(type, {pascalCase: true})

        const [,unitFileName] = resolveUnitDefinition(unitName, configs)

        if (unitFileName === null) {
            throw new Error(`couldn't find type ${type}`)
        }

        if (!native) {
            return `new${unitName}()`;
        }

        if (currentFileName !== unitFileName) {
            w.importModuleRelative(`./${unitFileName}`, unitName)
            w.importModuleRelative(`./${unitFileName}`, `new${unitName}`)
        }

        return unitName
    }
}

export function resolveUnitDefinition(
    unitName: string,
    configs: Config[]
): [Unit | undefined, string | undefined] {
    for (const config of configs) {
        if (!config.units) {
            continue
        }

        const matchingUnit = config.units.find(e => camelcase(e.name, {pascalCase: true}) === unitName)
        if (matchingUnit) {
            return [matchingUnit, config.fileName.replace('.hermod.yaml', '.hermod')]
        }
    }

    return [undefined, undefined]
}
