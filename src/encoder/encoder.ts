import Uint8List from './uint8list.js';
import { decodeValue, encodeValue } from './values.js';
import { UserFacingHermodUnit } from './user.js';

export enum FieldType {
    String = 'string',
    Boolean = 'boolean',
    TinyInteger = 'tinyinteger',
    SmallInteger = 'smallinteger',
    Integer = 'integer',
    BigInteger = 'biginteger',
    TinySignedInteger = 'tinysignedinteger',
    SmallSignedInteger = 'smallsignedinteger',
    SignedInteger = 'signedinteger',
    BigSignedInteger = 'bigsignedinteger',
}

export type TypeIdentifier = FieldType | (() => UserFacingHermodUnit)

export interface Field {
    id: number
    name: string
    type: TypeIdentifier
    extended?: boolean
    repeated?: boolean
}

export interface Unit {
    name: string
    id: number
    fields: Field[]
}

export interface FilledUnit extends Unit {
    values: Record<number, any>
}

export function encode(unit: FilledUnit): Uint8List {
    const u = new Uint8List()
    u.push16(unit.id)

    for (const fieldIdKey of Object.keys(unit.values)) {
        const fieldId = parseInt(fieldIdKey)
        if (isNaN(fieldId)) {
            throw new Error("got NaN field key")
        }

        const field = unit.fields.find(e => e.id === fieldId)
        if (field == null) {
            throw new Error("unrecognised field id")
        }

        u.push16(fieldId)

        const value = unit.values[fieldId]
        const encodedValue = encodeValue(field, value)
        u.mergeWithSizeMarker(encodedValue, field.extended === true)
    }

    return u
}

export function decode(unit: Unit, data: Uint8List): FilledUnit {
    const unitId = data.read16()
    if (unitId !== unit.id) {
        throw new Error("data is a different unit to the one passed")
    }

    const values: Record<number, any> = {}
    let done = false
    while (!done) {
        const fieldId = data.read16()
        const field = unit.fields.find(e => e.id === fieldId)
        if (!field) {
            throw new Error(`unrecognised field ID ${fieldId}`)
        }

        const length = data.readSize(field.extended === true)
        const contents = data.slice(length)
        values[fieldId] = decodeValue(field, contents)

        done = data.readComplete
    }

    return {
        ...unit,
        values,
    }
}
