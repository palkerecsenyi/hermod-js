import { Writer } from './output';
import { Config } from './parser';
import { Unit } from '../encoder/encoder';
import camelcase from 'camelcase';
import { resolveTypeName } from './types';

export default function writeUnit(w: Writer, unit: Unit, fileName: string, configs: Config[]) {
    const unitName = camelcase(unit.name)
    const exportedUnitName = camelcase(unitName, {pascalCase: true})
    w.importModule("src/encoder/user", false, "UserFacingHermodUnit")

    w.writeln(`export interface ${exportedUnitName} extends UserFacingHermodUnit {`)
    for (const field of unit.fields) {
        const typeName = resolveTypeName(w, field.type as string, fileName, configs, true)
        w.writelni(1, `${camelcase(field.name)}?: ${typeName}${field.repeated ? '[]' : ''},`)
    }
    w.writeln('}')

    w.writeln(`export function new${exportedUnitName}(): ${exportedUnitName} {`)
    w.importModule("src/encoder/user", false, "initUFHU")
    w.writelni(1, `return initUFHU<${exportedUnitName}>({`)
    w.writelni(2, `name: '${unit.name}',`)
    w.writelni(2, `id: ${unit.id},`)
    w.writelni(2, 'fields: [')
    for (const field of unit.fields) {
        const typeName = resolveTypeName(w, field.type as string, fileName, configs)
        w.writelni(3, '{')
        w.writelni(4, `name: '${field.name}',`)
        w.writelni(4, `id: ${field.id},`)
        w.writelni(4, `type: ${typeName},`)
        w.writelni(4, `extended: ${field.extended ? 'true' : 'false'},`)
        w.writelni(4, `repeated: ${field.repeated ? 'true': 'false'},`)
        w.writelni(3, '},')
    }
    w.writelni(2, '],')
    w.writelni(1, '})')
    w.writeln('}')

    w.importStar("src/encoder/uint8list", false, "Uint8List")
    w.writeln(`export function decode${exportedUnitName}(data: Uint8List.default): ${exportedUnitName} {`)
    w.writelni(1, `return new${exportedUnitName}()._decode(data)`)
    w.writeln('}')
}
