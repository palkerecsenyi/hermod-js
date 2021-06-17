
// Similar to a Uint8Array but with no fixed size. Stores 8-bit unsigned numbers in a standard JS array (with some
// helper functions)
export default class Uint8List {
    private readonly _contents: number[]
    constructor() {
        this._contents = []
        this._readIndex = 0
    }

    static fromArrayBuffer(ab: ArrayBuffer): Uint8List {
        const uint8 = new Uint8Array(ab)
        const list = new Uint8List()
        list._contents.push(...uint8)
        return list
    }

    static fromString(str: string): Uint8List {
        const list = new Uint8List()
        list.pushString(str)
        return list
    }

    get uint8Array(): Uint8Array {
        return new Uint8Array(this._contents)
    }

    // returns the size in bytes
    get size(): number {
        return this._contents.length
    }

    get isEmpty(): boolean {
        return this.size === 0
    }

    merge(l: Uint8List) {
        this._contents.push(...l._contents)
    }

    mergeWithSizeMarker(l: Uint8List, extended: boolean) {
        const lSize = l.size
        if (extended) {
            if (lSize > Math.pow(2, 64) - 1) throw new Error("value over size limit")
            this.push64(lSize)
        } else {
            if (lSize > Math.pow(2, 32) - 1) throw new Error("value over size limit")
            this.push32(lSize)
        }
        this.merge(l)
    }

    push8(n: number) {
        if (n > 0xff || n < 0) {
            throw new Error("not a valid uint8")
        }
        this._contents.push(n)
    }

    private pushN(n: 16 | 32 | 64, value: number) {
        if (value < 0 || value > (Math.pow(2, 16) - 1)) {
            throw new Error("value out of range")
        }

        const buffer = new ArrayBuffer(n / 8)
        const dv = new DataView(buffer)
        switch (n) {
            case 16: dv.setUint16(0, value); break
            case 32: dv.setUint32(0, value); break
            case 64: dv.setBigUint64(0, BigInt(value)); break
        }

        this._contents.push(...(new Uint8Array(buffer)))
    }

    push16(n: number) {
        this.pushN(16, n)
    }
    push32(n: number) {
        this.pushN(32, n)
    }
    push64(n: number) {
        this.pushN(64, n)
    }

    pushString(s: string) {
        const encoder = new TextEncoder()
        const u = encoder.encode(s)
        this._contents.push(...u)
    }

    private _readIndex: number
    get readComplete() {
        return this._readIndex >= this._contents.length - 1
    }

    private readN(n: 16 | 32 | 64): number {
        const slice = this._contents.slice(this._readIndex, this._readIndex + (n / 8))
        const b = new DataView(new Uint8Array(slice).buffer)
        let v: number
        switch (n) {
            case 16: v = b.getUint16(0); break
            case 32: v = b.getUint32(0); break
            case 64: v = Number(b.getBigUint64(0)); break
        }
        this._readIndex += n / 8
        return v
    }
    read8(): number {
        const v = this._contents[this._readIndex]
        this._readIndex++
        return v
    }
    read16() {
        return this.readN(16)
    }
    read32() {
        return this.readN(32)
    }
    read64() {
        return this.readN(64)
    }

    readSize(extended: boolean): number {
        if (extended) {
            return this.read64()
        } else {
            return this.read32()
        }
    }

    // gets a slice of the Uint8List from _readIndex to _readIndex + n + 1
    slice(n: number): Uint8List {
        const v = this._contents.slice(this._readIndex, this._readIndex + n)
        this._readIndex += n

        const newList = new Uint8List()
        newList._contents.push(...v)
        return newList
    }

    toString(): string {
        const decoder = new TextDecoder()
        return decoder.decode(this.uint8Array.buffer)
    }
}
