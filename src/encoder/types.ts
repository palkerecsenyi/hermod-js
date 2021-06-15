import { FieldType, TypeIdentifier } from './encoder';
import { UserFacingHermodUnit } from './user';
import Uint8List from './uint8list';

export function getDefaultValueForType(type?: TypeIdentifier): any {
    switch (type) {
        case FieldType.String:
            return ""
        case FieldType.Boolean:
            return false
    }

    if (isNumeric(type)) {
        return 0
    }

    return {
        __HERMOD: true,
        encode(): Uint8List {
            return new Uint8List()
        },
        _decode(_: Uint8List): UserFacingHermodUnit {
            return this
        }
    } as UserFacingHermodUnit
}

export function isNumeric(type?: TypeIdentifier): boolean {
    switch (type) {
        case FieldType.TinyInteger:
        case FieldType.SmallInteger:
        case FieldType.Integer:
        case FieldType.BigInteger:
        case FieldType.TinySignedInteger:
        case FieldType.SmallSignedInteger:
        case FieldType.SignedInteger:
        case FieldType.BigSignedInteger:
            return true
        default:
            return false
    }
}
