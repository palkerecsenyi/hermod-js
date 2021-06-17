import Uint8List from './uint8list';
import { decode, encode, FilledUnit, Unit } from './encoder';
import camelcase from 'camelcase';
import { getDefaultValueForType } from './types';

export interface UserFacingHermodUnit {
    __HERMOD: true
    encode(): Uint8List
    // defined within the interface to make decoding possible without having a list of all Units
    _decode(data: Uint8List): UserFacingHermodUnit
    [key: string]: any
}

function createFilledUnit(ufhu: UserFacingHermodUnit, definition: Unit): FilledUnit {
    const values: Record<number, any> = {}

    for (const field of definition.fields) {
        const key = Object.keys(ufhu).find(e => camelcase(e) === camelcase(field.name))
        if (key === undefined) {
            if (field.repeated) {
                values[field.id] = []
            } else {
                values[field.id] = getDefaultValueForType(field.type)
            }
        } else {
            values[field.id] = ufhu[key]
        }
    }

    return {
        ...definition,
        values,
    }
}

export function encodeUFHU(ufhu: UserFacingHermodUnit, definition: Unit): Uint8List {
    const filledUnit = createFilledUnit(ufhu, definition)
    return encode(filledUnit)
}

function buildUFHUFromFilledUnit(filledUnit: FilledUnit, definition: Unit): UserFacingHermodUnit {
    const object: Record<string, any> = {}
    for (const key of Object.keys(filledUnit.values)) {
        const field = filledUnit.fields.find(e => e.id === parseInt(key))
        if (!field) {
            throw new Error(`field ${key} couldn't be found in unit definition`)
        }
        object[field.name] = filledUnit.values[parseInt(key)]
    }

    return {
        ...object,
        ...initUFHU(definition),
    }
}

export function decodeUFHU(data: Uint8List, definition: Unit): UserFacingHermodUnit {
    const decodedData = decode(definition, data)
    return buildUFHUFromFilledUnit(decodedData, definition)
}

export function initUFHU<T extends UserFacingHermodUnit>(definition: Unit): T {
    if (!definition) {
        throw new Error('cannot init UserFacingHermodUnit without a Unit definition')
    }
    return {
        __HERMOD: true,
        encode() {
            return encodeUFHU(this, definition)
        },
        _decode(data: Uint8List) {
            return decodeUFHU(data, definition)
        }
    } as T
}
