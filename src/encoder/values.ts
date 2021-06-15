import { Field, FieldType } from './encoder';
import Uint8List from './uint8list';
import { UserFacingHermodUnit } from './user';

function isOtherUnit(v: any): v is UserFacingHermodUnit {
    return v.__HERMOD
}

export function encodeValue(field: Field, value: any): Uint8List {
    const u = new Uint8List()

    if (field.repeated) {
        for (const v of value) {
            u.mergeWithSizeMarker(encodeValue({
                ...field,
                repeated: false,
            }, v), false)
        }
        return u
    }

    switch (field.type) {
        case FieldType.String:
            u.pushString(value)
            return u
        case FieldType.Boolean:
            if (value) {
                u.push8(0xff)
            } else {
                u.push8(0x00)
            }
            return u
        case FieldType.TinyInteger:
            u.push8(value)
            return u
        case FieldType.SmallInteger:
            u.push16(value)
            return u
        case FieldType.Integer:
            u.push32(value)
            return u
        case FieldType.BigInteger:
            u.push64(value)
            return u
    }

    if (u.isEmpty) {
        if (isOtherUnit(value)) {
            return value.encode()
        } else {
            throw new Error("unrecognised type")
        }
    }

    return u
}

export function decodeValue(field: Field, data: Uint8List): any {
    if (field.repeated) {
        let done = false
        const array: any[] = []
        while (!done) {
            const length = data.readSize(false)
            const contents = data.slice(length)
            array.push(decodeValue({
                ...field,
                repeated: false,
            }, contents))
            done = data.readComplete
        }
        return array
    }

    switch (field.type) {
        case FieldType.String:
            return data.toString()
        case FieldType.Boolean:
            return data.read8() === 0xff
        case FieldType.TinyInteger:
            return data.read8()
        case FieldType.SmallInteger:
            return data.read16()
        case FieldType.Integer:
            return data.read32()
        case FieldType.BigInteger:
            return data.read64()
    }

    if (isOtherUnit(field.type)) {
        return field.type._decode(data)
    } else {
        throw new Error(`couldn't find a matching type for field ${field.name}`)
    }
}
