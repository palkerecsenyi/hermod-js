import { Writer } from './output';
import { Config } from './parser';
import { Unit } from '../encoder/encoder';
import camelcase from 'camelcase';
import { resolveTypeName } from './types';

export function writeUnitDefinition(w: Writer, unit: Unit, fileName: string, configs: Config[]) {
    w.write('{')
    w.writelni(1, `name: '${unit.name}',`)
    w.writelni(1, `id: ${unit.id},`)
    w.writelni(1, 'fields: [')
    for (const field of unit.fields) {
        const typeName = resolveTypeName(w, field.type as string, fileName, configs)
        w.writelni(2, '{')
        w.writelni(3, `name: '${field.name}',`)
        w.writelni(3, `id: ${field.id},`)
        w.writelni(3, `type: ${typeName},`)
        w.writelni(3, `extended: ${field.extended ? 'true' : 'false'},`)
        w.writelni(3, `repeated: ${field.repeated ? 'true': 'false'},`)
        w.writelni(2, '},')
    }
    w.writelni(1, '],')
    w.writeln('}')
}

export default function writeUnit(w: Writer, unit: Unit, fileName: string, configs: Config[]) {
    const unitName = camelcase(unit.name)
    const exportedUnitName = camelcase(unitName, {pascalCase: true})
    w.importModule("dist/encoder/user", false, "UserFacingHermodUnit")

    w.writeln(`export interface ${exportedUnitName} extends UserFacingHermodUnit {`)
    for (const field of unit.fields) {
        const typeName = resolveTypeName(w, field.type as string, fileName, configs, true)
        w.writelni(1, `${camelcase(field.name)}?: ${typeName}${field.repeated ? '[]' : ''},`)
    }
    w.writeln('}')

    w.writeln(`export function new${exportedUnitName}(): ${exportedUnitName} {`)
    w.importModule("dist/encoder/user", false, "initUFHU")
    w.writelni(1, `return initUFHU<${exportedUnitName}>(`)
    writeUnitDefinition(w, unit, fileName, configs)
    w.write(')')
    w.writeln('}')

    w.importDefault("dist/encoder/uint8list", false, "Uint8List")
    w.writeln(`export function decode${exportedUnitName}(data: Uint8List): ${exportedUnitName} {`)
    w.writelni(1, `return new${exportedUnitName}()._decode(data)`)
    w.writeln('}')
}
