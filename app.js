var BSON = (function (exports) {

'use strict';



function isAnyArrayBuffer(value) {

    return ['[object ArrayBuffer]', '[object SharedArrayBuffer]'].includes(Object.prototype.toString.call(value));

}

function isUint8Array(value) {

    return Object.prototype.toString.call(value) === '[object Uint8Array]';

}

function isRegExp(d) {

    return Object.prototype.toString.call(d) === '[object RegExp]';

}

function isMap(d) {

    return Object.prototype.toString.call(d) === '[object Map]';

}

function isDate(d) {

    return Object.prototype.toString.call(d) === '[object Date]';

}



const BSON_MAJOR_VERSION = 5;

const BSON_INT32_MAX = 0x7fffffff;

const BSON_INT32_MIN = -0x80000000;

const BSON_INT64_MAX = Math.pow(2, 63) - 1;

const BSON_INT64_MIN = -Math.pow(2, 63);

const JS_INT_MAX = Math.pow(2, 53);

const JS_INT_MIN = -Math.pow(2, 53);

const BSON_DATA_NUMBER = 1;

const BSON_DATA_STRING = 2;

const BSON_DATA_OBJECT = 3;

const BSON_DATA_ARRAY = 4;

const BSON_DATA_BINARY = 5;

const BSON_DATA_UNDEFINED = 6;

const BSON_DATA_OID = 7;

const BSON_DATA_BOOLEAN = 8;

const BSON_DATA_DATE = 9;

const BSON_DATA_NULL = 10;

const BSON_DATA_REGEXP = 11;

const BSON_DATA_DBPOINTER = 12;

const BSON_DATA_CODE = 13;

const BSON_DATA_SYMBOL = 14;

const BSON_DATA_CODE_W_SCOPE = 15;

const BSON_DATA_INT = 16;

const BSON_DATA_TIMESTAMP = 17;

const BSON_DATA_LONG = 18;

const BSON_DATA_DECIMAL128 = 19;

const BSON_DATA_MIN_KEY = 0xff;

const BSON_DATA_MAX_KEY = 0x7f;

const BSON_BINARY_SUBTYPE_DEFAULT = 0;

const BSON_BINARY_SUBTYPE_UUID_NEW = 4;

const BSONType = Object.freeze({

    double: 1,

    string: 2,

    object: 3,

    array: 4,

    binData: 5,

    undefined: 6,

    objectId: 7,

    bool: 8,

    date: 9,

    null: 10,

    regex: 11,

    dbPointer: 12,

    javascript: 13,

    symbol: 14,

    javascriptWithScope: 15,

    int: 16,

    timestamp: 17,

    long: 18,

    decimal: 19,

    minKey: -1,

    maxKey: 127

});



class BSONError extends Error {

    get bsonError() {

        return true;

    }

    get name() {

        return 'BSONError';

    }

    constructor(message) {

        super(message);

    }

    static isBSONError(value) {

        return (value != null &&

            typeof value === 'object' &&

            'bsonError' in value &&

            value.bsonError === true &&

            'name' in value &&

            'message' in value &&

            'stack' in value);

    }

}

class BSONVersionError extends BSONError {

    get name() {

        return 'BSONVersionError';

    }

    constructor() {

        super(`Unsupported BSON version, bson types must be from bson ${BSON_MAJOR_VERSION}.0 or later`);

    }

}

class BSONRuntimeError extends BSONError {

    get name() {

        return 'BSONRuntimeError';

    }

    constructor(message) {

        super(message);

    }

}



function nodejsMathRandomBytes(byteLength) {

    return nodeJsByteUtils.fromNumberArray(Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256)));

}

const nodejsRandomBytes = (() => {

    try {

        return require('crypto').randomBytes;

    }

    catch {

        return nodejsMathRandomBytes;

    }

})();

const nodeJsByteUtils = {

    toLocalBufferType(potentialBuffer) {

        if (Buffer.isBuffer(potentialBuffer)) {

            return potentialBuffer;

        }

        if (ArrayBuffer.isView(potentialBuffer)) {

            return Buffer.from(potentialBuffer.buffer, potentialBuffer.byteOffset, potentialBuffer.byteLength);

        }

        const stringTag = potentialBuffer?.[Symbol.toStringTag] ?? Object.prototype.toString.call(potentialBuffer);

        if (stringTag === 'ArrayBuffer' ||

            stringTag === 'SharedArrayBuffer' ||

            stringTag === '[object ArrayBuffer]' ||

            stringTag === '[object SharedArrayBuffer]') {

            return Buffer.from(potentialBuffer);

        }

        throw new BSONError(`Cannot create Buffer from ${String(potentialBuffer)}`);

    },

    allocate(size) {

        return Buffer.alloc(size);

    },

    equals(a, b) {

        return nodeJsByteUtils.toLocalBufferType(a).equals(b);

    },

    fromNumberArray(array) {

        return Buffer.from(array);

    },

    fromBase64(base64) {

        return Buffer.from(base64, 'base64');

    },

    toBase64(buffer) {

        return nodeJsByteUtils.toLocalBufferType(buffer).toString('base64');

    },

    fromISO88591(codePoints) {

        return Buffer.from(codePoints, 'binary');

    },

    toISO88591(buffer) {

        return nodeJsByteUtils.toLocalBufferType(buffer).toString('binary');

    },

    fromHex(hex) {

        return Buffer.from(hex, 'hex');

    },

    toHex(buffer) {

        return nodeJsByteUtils.toLocalBufferType(buffer).toString('hex');

    },

    fromUTF8(text) {

        return Buffer.from(text, 'utf8');

    },

    toUTF8(buffer, start, end) {

        return nodeJsByteUtils.toLocalBufferType(buffer).toString('utf8', start, end);

    },

    utf8ByteLength(input) {

        return Buffer.byteLength(input, 'utf8');

    },

    encodeUTF8Into(buffer, source, byteOffset) {

        return nodeJsByteUtils.toLocalBufferType(buffer).write(source, byteOffset, undefined, 'utf8');

    },

    randomBytes: nodejsRandomBytes

};



function isReactNative() {

    const { navigator } = globalThis;

    return typeof navigator === 'object' && navigator.product === 'ReactNative';

}

function webMathRandomBytes(byteLength) {

    if (byteLength < 0) {

        throw new RangeError(`The argument 'byteLength' is invalid. Received ${byteLength}`);

    }

    return webByteUtils.fromNumberArray(Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256)));

}

const webRandomBytes = (() => {

    const { crypto } = globalThis;

    if (crypto != null && typeof crypto.getRandomValues === 'function') {

        return (byteLength) => {

            return crypto.getRandomValues(webByteUtils.allocate(byteLength));

        };

    }

    else {

        if (isReactNative()) {

            const { console } = globalThis;

            console?.warn?.('BSON: For React Native please polyfill crypto.getRandomValues, e.g. using: https://www.npmjs.com/package/react-native-get-random-values.');

        }

        return webMathRandomBytes;

    }

})();

const HEX_DIGIT = /(\d|[a-f])/i;

const webByteUtils = {

    toLocalBufferType(potentialUint8array) {

        const stringTag = potentialUint8array?.[Symbol.toStringTag] ??

            Object.prototype.toString.call(potentialUint8array);

        if (stringTag === 'Uint8Array') {

            return potentialUint8array;

        }

        if (ArrayBuffer.isView(potentialUint8array)) {

            return new Uint8Array(potentialUint8array.buffer.slice(potentialUint8array.byteOffset, potentialUint8array.byteOffset + potentialUint8array.byteLength));

        }

        if (stringTag === 'ArrayBuffer' ||

            stringTag === 'SharedArrayBuffer' ||

            stringTag === '[object ArrayBuffer]' ||

            stringTag === '[object SharedArrayBuffer]') {

            return new Uint8Array(potentialUint8array);

        }

        throw new BSONError(`Cannot make a Uint8Array from ${String(potentialUint8array)}`);

    },

    allocate(size) {

        if (typeof size !== 'number') {

            throw new TypeError(`The "size" argument must be of type number. Received ${String(size)}`);

        }

        return new Uint8Array(size);

    },

    equals(a, b) {

        if (a.byteLength !== b.byteLength) {

            return false;

        }

        for (let i = 0; i < a.byteLength; i++) {

            if (a[i] !== b[i]) {

                return false;

            }

        }

        return true;

    },

    fromNumberArray(array) {

        return Uint8Array.from(array);

    },

    fromBase64(base64) {

        return Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    },

    toBase64(uint8array) {

        return btoa(webByteUtils.toISO88591(uint8array));

    },

    fromISO88591(codePoints) {

        return Uint8Array.from(codePoints, c => c.charCodeAt(0) & 0xff);

    },

    toISO88591(uint8array) {

        return Array.from(Uint16Array.from(uint8array), b => String.fromCharCode(b)).join('');

    },

    fromHex(hex) {

        const evenLengthHex = hex.length % 2 === 0 ? hex : hex.slice(0, hex.length - 1);

        const buffer = [];

        for (let i = 0; i < evenLengthHex.length; i += 2) {

            const firstDigit = evenLengthHex[i];

            const secondDigit = evenLengthHex[i + 1];

            if (!HEX_DIGIT.test(firstDigit)) {

                break;

            }

            if (!HEX_DIGIT.test(secondDigit)) {

                break;

            }

            const hexDigit = Number.parseInt(`${firstDigit}${secondDigit}`, 16);

            buffer.push(hexDigit);

        }

        return Uint8Array.from(buffer);

    },

    toHex(uint8array) {

        return Array.from(uint8array, byte => byte.toString(16).padStart(2, '0')).join('');

    },

    fromUTF8(text) {

        return new TextEncoder().encode(text);

    },

    toUTF8(uint8array, start, end) {

        return new TextDecoder('utf8', { fatal: false }).decode(uint8array.slice(start, end));

    },

    utf8ByteLength(input) {

        return webByteUtils.fromUTF8(input).byteLength;

    },

    encodeUTF8Into(buffer, source, byteOffset) {

        const bytes = webByteUtils.fromUTF8(source);

        buffer.set(bytes, byteOffset);

        return bytes.byteLength;

    },

    randomBytes: webRandomBytes

};



const hasGlobalBuffer = typeof Buffer === 'function' && Buffer.prototype?._isBuffer !== true;

const ByteUtils = hasGlobalBuffer ? nodeJsByteUtils : webByteUtils;

class BSONDataView extends DataView {

    static fromUint8Array(input) {

        return new DataView(input.buffer, input.byteOffset, input.byteLength);

    }

}



class BSONValue {

    get [Symbol.for('@@mdb.bson.version')]() {

        return BSON_MAJOR_VERSION;

    }

}



class Binary extends BSONValue {

    get _bsontype() {

        return 'Binary';

    }

    constructor(buffer, subType) {

        super();

        if (!(buffer == null) &&

            !(typeof buffer === 'string') &&

            !ArrayBuffer.isView(buffer) &&

            !(buffer instanceof ArrayBuffer) &&

            !Array.isArray(buffer)) {

            throw new BSONError('Binary can only be constructed from string, Buffer, TypedArray, or Array<number>');

        }

        this.sub_type = subType ?? Binary.BSON_BINARY_SUBTYPE_DEFAULT;

        if (buffer == null) {

            this.buffer = ByteUtils.allocate(Binary.BUFFER_SIZE);

            this.position = 0;

        }

        else {

            if (typeof buffer === 'string') {

                this.buffer = ByteUtils.fromISO88591(buffer);

            }

            else if (Array.isArray(buffer)) {

                this.buffer = ByteUtils.fromNumberArray(buffer);

            }

            else {

                this.buffer = ByteUtils.toLocalBufferType(buffer);

            }

            this.position = this.buffer.byteLength;

        }

    }

    put(byteValue) {

        if (typeof byteValue === 'string' && byteValue.length !== 1) {

            throw new BSONError('only accepts single character String');

        }

        else if (typeof byteValue !== 'number' && byteValue.length !== 1)

            throw new BSONError('only accepts single character Uint8Array or Array');

        let decodedByte;

        if (typeof byteValue === 'string') {

            decodedByte = byteValue.charCodeAt(0);

        }

        else if (typeof byteValue === 'number') {

            decodedByte = byteValue;

        }

        else {

            decodedByte = byteValue[0];

        }

        if (decodedByte < 0 || decodedByte > 255) {

            throw new BSONError('only accepts number in a valid unsigned byte range 0-255');

        }

        if (this.buffer.byteLength > this.position) {

            this.buffer[this.position++] = decodedByte;

        }

        else {

            const newSpace = ByteUtils.allocate(Binary.BUFFER_SIZE + this.buffer.length);

            newSpace.set(this.buffer, 0);

            this.buffer = newSpace;

            this.buffer[this.position++] = decodedByte;

        }

    }

    write(sequence, offset) {

        offset = typeof offset === 'number' ? offset : this.position;

        if (this.buffer.byteLength < offset + sequence.length) {

            const newSpace = ByteUtils.allocate(this.buffer.byteLength + sequence.length);

            newSpace.set(this.buffer, 0);

            this.buffer = newSpace;

        }

        if (ArrayBuffer.isView(sequence)) {

            this.buffer.set(ByteUtils.toLocalBufferType(sequence), offset);

            this.position =

                offset + sequence.byteLength > this.position ? offset + sequence.length : this.position;

        }

        else if (typeof sequence === 'string') {

            const bytes = ByteUtils.fromISO88591(sequence);

            this.buffer.set(bytes, offset);

            this.position =

                offset + sequence.length > this.position ? offset + sequence.length : this.position;

        }

    }

    read(position, length) {

        length = length && length > 0 ? length : this.position;

        return this.buffer.slice(position, position + length);

    }

    value(asRaw) {

        asRaw = !!asRaw;

        if (asRaw && this.buffer.length === this.position) {

            return this.buffer;

        }

        if (asRaw) {

            return this.buffer.slice(0, this.position);

        }

        return ByteUtils.toISO88591(this.buffer.subarray(0, this.position));

    }

    length() {

        return this.position;

    }

    toJSON() {

        return ByteUtils.toBase64(this.buffer);

    }

    toString(encoding) {

        if (encoding === 'hex')

            return ByteUtils.toHex(this.buffer);

        if (encoding === 'base64')

            return ByteUtils.toBase64(this.buffer);

        if (encoding === 'utf8' || encoding === 'utf-8')

            return ByteUtils.toUTF8(this.buffer, 0, this.buffer.byteLength);

        return ByteUtils.toUTF8(this.buffer, 0, this.buffer.byteLength);

    }

    toExtendedJSON(options) {

        options = options || {};

        const base64String = ByteUtils.toBase64(this.buffer);

        const subType = Number(this.sub_type).toString(16);

        if (options.legacy) {

            return {

                $binary: base64String,

                $type: subType.length === 1 ? '0' + subType : subType

            };

        }

        return {

            $binary: {

                base64: base64String,

                subType: subType.length === 1 ? '0' + subType : subType

            }

        };

    }

    toUUID() {

        if (this.sub_type === Binary.SUBTYPE_UUID) {

            return new UUID(this.buffer.slice(0, this.position));

        }

        throw new BSONError(`Binary sub_type "${this.sub_type}" is not supported for converting to UUID. Only "${Binary.SUBTYPE_UUID}" is currently supported.`);

    }

    static createFromHexString(hex, subType) {

        return new Binary(ByteUtils.fromHex(hex), subType);

    }

    static createFromBase64(base64, subType) {

        return new Binary(ByteUtils.fromBase64(base64), subType);

    }

    static fromExtendedJSON(doc, options) {

        options = options || {};

        let data;

        let type;

        if ('$binary' in doc) {

            if (options.legacy && typeof doc.$binary === 'string' && '$type' in doc) {

                type = doc.$type ? parseInt(doc.$type, 16) : 0;

                data = ByteUtils.fromBase64(doc.$binary);

            }

            else {

                if (typeof doc.$binary !== 'string') {

                    type = doc.$binary.subType ? parseInt(doc.$binary.subType, 16) : 0;

                    data = ByteUtils.fromBase64(doc.$binary.base64);

                }

            }

        }

        else if ('$uuid' in doc) {

            type = 4;

            data = UUID.bytesFromString(doc.$uuid);

        }

        if (!data) {

            throw new BSONError(`Unexpected Binary Extended JSON format ${JSON.stringify(doc)}`);

        }

        return type === BSON_BINARY_SUBTYPE_UUID_NEW ? new UUID(data) : new Binary(data, type);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        const base64 = ByteUtils.toBase64(this.buffer.subarray(0, this.position));

        return `Binary.createFromBase64("${base64}", ${this.sub_type})`;

    }

}

Binary.BSON_BINARY_SUBTYPE_DEFAULT = 0;

Binary.BUFFER_SIZE = 256;

Binary.SUBTYPE_DEFAULT = 0;

Binary.SUBTYPE_FUNCTION = 1;

Binary.SUBTYPE_BYTE_ARRAY = 2;

Binary.SUBTYPE_UUID_OLD = 3;

Binary.SUBTYPE_UUID = 4;

Binary.SUBTYPE_MD5 = 5;

Binary.SUBTYPE_ENCRYPTED = 6;

Binary.SUBTYPE_COLUMN = 7;

Binary.SUBTYPE_USER_DEFINED = 128;

const UUID_BYTE_LENGTH = 16;

const UUID_WITHOUT_DASHES = /^[0-9A-F]{32}$/i;

const UUID_WITH_DASHES = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

class UUID extends Binary {

    constructor(input) {

        let bytes;

        if (input == null) {

            bytes = UUID.generate();

        }

        else if (input instanceof UUID) {

            bytes = ByteUtils.toLocalBufferType(new Uint8Array(input.buffer));

        }

        else if (ArrayBuffer.isView(input) && input.byteLength === UUID_BYTE_LENGTH) {

            bytes = ByteUtils.toLocalBufferType(input);

        }

        else if (typeof input === 'string') {

            bytes = UUID.bytesFromString(input);

        }

        else {

            throw new BSONError('Argument passed in UUID constructor must be a UUID, a 16 byte Buffer or a 32/36 character hex string (dashes excluded/included, format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');

        }

        super(bytes, BSON_BINARY_SUBTYPE_UUID_NEW);

    }

    get id() {

        return this.buffer;

    }

    set id(value) {

        this.buffer = value;

    }

    toHexString(includeDashes = true) {

        if (includeDashes) {

            return [

                ByteUtils.toHex(this.buffer.subarray(0, 4)),

                ByteUtils.toHex(this.buffer.subarray(4, 6)),

                ByteUtils.toHex(this.buffer.subarray(6, 8)),

                ByteUtils.toHex(this.buffer.subarray(8, 10)),

                ByteUtils.toHex(this.buffer.subarray(10, 16))

            ].join('-');

        }

        return ByteUtils.toHex(this.buffer);

    }

    toString(encoding) {

        if (encoding === 'hex')

            return ByteUtils.toHex(this.id);

        if (encoding === 'base64')

            return ByteUtils.toBase64(this.id);

        return this.toHexString();

    }

    toJSON() {

        return this.toHexString();

    }

    equals(otherId) {

        if (!otherId) {

            return false;

        }

        if (otherId instanceof UUID) {

            return ByteUtils.equals(otherId.id, this.id);

        }

        try {

            return ByteUtils.equals(new UUID(otherId).id, this.id);

        }

        catch {

            return false;

        }

    }

    toBinary() {

        return new Binary(this.id, Binary.SUBTYPE_UUID);

    }

    static generate() {

        const bytes = ByteUtils.randomBytes(UUID_BYTE_LENGTH);

        bytes[6] = (bytes[6] & 0x0f) | 0x40;

        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        return bytes;

    }

    static isValid(input) {

        if (!input) {

            return false;

        }

        if (typeof input === 'string') {

            return UUID.isValidUUIDString(input);

        }

        if (isUint8Array(input)) {

            return input.byteLength === UUID_BYTE_LENGTH;

        }

        return (input._bsontype === 'Binary' &&

            input.sub_type === this.SUBTYPE_UUID &&

            input.buffer.byteLength === 16);

    }

    static createFromHexString(hexString) {

        const buffer = UUID.bytesFromString(hexString);

        return new UUID(buffer);

    }

    static createFromBase64(base64) {

        return new UUID(ByteUtils.fromBase64(base64));

    }

    static bytesFromString(representation) {

        if (!UUID.isValidUUIDString(representation)) {

            throw new BSONError('UUID string representation must be 32 hex digits or canonical hyphenated representation');

        }

        return ByteUtils.fromHex(representation.replace(/-/g, ''));

    }

    static isValidUUIDString(representation) {

        return UUID_WITHOUT_DASHES.test(representation) || UUID_WITH_DASHES.test(representation);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new UUID("${this.toHexString()}")`;

    }

}

UUID.cacheHexString = false;



class Code extends BSONValue {

    get _bsontype() {

        return 'Code';

    }

    constructor(code, scope) {

        super();

        this.code = code.toString();

        this.scope = scope ?? null;

    }

    toJSON() {

        if (this.scope != null) {

            return { code: this.code, scope: this.scope };

        }

        return { code: this.code };

    }

    toExtendedJSON() {

        if (this.scope) {

            return { $code: this.code, $scope: this.scope };

        }

        return { $code: this.code };

    }

    static fromExtendedJSON(doc) {

        return new Code(doc.$code, doc.$scope);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        const codeJson = this.toJSON();

        return `new Code("${String(codeJson.code)}"${codeJson.scope != null ? `, ${JSON.stringify(codeJson.scope)}` : ''})`;

    }

}



function isDBRefLike(value) {

    return (value != null &&

        typeof value === 'object' &&

        '$id' in value &&

        value.$id != null &&

        '$ref' in value &&

        typeof value.$ref === 'string' &&

        (!('$db' in value) || ('$db' in value && typeof value.$db === 'string')));

}

class DBRef extends BSONValue {

    get _bsontype() {

        return 'DBRef';

    }

    constructor(collection, oid, db, fields) {

        super();

        const parts = collection.split('.');

        if (parts.length === 2) {

            db = parts.shift();

            collection = parts.shift();

        }

        this.collection = collection;

        this.oid = oid;

        this.db = db;

        this.fields = fields || {};

    }

    get namespace() {

        return this.collection;

    }

    set namespace(value) {

        this.collection = value;

    }

    toJSON() {

        const o = Object.assign({

            $ref: this.collection,

            $id: this.oid

        }, this.fields);

        if (this.db != null)

            o.$db = this.db;

        return o;

    }

    toExtendedJSON(options) {

        options = options || {};

        let o = {

            $ref: this.collection,

            $id: this.oid

        };

        if (options.legacy) {

            return o;

        }

        if (this.db)

            o.$db = this.db;

        o = Object.assign(o, this.fields);

        return o;

    }

    static fromExtendedJSON(doc) {

        const copy = Object.assign({}, doc);

        delete copy.$ref;

        delete copy.$id;

        delete copy.$db;

        return new DBRef(doc.$ref, doc.$id, doc.$db, copy);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        const oid = this.oid === undefined || this.oid.toString === undefined ? this.oid : this.oid.toString();

        return `new DBRef("${this.namespace}", new ObjectId("${String(oid)}")${this.db ? `, "${this.db}"` : ''})`;

    }

}



let wasm = undefined;

try {

    wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 2, 96, 0, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127, 3, 7, 6, 0, 1, 1, 1, 1, 1, 6, 6, 1, 127, 1, 65, 0, 11, 7, 50, 6, 3, 109, 117, 108, 0, 1, 5, 100, 105, 118, 95, 115, 0, 2, 5, 100, 105, 118, 95, 117, 0, 3, 5, 114, 101, 109, 95, 115, 0, 4, 5, 114, 101, 109, 95, 117, 0, 5, 8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0, 10, 191, 1, 6, 4, 0, 35, 0, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11])), {}).exports;

}

catch {

}

const TWO_PWR_16_DBL = 1 << 16;

const TWO_PWR_24_DBL = 1 << 24;

const TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;

const TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;

const TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;

const INT_CACHE = {};

const UINT_CACHE = {};

const MAX_INT64_STRING_LENGTH = 20;

const DECIMAL_REG_EX = /^(\+?0|(\+|-)?[1-9][0-9]*)$/;

class Long extends BSONValue {

    get _bsontype() {

        return 'Long';

    }

    get __isLong__() {

        return true;

    }

    constructor(low = 0, high, unsigned) {

        super();

        if (typeof low === 'bigint') {

            Object.assign(this, Long.fromBigInt(low, !!high));

        }

        else if (typeof low === 'string') {

            Object.assign(this, Long.fromString(low, !!high));

        }

        else {

            this.low = low | 0;

            this.high = high | 0;

            this.unsigned = !!unsigned;

        }

    }

    static fromBits(lowBits, highBits, unsigned) {

        return new Long(lowBits, highBits, unsigned);

    }

    static fromInt(value, unsigned) {

        let obj, cachedObj, cache;

        if (unsigned) {

            value >>>= 0;

            if ((cache = 0 <= value && value < 256)) {

                cachedObj = UINT_CACHE[value];

                if (cachedObj)

                    return cachedObj;

            }

            obj = Long.fromBits(value, (value | 0) < 0 ? -1 : 0, true);

            if (cache)

                UINT_CACHE[value] = obj;

            return obj;

        }

        else {

            value |= 0;

            if ((cache = -128 <= value && value < 128)) {

                cachedObj = INT_CACHE[value];

                if (cachedObj)

                    return cachedObj;

            }

            obj = Long.fromBits(value, value < 0 ? -1 : 0, false);

            if (cache)

                INT_CACHE[value] = obj;

            return obj;

        }

    }

    static fromNumber(value, unsigned) {

        if (isNaN(value))

            return unsigned ? Long.UZERO : Long.ZERO;

        if (unsigned) {

            if (value < 0)

                return Long.UZERO;

            if (value >= TWO_PWR_64_DBL)

                return Long.MAX_UNSIGNED_VALUE;

        }

        else {

            if (value <= -TWO_PWR_63_DBL)

                return Long.MIN_VALUE;

            if (value + 1 >= TWO_PWR_63_DBL)

                return Long.MAX_VALUE;

        }

        if (value < 0)

            return Long.fromNumber(-value, unsigned).neg();

        return Long.fromBits(value % TWO_PWR_32_DBL | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);

    }

    static fromBigInt(value, unsigned) {

        return Long.fromString(value.toString(), unsigned);

    }

    static fromString(str, unsigned, radix) {

        if (str.length === 0)

            throw new BSONError('empty string');

        if (str === 'NaN' || str === 'Infinity' || str === '+Infinity' || str === '-Infinity')

            return Long.ZERO;

        if (typeof unsigned === 'number') {

            (radix = unsigned), (unsigned = false);

        }

        else {

            unsigned = !!unsigned;

        }

        radix = radix || 10;

        if (radix < 2 || 36 < radix)

            throw new BSONError('radix');

        let p;

        if ((p = str.indexOf('-')) > 0)

            throw new BSONError('interior hyphen');

        else if (p === 0) {

            return Long.fromString(str.substring(1), unsigned, radix).neg();

        }

        const radixToPower = Long.fromNumber(Math.pow(radix, 8));

        let result = Long.ZERO;

        for (let i = 0; i < str.length; i += 8) {

            const size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);

            if (size < 8) {

                const power = Long.fromNumber(Math.pow(radix, size));

                result = result.mul(power).add(Long.fromNumber(value));

            }

            else {

                result = result.mul(radixToPower);

                result = result.add(Long.fromNumber(value));

            }

        }

        result.unsigned = unsigned;

        return result;

    }

    static fromBytes(bytes, unsigned, le) {

        return le ? Long.fromBytesLE(bytes, unsigned) : Long.fromBytesBE(bytes, unsigned);

    }

    static fromBytesLE(bytes, unsigned) {

        return new Long(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24), bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24), unsigned);

    }

    static fromBytesBE(bytes, unsigned) {

        return new Long((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7], (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3], unsigned);

    }

    static isLong(value) {

        return (value != null &&

            typeof value === 'object' &&

            '__isLong__' in value &&

            value.__isLong__ === true);

    }

    static fromValue(val, unsigned) {

        if (typeof val === 'number')

            return Long.fromNumber(val, unsigned);

        if (typeof val === 'string')

            return Long.fromString(val, unsigned);

        return Long.fromBits(val.low, val.high, typeof unsigned === 'boolean' ? unsigned : val.unsigned);

    }

    add(addend) {

        if (!Long.isLong(addend))

            addend = Long.fromValue(addend);

        const a48 = this.high >>> 16;

        const a32 = this.high & 0xffff;

        const a16 = this.low >>> 16;

        const a00 = this.low & 0xffff;

        const b48 = addend.high >>> 16;

        const b32 = addend.high & 0xffff;

        const b16 = addend.low >>> 16;

        const b00 = addend.low & 0xffff;

        let c48 = 0, c32 = 0, c16 = 0, c00 = 0;

        c00 += a00 + b00;

        c16 += c00 >>> 16;

        c00 &= 0xffff;

        c16 += a16 + b16;

        c32 += c16 >>> 16;

        c16 &= 0xffff;

        c32 += a32 + b32;

        c48 += c32 >>> 16;

        c32 &= 0xffff;

        c48 += a48 + b48;

        c48 &= 0xffff;

        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);

    }

    and(other) {

        if (!Long.isLong(other))

            other = Long.fromValue(other);

        return Long.fromBits(this.low & other.low, this.high & other.high, this.unsigned);

    }

    compare(other) {

        if (!Long.isLong(other))

            other = Long.fromValue(other);

        if (this.eq(other))

            return 0;

        const thisNeg = this.isNegative(), otherNeg = other.isNegative();

        if (thisNeg && !otherNeg)

            return -1;

        if (!thisNeg && otherNeg)

            return 1;

        if (!this.unsigned)

            return this.sub(other).isNegative() ? -1 : 1;

        return other.high >>> 0 > this.high >>> 0 ||

            (other.high === this.high && other.low >>> 0 > this.low >>> 0)

            ? -1

            : 1;

    }

    comp(other) {

        return this.compare(other);

    }

    divide(divisor) {

        if (!Long.isLong(divisor))

            divisor = Long.fromValue(divisor);

        if (divisor.isZero())

            throw new BSONError('division by zero');

        if (wasm) {

            if (!this.unsigned &&

                this.high === -0x80000000 &&

                divisor.low === -1 &&

                divisor.high === -1) {

                return this;

            }

            const low = (this.unsigned ? wasm.div_u : wasm.div_s)(this.low, this.high, divisor.low, divisor.high);

            return Long.fromBits(low, wasm.get_high(), this.unsigned);

        }

        if (this.isZero())

            return this.unsigned ? Long.UZERO : Long.ZERO;

        let approx, rem, res;

        if (!this.unsigned) {

            if (this.eq(Long.MIN_VALUE)) {

                if (divisor.eq(Long.ONE) || divisor.eq(Long.NEG_ONE))

                    return Long.MIN_VALUE;

                else if (divisor.eq(Long.MIN_VALUE))

                    return Long.ONE;

                else {

                    const halfThis = this.shr(1);

                    approx = halfThis.div(divisor).shl(1);

                    if (approx.eq(Long.ZERO)) {

                        return divisor.isNegative() ? Long.ONE : Long.NEG_ONE;

                    }

                    else {

                        rem = this.sub(divisor.mul(approx));

                        res = approx.add(rem.div(divisor));

                        return res;

                    }

                }

            }

            else if (divisor.eq(Long.MIN_VALUE))

                return this.unsigned ? Long.UZERO : Long.ZERO;

            if (this.isNegative()) {

                if (divisor.isNegative())

                    return this.neg().div(divisor.neg());

                return this.neg().div(divisor).neg();

            }

            else if (divisor.isNegative())

                return this.div(divisor.neg()).neg();

            res = Long.ZERO;

        }

        else {

            if (!divisor.unsigned)

                divisor = divisor.toUnsigned();

            if (divisor.gt(this))

                return Long.UZERO;

            if (divisor.gt(this.shru(1)))

                return Long.UONE;

            res = Long.UZERO;

        }

        rem = this;

        while (rem.gte(divisor)) {

            approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));

            const log2 = Math.ceil(Math.log(approx) / Math.LN2);

            const delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48);

            let approxRes = Long.fromNumber(approx);

            let approxRem = approxRes.mul(divisor);

            while (approxRem.isNegative() || approxRem.gt(rem)) {

                approx -= delta;

                approxRes = Long.fromNumber(approx, this.unsigned);

                approxRem = approxRes.mul(divisor);

            }

            if (approxRes.isZero())

                approxRes = Long.ONE;

            res = res.add(approxRes);

            rem = rem.sub(approxRem);

        }

        return res;

    }

    div(divisor) {

        return this.divide(divisor);

    }

    equals(other) {

        if (!Long.isLong(other))

            other = Long.fromValue(other);

        if (this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1)

            return false;

        return this.high === other.high && this.low === other.low;

    }

    eq(other) {

        return this.equals(other);

    }

    getHighBits() {

        return this.high;

    }

    getHighBitsUnsigned() {

        return this.high >>> 0;

    }

    getLowBits() {

        return this.low;

    }

    getLowBitsUnsigned() {

        return this.low >>> 0;

    }

    getNumBitsAbs() {

        if (this.isNegative()) {

            return this.eq(Long.MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();

        }

        const val = this.high !== 0 ? this.high : this.low;

        let bit;

        for (bit = 31; bit > 0; bit--)

            if ((val & (1 << bit)) !== 0)

                break;

        return this.high !== 0 ? bit + 33 : bit + 1;

    }

    greaterThan(other) {

        return this.comp(other) > 0;

    }

    gt(other) {

        return this.greaterThan(other);

    }

    greaterThanOrEqual(other) {

        return this.comp(other) >= 0;

    }

    gte(other) {

        return this.greaterThanOrEqual(other);

    }

    ge(other) {

        return this.greaterThanOrEqual(other);

    }

    isEven() {

        return (this.low & 1) === 0;

    }

    isNegative() {

        return !this.unsigned && this.high < 0;

    }

    isOdd() {

        return (this.low & 1) === 1;

    }

    isPositive() {

        return this.unsigned || this.high >= 0;

    }

    isZero() {

        return this.high === 0 && this.low === 0;

    }

    lessThan(other) {

        return this.comp(other) < 0;

    }

    lt(other) {

        return this.lessThan(other);

    }

    lessThanOrEqual(other) {

        return this.comp(other) <= 0;

    }

    lte(other) {

        return this.lessThanOrEqual(other);

    }

    modulo(divisor) {

        if (!Long.isLong(divisor))

            divisor = Long.fromValue(divisor);

        if (wasm) {

            const low = (this.unsigned ? wasm.rem_u : wasm.rem_s)(this.low, this.high, divisor.low, divisor.high);

            return Long.fromBits(low, wasm.get_high(), this.unsigned);

        }

        return this.sub(this.div(divisor).mul(divisor));

    }

    mod(divisor) {

        return this.modulo(divisor);

    }

    rem(divisor) {

        return this.modulo(divisor);

    }

    multiply(multiplier) {

        if (this.isZero())

            return Long.ZERO;

        if (!Long.isLong(multiplier))

            multiplier = Long.fromValue(multiplier);

        if (wasm) {

            const low = wasm.mul(this.low, this.high, multiplier.low, multiplier.high);

            return Long.fromBits(low, wasm.get_high(), this.unsigned);

        }

        if (multiplier.isZero())

            return Long.ZERO;

        if (this.eq(Long.MIN_VALUE))

            return multiplier.isOdd() ? Long.MIN_VALUE : Long.ZERO;

        if (multiplier.eq(Long.MIN_VALUE))

            return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;

        if (this.isNegative()) {

            if (multiplier.isNegative())

                return this.neg().mul(multiplier.neg());

            else

                return this.neg().mul(multiplier).neg();

        }

        else if (multiplier.isNegative())

            return this.mul(multiplier.neg()).neg();

        if (this.lt(Long.TWO_PWR_24) && multiplier.lt(Long.TWO_PWR_24))

            return Long.fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);

        const a48 = this.high >>> 16;

        const a32 = this.high & 0xffff;

        const a16 = this.low >>> 16;

        const a00 = this.low & 0xffff;

        const b48 = multiplier.high >>> 16;

        const b32 = multiplier.high & 0xffff;

        const b16 = multiplier.low >>> 16;

        const b00 = multiplier.low & 0xffff;

        let c48 = 0, c32 = 0, c16 = 0, c00 = 0;

        c00 += a00 * b00;

        c16 += c00 >>> 16;

        c00 &= 0xffff;

        c16 += a16 * b00;

        c32 += c16 >>> 16;

        c16 &= 0xffff;

        c16 += a00 * b16;

        c32 += c16 >>> 16;

        c16 &= 0xffff;

        c32 += a32 * b00;

        c48 += c32 >>> 16;

        c32 &= 0xffff;

        c32 += a16 * b16;

        c48 += c32 >>> 16;

        c32 &= 0xffff;

        c32 += a00 * b32;

        c48 += c32 >>> 16;

        c32 &= 0xffff;

        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;

        c48 &= 0xffff;

        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);

    }

    mul(multiplier) {

        return this.multiply(multiplier);

    }

    negate() {

        if (!this.unsigned && this.eq(Long.MIN_VALUE))

            return Long.MIN_VALUE;

        return this.not().add(Long.ONE);

    }

    neg() {

        return this.negate();

    }

    not() {

        return Long.fromBits(~this.low, ~this.high, this.unsigned);

    }

    notEquals(other) {

        return !this.equals(other);

    }

    neq(other) {

        return this.notEquals(other);

    }

    ne(other) {

        return this.notEquals(other);

    }

    or(other) {

        if (!Long.isLong(other))

            other = Long.fromValue(other);

        return Long.fromBits(this.low | other.low, this.high | other.high, this.unsigned);

    }

    shiftLeft(numBits) {

        if (Long.isLong(numBits))

            numBits = numBits.toInt();

        if ((numBits &= 63) === 0)

            return this;

        else if (numBits < 32)

            return Long.fromBits(this.low << numBits, (this.high << numBits) | (this.low >>> (32 - numBits)), this.unsigned);

        else

            return Long.fromBits(0, this.low << (numBits - 32), this.unsigned);

    }

    shl(numBits) {

        return this.shiftLeft(numBits);

    }

    shiftRight(numBits) {

        if (Long.isLong(numBits))

            numBits = numBits.toInt();

        if ((numBits &= 63) === 0)

            return this;

        else if (numBits < 32)

            return Long.fromBits((this.low >>> numBits) | (this.high << (32 - numBits)), this.high >> numBits, this.unsigned);

        else

            return Long.fromBits(this.high >> (numBits - 32), this.high >= 0 ? 0 : -1, this.unsigned);

    }

    shr(numBits) {

        return this.shiftRight(numBits);

    }

    shiftRightUnsigned(numBits) {

        if (Long.isLong(numBits))

            numBits = numBits.toInt();

        numBits &= 63;

        if (numBits === 0)

            return this;

        else {

            const high = this.high;

            if (numBits < 32) {

                const low = this.low;

                return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, this.unsigned);

            }

            else if (numBits === 32)

                return Long.fromBits(high, 0, this.unsigned);

            else

                return Long.fromBits(high >>> (numBits - 32), 0, this.unsigned);

        }

    }

    shr_u(numBits) {

        return this.shiftRightUnsigned(numBits);

    }

    shru(numBits) {

        return this.shiftRightUnsigned(numBits);

    }

    subtract(subtrahend) {

        if (!Long.isLong(subtrahend))

            subtrahend = Long.fromValue(subtrahend);

        return this.add(subtrahend.neg());

    }

    sub(subtrahend) {

        return this.subtract(subtrahend);

    }

    toInt() {

        return this.unsigned ? this.low >>> 0 : this.low;

    }

    toNumber() {

        if (this.unsigned)

            return (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0);

        return this.high * TWO_PWR_32_DBL + (this.low >>> 0);

    }

    toBigInt() {

        return BigInt(this.toString());

    }

    toBytes(le) {

        return le ? this.toBytesLE() : this.toBytesBE();

    }

    toBytesLE() {

        const hi = this.high, lo = this.low;

        return [

            lo & 0xff,

            (lo >>> 8) & 0xff,

            (lo >>> 16) & 0xff,

            lo >>> 24,

            hi & 0xff,

            (hi >>> 8) & 0xff,

            (hi >>> 16) & 0xff,

            hi >>> 24

        ];

    }

    toBytesBE() {

        const hi = this.high, lo = this.low;

        return [

            hi >>> 24,

            (hi >>> 16) & 0xff,

            (hi >>> 8) & 0xff,

            hi & 0xff,

            lo >>> 24,

            (lo >>> 16) & 0xff,

            (lo >>> 8) & 0xff,

            lo & 0xff

        ];

    }

    toSigned() {

        if (!this.unsigned)

            return this;

        return Long.fromBits(this.low, this.high, false);

    }

    toString(radix) {

        radix = radix || 10;

        if (radix < 2 || 36 < radix)

            throw new BSONError('radix');

        if (this.isZero())

            return '0';

        if (this.isNegative()) {

            if (this.eq(Long.MIN_VALUE)) {

                const radixLong = Long.fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);

                return div.toString(radix) + rem1.toInt().toString(radix);

            }

            else

                return '-' + this.neg().toString(radix);

        }

        const radixToPower = Long.fromNumber(Math.pow(radix, 6), this.unsigned);

        let rem = this;

        let result = '';

        while (true) {

            const remDiv = rem.div(radixToPower);

            const intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0;

            let digits = intval.toString(radix);

            rem = remDiv;

            if (rem.isZero()) {

                return digits + result;

            }

            else {

                while (digits.length < 6)

                    digits = '0' + digits;

                result = '' + digits + result;

            }

        }

    }

    toUnsigned() {

        if (this.unsigned)

            return this;

        return Long.fromBits(this.low, this.high, true);

    }

    xor(other) {

        if (!Long.isLong(other))

            other = Long.fromValue(other);

        return Long.fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);

    }

    eqz() {

        return this.isZero();

    }

    le(other) {

        return this.lessThanOrEqual(other);

    }

    toExtendedJSON(options) {

        if (options && options.relaxed)

            return this.toNumber();

        return { $numberLong: this.toString() };

    }

    static fromExtendedJSON(doc, options) {

        const { useBigInt64 = false, relaxed = true } = { ...options };

        if (doc.$numberLong.length > MAX_INT64_STRING_LENGTH) {

            throw new BSONError('$numberLong string is too long');

        }

        if (!DECIMAL_REG_EX.test(doc.$numberLong)) {

            throw new BSONError(`$numberLong string "${doc.$numberLong}" is in an invalid format`);

        }

        if (useBigInt64) {

            const bigIntResult = BigInt(doc.$numberLong);

            return BigInt.asIntN(64, bigIntResult);

        }

        const longResult = Long.fromString(doc.$numberLong);

        if (relaxed) {

            return longResult.toNumber();

        }

        return longResult;

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new Long("${this.toString()}"${this.unsigned ? ', true' : ''})`;

    }

}

Long.TWO_PWR_24 = Long.fromInt(TWO_PWR_24_DBL);

Long.MAX_UNSIGNED_VALUE = Long.fromBits(0xffffffff | 0, 0xffffffff | 0, true);

Long.ZERO = Long.fromInt(0);

Long.UZERO = Long.fromInt(0, true);

Long.ONE = Long.fromInt(1);

Long.UONE = Long.fromInt(1, true);

Long.NEG_ONE = Long.fromInt(-1);

Long.MAX_VALUE = Long.fromBits(0xffffffff | 0, 0x7fffffff | 0, false);

Long.MIN_VALUE = Long.fromBits(0, 0x80000000 | 0, false);



const PARSE_STRING_REGEXP = /^(\+|-)?(\d+|(\d*\.\d*))?(E|e)?([-+])?(\d+)?$/;

const PARSE_INF_REGEXP = /^(\+|-)?(Infinity|inf)$/i;

const PARSE_NAN_REGEXP = /^(\+|-)?NaN$/i;

const EXPONENT_MAX = 6111;

const EXPONENT_MIN = -6176;

const EXPONENT_BIAS = 6176;

const MAX_DIGITS = 34;

const NAN_BUFFER = ByteUtils.fromNumberArray([

    0x7c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

].reverse());

const INF_NEGATIVE_BUFFER = ByteUtils.fromNumberArray([

    0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

].reverse());

const INF_POSITIVE_BUFFER = ByteUtils.fromNumberArray([

    0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

].reverse());

const EXPONENT_REGEX = /^([-+])?(\d+)?$/;

const COMBINATION_MASK = 0x1f;

const EXPONENT_MASK = 0x3fff;

const COMBINATION_INFINITY = 30;

const COMBINATION_NAN = 31;

function isDigit(value) {

    return !isNaN(parseInt(value, 10));

}

function divideu128(value) {

    const DIVISOR = Long.fromNumber(1000 * 1000 * 1000);

    let _rem = Long.fromNumber(0);

    if (!value.parts[0] && !value.parts[1] && !value.parts[2] && !value.parts[3]) {

        return { quotient: value, rem: _rem };

    }

    for (let i = 0; i <= 3; i++) {

        _rem = _rem.shiftLeft(32);

        _rem = _rem.add(new Long(value.parts[i], 0));

        value.parts[i] = _rem.div(DIVISOR).low;

        _rem = _rem.modulo(DIVISOR);

    }

    return { quotient: value, rem: _rem };

}

function multiply64x2(left, right) {

    if (!left && !right) {

        return { high: Long.fromNumber(0), low: Long.fromNumber(0) };

    }

    const leftHigh = left.shiftRightUnsigned(32);

    const leftLow = new Long(left.getLowBits(), 0);

    const rightHigh = right.shiftRightUnsigned(32);

    const rightLow = new Long(right.getLowBits(), 0);

    let productHigh = leftHigh.multiply(rightHigh);

    let productMid = leftHigh.multiply(rightLow);

    const productMid2 = leftLow.multiply(rightHigh);

    let productLow = leftLow.multiply(rightLow);

    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));

    productMid = new Long(productMid.getLowBits(), 0)

        .add(productMid2)

        .add(productLow.shiftRightUnsigned(32));

    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));

    productLow = productMid.shiftLeft(32).add(new Long(productLow.getLowBits(), 0));

    return { high: productHigh, low: productLow };

}

function lessThan(left, right) {

    const uhleft = left.high >>> 0;

    const uhright = right.high >>> 0;

    if (uhleft < uhright) {

        return true;

    }

    else if (uhleft === uhright) {

        const ulleft = left.low >>> 0;

        const ulright = right.low >>> 0;

        if (ulleft < ulright)

            return true;

    }

    return false;

}

function invalidErr(string, message) {

    throw new BSONError(`"${string}" is not a valid Decimal128 string - ${message}`);

}

class Decimal128 extends BSONValue {

    get _bsontype() {

        return 'Decimal128';

    }

    constructor(bytes) {

        super();

        if (typeof bytes === 'string') {

            this.bytes = Decimal128.fromString(bytes).bytes;

        }

        else if (isUint8Array(bytes)) {

            if (bytes.byteLength !== 16) {

                throw new BSONError('Decimal128 must take a Buffer of 16 bytes');

            }

            this.bytes = bytes;

        }

        else {

            throw new BSONError('Decimal128 must take a Buffer or string');

        }

    }

    static fromString(representation) {

        let isNegative = false;

        let sawRadix = false;

        let foundNonZero = false;

        let significantDigits = 0;

        let nDigitsRead = 0;

        let nDigits = 0;

        let radixPosition = 0;

        let firstNonZero = 0;

        const digits = [0];

        let nDigitsStored = 0;

        let digitsInsert = 0;

        let firstDigit = 0;

        let lastDigit = 0;

        let exponent = 0;

        let i = 0;

        let significandHigh = new Long(0, 0);

        let significandLow = new Long(0, 0);

        let biasedExponent = 0;

        let index = 0;

        if (representation.length >= 7000) {

            throw new BSONError('' + representation + ' not a valid Decimal128 string');

        }

        const stringMatch = representation.match(PARSE_STRING_REGEXP);

        const infMatch = representation.match(PARSE_INF_REGEXP);

        const nanMatch = representation.match(PARSE_NAN_REGEXP);

        if ((!stringMatch && !infMatch && !nanMatch) || representation.length === 0) {

            throw new BSONError('' + representation + ' not a valid Decimal128 string');

        }

        if (stringMatch) {

            const unsignedNumber = stringMatch[2];

            const e = stringMatch[4];

            const expSign = stringMatch[5];

            const expNumber = stringMatch[6];

            if (e && expNumber === undefined)

                invalidErr(representation, 'missing exponent power');

            if (e && unsignedNumber === undefined)

                invalidErr(representation, 'missing exponent base');

            if (e === undefined && (expSign || expNumber)) {

                invalidErr(representation, 'missing e before exponent');

            }

        }

        if (representation[index] === '+' || representation[index] === '-') {

            isNegative = representation[index++] === '-';

        }

        if (!isDigit(representation[index]) && representation[index] !== '.') {

            if (representation[index] === 'i' || representation[index] === 'I') {

                return new Decimal128(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER);

            }

            else if (representation[index] === 'N') {

                return new Decimal128(NAN_BUFFER);

            }

        }

        while (isDigit(representation[index]) || representation[index] === '.') {

            if (representation[index] === '.') {

                if (sawRadix)

                    invalidErr(representation, 'contains multiple periods');

                sawRadix = true;

                index = index + 1;

                continue;

            }

            if (nDigitsStored < 34) {

                if (representation[index] !== '0' || foundNonZero) {

                    if (!foundNonZero) {

                        firstNonZero = nDigitsRead;

                    }

                    foundNonZero = true;

                    digits[digitsInsert++] = parseInt(representation[index], 10);

                    nDigitsStored = nDigitsStored + 1;

                }

            }

            if (foundNonZero)

                nDigits = nDigits + 1;

            if (sawRadix)

                radixPosition = radixPosition + 1;

            nDigitsRead = nDigitsRead + 1;

            index = index + 1;

        }

        if (sawRadix && !nDigitsRead)

            throw new BSONError('' + representation + ' not a valid Decimal128 string');

        if (representation[index] === 'e' || representation[index] === 'E') {

            const match = representation.substr(++index).match(EXPONENT_REGEX);

            if (!match || !match[2])

                return new Decimal128(NAN_BUFFER);

            exponent = parseInt(match[0], 10);

            index = index + match[0].length;

        }

        if (representation[index])

            return new Decimal128(NAN_BUFFER);

        firstDigit = 0;

        if (!nDigitsStored) {

            firstDigit = 0;

            lastDigit = 0;

            digits[0] = 0;

            nDigits = 1;

            nDigitsStored = 1;

            significantDigits = 0;

        }

        else {

            lastDigit = nDigitsStored - 1;

            significantDigits = nDigits;

            if (significantDigits !== 1) {

                while (digits[firstNonZero + significantDigits - 1] === 0) {

                    significantDigits = significantDigits - 1;

                }

            }

        }

        if (exponent <= radixPosition && radixPosition - exponent > 1 << 14) {

            exponent = EXPONENT_MIN;

        }

        else {

            exponent = exponent - radixPosition;

        }

        while (exponent > EXPONENT_MAX) {

            lastDigit = lastDigit + 1;

            if (lastDigit - firstDigit > MAX_DIGITS) {

                const digitsString = digits.join('');

                if (digitsString.match(/^0+$/)) {

                    exponent = EXPONENT_MAX;

                    break;

                }

                invalidErr(representation, 'overflow');

            }

            exponent = exponent - 1;

        }

        while (exponent < EXPONENT_MIN || nDigitsStored < nDigits) {

            if (lastDigit === 0 && significantDigits < nDigitsStored) {

                exponent = EXPONENT_MIN;

                significantDigits = 0;

                break;

            }

            if (nDigitsStored < nDigits) {

                nDigits = nDigits - 1;

            }

            else {

                lastDigit = lastDigit - 1;

            }

            if (exponent < EXPONENT_MAX) {

                exponent = exponent + 1;

            }

            else {

                const digitsString = digits.join('');

                if (digitsString.match(/^0+$/)) {

                    exponent = EXPONENT_MAX;

                    break;

                }

                invalidErr(representation, 'overflow');

            }

        }

        if (lastDigit - firstDigit + 1 < significantDigits) {

            let endOfString = nDigitsRead;

            if (sawRadix) {

                firstNonZero = firstNonZero + 1;

                endOfString = endOfString + 1;

            }

            if (isNegative) {

                firstNonZero = firstNonZero + 1;

                endOfString = endOfString + 1;

            }

            const roundDigit = parseInt(representation[firstNonZero + lastDigit + 1], 10);

            let roundBit = 0;

            if (roundDigit >= 5) {

                roundBit = 1;

                if (roundDigit === 5) {

                    roundBit = digits[lastDigit] % 2 === 1 ? 1 : 0;

                    for (i = firstNonZero + lastDigit + 2; i < endOfString; i++) {

                        if (parseInt(representation[i], 10)) {

                            roundBit = 1;

                            break;

                        }

                    }

                }

            }

            if (roundBit) {

                let dIdx = lastDigit;

                for (; dIdx >= 0; dIdx--) {

                    if (++digits[dIdx] > 9) {

                        digits[dIdx] = 0;

                        if (dIdx === 0) {

                            if (exponent < EXPONENT_MAX) {

                                exponent = exponent + 1;

                                digits[dIdx] = 1;

                            }

                            else {

                                return new Decimal128(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER);

                            }

                        }

                    }

                }

            }

        }

        significandHigh = Long.fromNumber(0);

        significandLow = Long.fromNumber(0);

        if (significantDigits === 0) {

            significandHigh = Long.fromNumber(0);

            significandLow = Long.fromNumber(0);

        }

        else if (lastDigit - firstDigit < 17) {

            let dIdx = firstDigit;

            significandLow = Long.fromNumber(digits[dIdx++]);

            significandHigh = new Long(0, 0);

            for (; dIdx <= lastDigit; dIdx++) {

                significandLow = significandLow.multiply(Long.fromNumber(10));

                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));

            }

        }

        else {

            let dIdx = firstDigit;

            significandHigh = Long.fromNumber(digits[dIdx++]);

            for (; dIdx <= lastDigit - 17; dIdx++) {

                significandHigh = significandHigh.multiply(Long.fromNumber(10));

                significandHigh = significandHigh.add(Long.fromNumber(digits[dIdx]));

            }

            significandLow = Long.fromNumber(digits[dIdx++]);

            for (; dIdx <= lastDigit; dIdx++) {

                significandLow = significandLow.multiply(Long.fromNumber(10));

                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));

            }

        }

        const significand = multiply64x2(significandHigh, Long.fromString('100000000000000000'));

        significand.low = significand.low.add(significandLow);

        if (lessThan(significand.low, significandLow)) {

            significand.high = significand.high.add(Long.fromNumber(1));

        }

        biasedExponent = exponent + EXPONENT_BIAS;

        const dec = { low: Long.fromNumber(0), high: Long.fromNumber(0) };

        if (significand.high.shiftRightUnsigned(49).and(Long.fromNumber(1)).equals(Long.fromNumber(1))) {

            dec.high = dec.high.or(Long.fromNumber(0x3).shiftLeft(61));

            dec.high = dec.high.or(Long.fromNumber(biasedExponent).and(Long.fromNumber(0x3fff).shiftLeft(47)));

            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x7fffffffffff)));

        }

        else {

            dec.high = dec.high.or(Long.fromNumber(biasedExponent & 0x3fff).shiftLeft(49));

            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x1ffffffffffff)));

        }

        dec.low = significand.low;

        if (isNegative) {

            dec.high = dec.high.or(Long.fromString('9223372036854775808'));

        }

        const buffer = ByteUtils.allocate(16);

        index = 0;

        buffer[index++] = dec.low.low & 0xff;

        buffer[index++] = (dec.low.low >> 8) & 0xff;

        buffer[index++] = (dec.low.low >> 16) & 0xff;

        buffer[index++] = (dec.low.low >> 24) & 0xff;

        buffer[index++] = dec.low.high & 0xff;

        buffer[index++] = (dec.low.high >> 8) & 0xff;

        buffer[index++] = (dec.low.high >> 16) & 0xff;

        buffer[index++] = (dec.low.high >> 24) & 0xff;

        buffer[index++] = dec.high.low & 0xff;

        buffer[index++] = (dec.high.low >> 8) & 0xff;

        buffer[index++] = (dec.high.low >> 16) & 0xff;

        buffer[index++] = (dec.high.low >> 24) & 0xff;

        buffer[index++] = dec.high.high & 0xff;

        buffer[index++] = (dec.high.high >> 8) & 0xff;

        buffer[index++] = (dec.high.high >> 16) & 0xff;

        buffer[index++] = (dec.high.high >> 24) & 0xff;

        return new Decimal128(buffer);

    }

    toString() {

        let biased_exponent;

        let significand_digits = 0;

        const significand = new Array(36);

        for (let i = 0; i < significand.length; i++)

            significand[i] = 0;

        let index = 0;

        let is_zero = false;

        let significand_msb;

        let significand128 = { parts: [0, 0, 0, 0] };

        let j, k;

        const string = [];

        index = 0;

        const buffer = this.bytes;

        const low = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);

        const midl = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);

        const midh = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);

        const high = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);

        index = 0;

        const dec = {

            low: new Long(low, midl),

            high: new Long(midh, high)

        };

        if (dec.high.lessThan(Long.ZERO)) {

            string.push('-');

        }

        const combination = (high >> 26) & COMBINATION_MASK;

        if (combination >> 3 === 3) {

            if (combination === COMBINATION_INFINITY) {

                return string.join('') + 'Infinity';

            }

            else if (combination === COMBINATION_NAN) {

                return 'NaN';

            }

            else {

                biased_exponent = (high >> 15) & EXPONENT_MASK;

                significand_msb = 0x08 + ((high >> 14) & 0x01);

            }

        }

        else {

            significand_msb = (high >> 14) & 0x07;

            biased_exponent = (high >> 17) & EXPONENT_MASK;

        }

        const exponent = biased_exponent - EXPONENT_BIAS;

        significand128.parts[0] = (high & 0x3fff) + ((significand_msb & 0xf) << 14);

        significand128.parts[1] = midh;

        significand128.parts[2] = midl;

        significand128.parts[3] = low;

        if (significand128.parts[0] === 0 &&

            significand128.parts[1] === 0 &&

            significand128.parts[2] === 0 &&

            significand128.parts[3] === 0) {

            is_zero = true;

        }

        else {

            for (k = 3; k >= 0; k--) {

                let least_digits = 0;

                const result = divideu128(significand128);

                significand128 = result.quotient;

                least_digits = result.rem.low;

                if (!least_digits)

                    continue;

                for (j = 8; j >= 0; j--) {

                    significand[k * 9 + j] = least_digits % 10;

                    least_digits = Math.floor(least_digits / 10);

                }

            }

        }

        if (is_zero) {

            significand_digits = 1;

            significand[index] = 0;

        }

        else {

            significand_digits = 36;

            while (!significand[index]) {

                significand_digits = significand_digits - 1;

                index = index + 1;

            }

        }

        const scientific_exponent = significand_digits - 1 + exponent;

        if (scientific_exponent >= 34 || scientific_exponent <= -7 || exponent > 0) {

            if (significand_digits > 34) {

                string.push(`${0}`);

                if (exponent > 0)

                    string.push(`E+${exponent}`);

                else if (exponent < 0)

                    string.push(`E${exponent}`);

                return string.join('');

            }

            string.push(`${significand[index++]}`);

            significand_digits = significand_digits - 1;

            if (significand_digits) {

                string.push('.');

            }

            for (let i = 0; i < significand_digits; i++) {

                string.push(`${significand[index++]}`);

            }

            string.push('E');

            if (scientific_exponent > 0) {

                string.push(`+${scientific_exponent}`);

            }

            else {

                string.push(`${scientific_exponent}`);

            }

        }

        else {

            if (exponent >= 0) {

                for (let i = 0; i < significand_digits; i++) {

                    string.push(`${significand[index++]}`);

                }

            }

            else {

                let radix_position = significand_digits + exponent;

                if (radix_position > 0) {

                    for (let i = 0; i < radix_position; i++) {

                        string.push(`${significand[index++]}`);

                    }

                }

                else {

                    string.push('0');

                }

                string.push('.');

                while (radix_position++ < 0) {

                    string.push('0');

                }

                for (let i = 0; i < significand_digits - Math.max(radix_position - 1, 0); i++) {

                    string.push(`${significand[index++]}`);

                }

            }

        }

        return string.join('');

    }

    toJSON() {

        return { $numberDecimal: this.toString() };

    }

    toExtendedJSON() {

        return { $numberDecimal: this.toString() };

    }

    static fromExtendedJSON(doc) {

        return Decimal128.fromString(doc.$numberDecimal);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new Decimal128("${this.toString()}")`;

    }

}



class Double extends BSONValue {

    get _bsontype() {

        return 'Double';

    }

    constructor(value) {

        super();

        if (value instanceof Number) {

            value = value.valueOf();

        }

        this.value = +value;

    }

    valueOf() {

        return this.value;

    }

    toJSON() {

        return this.value;

    }

    toString(radix) {

        return this.value.toString(radix);

    }

    toExtendedJSON(options) {

        if (options && (options.legacy || (options.relaxed && isFinite(this.value)))) {

            return this.value;

        }

        if (Object.is(Math.sign(this.value), -0)) {

            return { $numberDouble: '-0.0' };

        }

        return {

            $numberDouble: Number.isInteger(this.value) ? this.value.toFixed(1) : this.value.toString()

        };

    }

    static fromExtendedJSON(doc, options) {

        const doubleValue = parseFloat(doc.$numberDouble);

        return options && options.relaxed ? doubleValue : new Double(doubleValue);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        const eJSON = this.toExtendedJSON();

        return `new Double(${eJSON.$numberDouble})`;

    }

}



class Int32 extends BSONValue {

    get _bsontype() {

        return 'Int32';

    }

    constructor(value) {

        super();

        if (value instanceof Number) {

            value = value.valueOf();

        }

        this.value = +value | 0;

    }

    valueOf() {

        return this.value;

    }

    toString(radix) {

        return this.value.toString(radix);

    }

    toJSON() {

        return this.value;

    }

    toExtendedJSON(options) {

        if (options && (options.relaxed || options.legacy))

            return this.value;

        return { $numberInt: this.value.toString() };

    }

    static fromExtendedJSON(doc, options) {

        return options && options.relaxed ? parseInt(doc.$numberInt, 10) : new Int32(doc.$numberInt);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new Int32(${this.valueOf()})`;

    }

}



class MaxKey extends BSONValue {

    get _bsontype() {

        return 'MaxKey';

    }

    toExtendedJSON() {

        return { $maxKey: 1 };

    }

    static fromExtendedJSON() {

        return new MaxKey();

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return 'new MaxKey()';

    }

}



class MinKey extends BSONValue {

    get _bsontype() {

        return 'MinKey';

    }

    toExtendedJSON() {

        return { $minKey: 1 };

    }

    static fromExtendedJSON() {

        return new MinKey();

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return 'new MinKey()';

    }

}



const checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');

let PROCESS_UNIQUE = null;

const kId = Symbol('id');

class ObjectId extends BSONValue {

    get _bsontype() {

        return 'ObjectId';

    }

    constructor(inputId) {

        super();

        let workingId;

        if (typeof inputId === 'object' && inputId && 'id' in inputId) {

            if (typeof inputId.id !== 'string' && !ArrayBuffer.isView(inputId.id)) {

                throw new BSONError('Argument passed in must have an id that is of type string or Buffer');

            }

            if ('toHexString' in inputId && typeof inputId.toHexString === 'function') {

                workingId = ByteUtils.fromHex(inputId.toHexString());

            }

            else {

                workingId = inputId.id;

            }

        }

        else {

            workingId = inputId;

        }

        if (workingId == null || typeof workingId === 'number') {

            this[kId] = ObjectId.generate(typeof workingId === 'number' ? workingId : undefined);

        }

        else if (ArrayBuffer.isView(workingId) && workingId.byteLength === 12) {

            this[kId] = ByteUtils.toLocalBufferType(workingId);

        }

        else if (typeof workingId === 'string') {

            if (workingId.length === 12) {

                const bytes = ByteUtils.fromUTF8(workingId);

                if (bytes.byteLength === 12) {

                    this[kId] = bytes;

                }

                else {

                    throw new BSONError('Argument passed in must be a string of 12 bytes');

                }

            }

            else if (workingId.length === 24 && checkForHexRegExp.test(workingId)) {

                this[kId] = ByteUtils.fromHex(workingId);

            }

            else {

                throw new BSONError('Argument passed in must be a string of 12 bytes or a string of 24 hex characters or an integer');

            }

        }

        else {

            throw new BSONError('Argument passed in does not match the accepted types');

        }

        if (ObjectId.cacheHexString) {

            this.__id = ByteUtils.toHex(this.id);

        }

    }

    get id() {

        return this[kId];

    }

    set id(value) {

        this[kId] = value;

        if (ObjectId.cacheHexString) {

            this.__id = ByteUtils.toHex(value);

        }

    }

    toHexString() {

        if (ObjectId.cacheHexString && this.__id) {

            return this.__id;

        }

        const hexString = ByteUtils.toHex(this.id);

        if (ObjectId.cacheHexString && !this.__id) {

            this.__id = hexString;

        }

        return hexString;

    }

    static getInc() {

        return (ObjectId.index = (ObjectId.index + 1) % 0xffffff);

    }

    static generate(time) {

        if ('number' !== typeof time) {

            time = Math.floor(Date.now() / 1000);

        }

        const inc = ObjectId.getInc();

        const buffer = ByteUtils.allocate(12);

        BSONDataView.fromUint8Array(buffer).setUint32(0, time, false);

        if (PROCESS_UNIQUE === null) {

            PROCESS_UNIQUE = ByteUtils.randomBytes(5);

        }

        buffer[4] = PROCESS_UNIQUE[0];

        buffer[5] = PROCESS_UNIQUE[1];

        buffer[6] = PROCESS_UNIQUE[2];

        buffer[7] = PROCESS_UNIQUE[3];

        buffer[8] = PROCESS_UNIQUE[4];

        buffer[11] = inc & 0xff;

        buffer[10] = (inc >> 8) & 0xff;

        buffer[9] = (inc >> 16) & 0xff;

        return buffer;

    }

    toString(encoding) {

        if (encoding === 'base64')

            return ByteUtils.toBase64(this.id);

        if (encoding === 'hex')

            return this.toHexString();

        return this.toHexString();

    }

    toJSON() {

        return this.toHexString();

    }

    equals(otherId) {

        if (otherId === undefined || otherId === null) {

            return false;

        }

        if (otherId instanceof ObjectId) {

            return this[kId][11] === otherId[kId][11] && ByteUtils.equals(this[kId], otherId[kId]);

        }

        if (typeof otherId === 'string' &&

            ObjectId.isValid(otherId) &&

            otherId.length === 12 &&

            isUint8Array(this.id)) {

            return ByteUtils.equals(this.id, ByteUtils.fromISO88591(otherId));

        }

        if (typeof otherId === 'string' && ObjectId.isValid(otherId) && otherId.length === 24) {

            return otherId.toLowerCase() === this.toHexString();

        }

        if (typeof otherId === 'string' && ObjectId.isValid(otherId) && otherId.length === 12) {

            return ByteUtils.equals(ByteUtils.fromUTF8(otherId), this.id);

        }

        if (typeof otherId === 'object' &&

            'toHexString' in otherId &&

            typeof otherId.toHexString === 'function') {

            const otherIdString = otherId.toHexString();

            const thisIdString = this.toHexString().toLowerCase();

            return typeof otherIdString === 'string' && otherIdString.toLowerCase() === thisIdString;

        }

        return false;

    }

    getTimestamp() {

        const timestamp = new Date();

        const time = BSONDataView.fromUint8Array(this.id).getUint32(0, false);

        timestamp.setTime(Math.floor(time) * 1000);

        return timestamp;

    }

    static createPk() {

        return new ObjectId();

    }

    static createFromTime(time) {

        const buffer = ByteUtils.fromNumberArray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        BSONDataView.fromUint8Array(buffer).setUint32(0, time, false);

        return new ObjectId(buffer);

    }

    static createFromHexString(hexString) {

        if (hexString?.length !== 24) {

            throw new BSONError('hex string must be 24 characters');

        }

        return new ObjectId(ByteUtils.fromHex(hexString));

    }

    static createFromBase64(base64) {

        if (base64?.length !== 16) {

            throw new BSONError('base64 string must be 16 characters');

        }

        return new ObjectId(ByteUtils.fromBase64(base64));

    }

    static isValid(id) {

        if (id == null)

            return false;

        try {

            new ObjectId(id);

            return true;

        }

        catch {

            return false;

        }

    }

    toExtendedJSON() {

        if (this.toHexString)

            return { $oid: this.toHexString() };

        return { $oid: this.toString('hex') };

    }

    static fromExtendedJSON(doc) {

        return new ObjectId(doc.$oid);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new ObjectId("${this.toHexString()}")`;

    }

}

ObjectId.index = Math.floor(Math.random() * 0xffffff);



function internalCalculateObjectSize(object, serializeFunctions, ignoreUndefined) {

    let totalLength = 4 + 1;

    if (Array.isArray(object)) {

        for (let i = 0; i < object.length; i++) {

            totalLength += calculateElement(i.toString(), object[i], serializeFunctions, true, ignoreUndefined);

        }

    }

    else {

        if (typeof object?.toBSON === 'function') {

            object = object.toBSON();

        }

        for (const key of Object.keys(object)) {

            totalLength += calculateElement(key, object[key], serializeFunctions, false, ignoreUndefined);

        }

    }

    return totalLength;

}

function calculateElement(name, value, serializeFunctions = false, isArray = false, ignoreUndefined = false) {

    if (typeof value?.toBSON === 'function') {

        value = value.toBSON();

    }

    switch (typeof value) {

        case 'string':

            return 1 + ByteUtils.utf8ByteLength(name) + 1 + 4 + ByteUtils.utf8ByteLength(value) + 1;

        case 'number':

            if (Math.floor(value) === value &&

                value >= JS_INT_MIN &&

                value <= JS_INT_MAX) {

                if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {

                    return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (4 + 1);

                }

                else {

                    return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);

                }

            }

            else {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);

            }

        case 'undefined':

            if (isArray || !ignoreUndefined)

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1;

            return 0;

        case 'boolean':

            return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (1 + 1);

        case 'object':

            if (value != null &&

                typeof value._bsontype === 'string' &&

                value[Symbol.for('@@mdb.bson.version')] !== BSON_MAJOR_VERSION) {

                throw new BSONVersionError();

            }

            else if (value == null || value._bsontype === 'MinKey' || value._bsontype === 'MaxKey') {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + 1;

            }

            else if (value._bsontype === 'ObjectId') {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (12 + 1);

            }

            else if (value instanceof Date || isDate(value)) {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);

            }

            else if (ArrayBuffer.isView(value) ||

                value instanceof ArrayBuffer ||

                isAnyArrayBuffer(value)) {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (1 + 4 + 1) + value.byteLength);

            }

            else if (value._bsontype === 'Long' ||

                value._bsontype === 'Double' ||

                value._bsontype === 'Timestamp') {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (8 + 1);

            }

            else if (value._bsontype === 'Decimal128') {

                return (name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (16 + 1);

            }

            else if (value._bsontype === 'Code') {

                if (value.scope != null && Object.keys(value.scope).length > 0) {

                    return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                        1 +

                        4 +

                        4 +

                        ByteUtils.utf8ByteLength(value.code.toString()) +

                        1 +

                        internalCalculateObjectSize(value.scope, serializeFunctions, ignoreUndefined));

                }

                else {

                    return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                        1 +

                        4 +

                        ByteUtils.utf8ByteLength(value.code.toString()) +

                        1);

                }

            }

            else if (value._bsontype === 'Binary') {

                const binary = value;

                if (binary.sub_type === Binary.SUBTYPE_BYTE_ARRAY) {

                    return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                        (binary.position + 1 + 4 + 1 + 4));

                }

                else {

                    return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) + (binary.position + 1 + 4 + 1));

                }

            }

            else if (value._bsontype === 'Symbol') {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    ByteUtils.utf8ByteLength(value.value) +

                    4 +

                    1 +

                    1);

            }

            else if (value._bsontype === 'DBRef') {

                const ordered_values = Object.assign({

                    $ref: value.collection,

                    $id: value.oid

                }, value.fields);

                if (value.db != null) {

                    ordered_values['$db'] = value.db;

                }

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    1 +

                    internalCalculateObjectSize(ordered_values, serializeFunctions, ignoreUndefined));

            }

            else if (value instanceof RegExp || isRegExp(value)) {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    1 +

                    ByteUtils.utf8ByteLength(value.source) +

                    1 +

                    (value.global ? 1 : 0) +

                    (value.ignoreCase ? 1 : 0) +

                    (value.multiline ? 1 : 0) +

                    1);

            }

            else if (value._bsontype === 'BSONRegExp') {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    1 +

                    ByteUtils.utf8ByteLength(value.pattern) +

                    1 +

                    ByteUtils.utf8ByteLength(value.options) +

                    1);

            }

            else {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    internalCalculateObjectSize(value, serializeFunctions, ignoreUndefined) +

                    1);

            }

        case 'function':

            if (serializeFunctions) {

                return ((name != null ? ByteUtils.utf8ByteLength(name) + 1 : 0) +

                    1 +

                    4 +

                    ByteUtils.utf8ByteLength(value.toString()) +

                    1);

            }

    }

    return 0;

}



function alphabetize(str) {

    return str.split('').sort().join('');

}

class BSONRegExp extends BSONValue {

    get _bsontype() {

        return 'BSONRegExp';

    }

    constructor(pattern, options) {

        super();

        this.pattern = pattern;

        this.options = alphabetize(options ?? '');

        if (this.pattern.indexOf('\x00') !== -1) {

            throw new BSONError(`BSON Regex patterns cannot contain null bytes, found: ${JSON.stringify(this.pattern)}`);

        }

        if (this.options.indexOf('\x00') !== -1) {

            throw new BSONError(`BSON Regex options cannot contain null bytes, found: ${JSON.stringify(this.options)}`);

        }

        for (let i = 0; i < this.options.length; i++) {

            if (!(this.options[i] === 'i' ||

                this.options[i] === 'm' ||

                this.options[i] === 'x' ||

                this.options[i] === 'l' ||

                this.options[i] === 's' ||

                this.options[i] === 'u')) {

                throw new BSONError(`The regular expression option [${this.options[i]}] is not supported`);

            }

        }

    }

    static parseOptions(options) {

        return options ? options.split('').sort().join('') : '';

    }

    toExtendedJSON(options) {

        options = options || {};

        if (options.legacy) {

            return { $regex: this.pattern, $options: this.options };

        }

        return { $regularExpression: { pattern: this.pattern, options: this.options } };

    }

    static fromExtendedJSON(doc) {

        if ('$regex' in doc) {

            if (typeof doc.$regex !== 'string') {

                if (doc.$regex._bsontype === 'BSONRegExp') {

                    return doc;

                }

            }

            else {

                return new BSONRegExp(doc.$regex, BSONRegExp.parseOptions(doc.$options));

            }

        }

        if ('$regularExpression' in doc) {

            return new BSONRegExp(doc.$regularExpression.pattern, BSONRegExp.parseOptions(doc.$regularExpression.options));

        }

        throw new BSONError(`Unexpected BSONRegExp EJSON object form: ${JSON.stringify(doc)}`);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new BSONRegExp(${JSON.stringify(this.pattern)}, ${JSON.stringify(this.options)})`;

    }

}



class BSONSymbol extends BSONValue {

    get _bsontype() {

        return 'BSONSymbol';

    }

    constructor(value) {

        super();

        this.value = value;

    }

    valueOf() {

        return this.value;

    }

    toString() {

        return this.value;

    }

    inspect() {

        return `new BSONSymbol("${this.value}")`;

    }

    toJSON() {

        return this.value;

    }

    toExtendedJSON() {

        return { $symbol: this.value };

    }

    static fromExtendedJSON(doc) {

        return new BSONSymbol(doc.$symbol);

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

}



const LongWithoutOverridesClass = Long;

class Timestamp extends LongWithoutOverridesClass {

    get _bsontype() {

        return 'Timestamp';

    }

    constructor(low) {

        if (low == null) {

            super(0, 0, true);

        }

        else if (typeof low === 'bigint') {

            super(low, true);

        }

        else if (Long.isLong(low)) {

            super(low.low, low.high, true);

        }

        else if (typeof low === 'object' && 't' in low && 'i' in low) {

            if (typeof low.t !== 'number' && (typeof low.t !== 'object' || low.t._bsontype !== 'Int32')) {

                throw new BSONError('Timestamp constructed from { t, i } must provide t as a number');

            }

            if (typeof low.i !== 'number' && (typeof low.i !== 'object' || low.i._bsontype !== 'Int32')) {

                throw new BSONError('Timestamp constructed from { t, i } must provide i as a number');

            }

            const t = Number(low.t);

            const i = Number(low.i);

            if (t < 0 || Number.isNaN(t)) {

                throw new BSONError('Timestamp constructed from { t, i } must provide a positive t');

            }

            if (i < 0 || Number.isNaN(i)) {

                throw new BSONError('Timestamp constructed from { t, i } must provide a positive i');

            }

            if (t > 4294967295) {

                throw new BSONError('Timestamp constructed from { t, i } must provide t equal or less than uint32 max');

            }

            if (i > 4294967295) {

                throw new BSONError('Timestamp constructed from { t, i } must provide i equal or less than uint32 max');

            }

            super(i, t, true);

        }

        else {

            throw new BSONError('A Timestamp can only be constructed with: bigint, Long, or { t: number; i: number }');

        }

    }

    toJSON() {

        return {

            $timestamp: this.toString()

        };

    }

    static fromInt(value) {

        return new Timestamp(Long.fromInt(value, true));

    }

    static fromNumber(value) {

        return new Timestamp(Long.fromNumber(value, true));

    }

    static fromBits(lowBits, highBits) {

        return new Timestamp({ i: lowBits, t: highBits });

    }

    static fromString(str, optRadix) {

        return new Timestamp(Long.fromString(str, true, optRadix));

    }

    toExtendedJSON() {

        return { $timestamp: { t: this.high >>> 0, i: this.low >>> 0 } };

    }

    static fromExtendedJSON(doc) {

        const i = Long.isLong(doc.$timestamp.i)

            ? doc.$timestamp.i.getLowBitsUnsigned()

            : doc.$timestamp.i;

        const t = Long.isLong(doc.$timestamp.t)

            ? doc.$timestamp.t.getLowBitsUnsigned()

            : doc.$timestamp.t;

        return new Timestamp({ t, i });

    }

    [Symbol.for('nodejs.util.inspect.custom')]() {

        return this.inspect();

    }

    inspect() {

        return `new Timestamp({ t: ${this.getHighBits()}, i: ${this.getLowBits()} })`;

    }

}

Timestamp.MAX_VALUE = Long.MAX_UNSIGNED_VALUE;



const FIRST_BIT = 0x80;

const FIRST_TWO_BITS = 0xc0;

const FIRST_THREE_BITS = 0xe0;

const FIRST_FOUR_BITS = 0xf0;

const FIRST_FIVE_BITS = 0xf8;

const TWO_BIT_CHAR = 0xc0;

const THREE_BIT_CHAR = 0xe0;

const FOUR_BIT_CHAR = 0xf0;

const CONTINUING_CHAR = 0x80;

function validateUtf8(bytes, start, end) {

    let continuation = 0;

    for (let i = start; i < end; i += 1) {

        const byte = bytes[i];

        if (continuation) {

            if ((byte & FIRST_TWO_BITS) !== CONTINUING_CHAR) {

                return false;

            }

            continuation -= 1;

        }

        else if (byte & FIRST_BIT) {

            if ((byte & FIRST_THREE_BITS) === TWO_BIT_CHAR) {

                continuation = 1;

            }

            else if ((byte & FIRST_FOUR_BITS) === THREE_BIT_CHAR) {

                continuation = 2;

            }

            else if ((byte & FIRST_FIVE_BITS) === FOUR_BIT_CHAR) {

                continuation = 3;

            }

            else {

                return false;

            }

        }

    }

    return !continuation;

}



const JS_INT_MAX_LONG = Long.fromNumber(JS_INT_MAX);

const JS_INT_MIN_LONG = Long.fromNumber(JS_INT_MIN);

function internalDeserialize(buffer, options, isArray) {

    options = options == null ? {} : options;

    const index = options && options.index ? options.index : 0;

    const size = buffer[index] |

        (buffer[index + 1] << 8) |

        (buffer[index + 2] << 16) |

        (buffer[index + 3] << 24);

    if (size < 5) {

        throw new BSONError(`bson size must be >= 5, is ${size}`);

    }

    if (options.allowObjectSmallerThanBufferSize && buffer.length < size) {

        throw new BSONError(`buffer length ${buffer.length} must be >= bson size ${size}`);

    }

    if (!options.allowObjectSmallerThanBufferSize && buffer.length !== size) {

        throw new BSONError(`buffer length ${buffer.length} must === bson size ${size}`);

    }

    if (size + index > buffer.byteLength) {

        throw new BSONError(`(bson size ${size} + options.index ${index} must be <= buffer length ${buffer.byteLength})`);

    }

    if (buffer[index + size - 1] !== 0) {

        throw new BSONError("One object, sized correctly, with a spot for an EOO, but the EOO isn't 0x00");

    }

    return deserializeObject(buffer, index, options, isArray);

}

const allowedDBRefKeys = /^\$ref$|^\$id$|^\$db$/;

function deserializeObject(buffer, index, options, isArray = false) {

    const fieldsAsRaw = options['fieldsAsRaw'] == null ? null : options['fieldsAsRaw'];

    const raw = options['raw'] == null ? false : options['raw'];

    const bsonRegExp = typeof options['bsonRegExp'] === 'boolean' ? options['bsonRegExp'] : false;

    const promoteBuffers = options.promoteBuffers ?? false;

    const promoteLongs = options.promoteLongs ?? true;

    const promoteValues = options.promoteValues ?? true;

    const useBigInt64 = options.useBigInt64 ?? false;

    if (useBigInt64 && !promoteValues) {

        throw new BSONError('Must either request bigint or Long for int64 deserialization');

    }

    if (useBigInt64 && !promoteLongs) {

        throw new BSONError('Must either request bigint or Long for int64 deserialization');

    }

    const validation = options.validation == null ? { utf8: true } : options.validation;

    let globalUTFValidation = true;

    let validationSetting;

    const utf8KeysSet = new Set();

    const utf8ValidatedKeys = validation.utf8;

    if (typeof utf8ValidatedKeys === 'boolean') {

        validationSetting = utf8ValidatedKeys;

    }

    else {

        globalUTFValidation = false;

        const utf8ValidationValues = Object.keys(utf8ValidatedKeys).map(function (key) {

            return utf8ValidatedKeys[key];

        });

        if (utf8ValidationValues.length === 0) {

            throw new BSONError('UTF-8 validation setting cannot be empty');

        }

        if (typeof utf8ValidationValues[0] !== 'boolean') {

            throw new BSONError('Invalid UTF-8 validation option, must specify boolean values');

        }

        validationSetting = utf8ValidationValues[0];

        if (!utf8ValidationValues.every(item => item === validationSetting)) {

            throw new BSONError('Invalid UTF-8 validation option - keys must be all true or all false');

        }

    }

    if (!globalUTFValidation) {

        for (const key of Object.keys(utf8ValidatedKeys)) {

            utf8KeysSet.add(key);

        }

    }

    const startIndex = index;

    if (buffer.length < 5)

        throw new BSONError('corrupt bson message < 5 bytes long');

    const size = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);

    if (size < 5 || size > buffer.length)

        throw new BSONError('corrupt bson message');

    const object = isArray ? [] : {};

    let arrayIndex = 0;

    const done = false;

    let isPossibleDBRef = isArray ? false : null;

    const dataview = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    while (!done) {

        const elementType = buffer[index++];

        if (elementType === 0)

            break;

        let i = index;

        while (buffer[i] !== 0x00 && i < buffer.length) {

            i++;

        }

        if (i >= buffer.byteLength)

            throw new BSONError('Bad BSON Document: illegal CString');

        const name = isArray ? arrayIndex++ : ByteUtils.toUTF8(buffer, index, i);

        let shouldValidateKey = true;

        if (globalUTFValidation || utf8KeysSet.has(name)) {

            shouldValidateKey = validationSetting;

        }

        else {

            shouldValidateKey = !validationSetting;

        }

        if (isPossibleDBRef !== false && name[0] === '$') {

            isPossibleDBRef = allowedDBRefKeys.test(name);

        }

        let value;

        index = i + 1;

        if (elementType === BSON_DATA_STRING) {

            const stringSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (stringSize <= 0 ||

                stringSize > buffer.length - index ||

                buffer[index + stringSize - 1] !== 0) {

                throw new BSONError('bad string length in bson');

            }

            value = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);

            index = index + stringSize;

        }

        else if (elementType === BSON_DATA_OID) {

            const oid = ByteUtils.allocate(12);

            oid.set(buffer.subarray(index, index + 12));

            value = new ObjectId(oid);

            index = index + 12;

        }

        else if (elementType === BSON_DATA_INT && promoteValues === false) {

            value = new Int32(buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24));

        }

        else if (elementType === BSON_DATA_INT) {

            value =

                buffer[index++] |

                    (buffer[index++] << 8) |

                    (buffer[index++] << 16) |

                    (buffer[index++] << 24);

        }

        else if (elementType === BSON_DATA_NUMBER && promoteValues === false) {

            value = new Double(dataview.getFloat64(index, true));

            index = index + 8;

        }

        else if (elementType === BSON_DATA_NUMBER) {

            value = dataview.getFloat64(index, true);

            index = index + 8;

        }

        else if (elementType === BSON_DATA_DATE) {

            const lowBits = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            const highBits = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            value = new Date(new Long(lowBits, highBits).toNumber());

        }

        else if (elementType === BSON_DATA_BOOLEAN) {

            if (buffer[index] !== 0 && buffer[index] !== 1)

                throw new BSONError('illegal boolean type value');

            value = buffer[index++] === 1;

        }

        else if (elementType === BSON_DATA_OBJECT) {

            const _index = index;

            const objectSize = buffer[index] |

                (buffer[index + 1] << 8) |

                (buffer[index + 2] << 16) |

                (buffer[index + 3] << 24);

            if (objectSize <= 0 || objectSize > buffer.length - index)

                throw new BSONError('bad embedded document length in bson');

            if (raw) {

                value = buffer.slice(index, index + objectSize);

            }

            else {

                let objectOptions = options;

                if (!globalUTFValidation) {

                    objectOptions = { ...options, validation: { utf8: shouldValidateKey } };

                }

                value = deserializeObject(buffer, _index, objectOptions, false);

            }

            index = index + objectSize;

        }

        else if (elementType === BSON_DATA_ARRAY) {

            const _index = index;

            const objectSize = buffer[index] |

                (buffer[index + 1] << 8) |

                (buffer[index + 2] << 16) |

                (buffer[index + 3] << 24);

            let arrayOptions = options;

            const stopIndex = index + objectSize;

            if (fieldsAsRaw && fieldsAsRaw[name]) {

                arrayOptions = { ...options, raw: true };

            }

            if (!globalUTFValidation) {

                arrayOptions = { ...arrayOptions, validation: { utf8: shouldValidateKey } };

            }

            value = deserializeObject(buffer, _index, arrayOptions, true);

            index = index + objectSize;

            if (buffer[index - 1] !== 0)

                throw new BSONError('invalid array terminator byte');

            if (index !== stopIndex)

                throw new BSONError('corrupted array bson');

        }

        else if (elementType === BSON_DATA_UNDEFINED) {

            value = undefined;

        }

        else if (elementType === BSON_DATA_NULL) {

            value = null;

        }

        else if (elementType === BSON_DATA_LONG) {

            const dataview = BSONDataView.fromUint8Array(buffer.subarray(index, index + 8));

            const lowBits = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            const highBits = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            const long = new Long(lowBits, highBits);

            if (useBigInt64) {

                value = dataview.getBigInt64(0, true);

            }

            else if (promoteLongs && promoteValues === true) {

                value =

                    long.lessThanOrEqual(JS_INT_MAX_LONG) && long.greaterThanOrEqual(JS_INT_MIN_LONG)

                        ? long.toNumber()

                        : long;

            }

            else {

                value = long;

            }

        }

        else if (elementType === BSON_DATA_DECIMAL128) {

            const bytes = ByteUtils.allocate(16);

            bytes.set(buffer.subarray(index, index + 16), 0);

            index = index + 16;

            value = new Decimal128(bytes);

        }

        else if (elementType === BSON_DATA_BINARY) {

            let binarySize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            const totalBinarySize = binarySize;

            const subType = buffer[index++];

            if (binarySize < 0)

                throw new BSONError('Negative binary type element size found');

            if (binarySize > buffer.byteLength)

                throw new BSONError('Binary type size larger than document size');

            if (buffer['slice'] != null) {

                if (subType === Binary.SUBTYPE_BYTE_ARRAY) {

                    binarySize =

                        buffer[index++] |

                            (buffer[index++] << 8) |

                            (buffer[index++] << 16) |

                            (buffer[index++] << 24);

                    if (binarySize < 0)

                        throw new BSONError('Negative binary type element size found for subtype 0x02');

                    if (binarySize > totalBinarySize - 4)

                        throw new BSONError('Binary type with subtype 0x02 contains too long binary size');

                    if (binarySize < totalBinarySize - 4)

                        throw new BSONError('Binary type with subtype 0x02 contains too short binary size');

                }

                if (promoteBuffers && promoteValues) {

                    value = ByteUtils.toLocalBufferType(buffer.slice(index, index + binarySize));

                }

                else {

                    value = new Binary(buffer.slice(index, index + binarySize), subType);

                    if (subType === BSON_BINARY_SUBTYPE_UUID_NEW && UUID.isValid(value)) {

                        value = value.toUUID();

                    }

                }

            }

            else {

                const _buffer = ByteUtils.allocate(binarySize);

                if (subType === Binary.SUBTYPE_BYTE_ARRAY) {

                    binarySize =

                        buffer[index++] |

                            (buffer[index++] << 8) |

                            (buffer[index++] << 16) |

                            (buffer[index++] << 24);

                    if (binarySize < 0)

                        throw new BSONError('Negative binary type element size found for subtype 0x02');

                    if (binarySize > totalBinarySize - 4)

                        throw new BSONError('Binary type with subtype 0x02 contains too long binary size');

                    if (binarySize < totalBinarySize - 4)

                        throw new BSONError('Binary type with subtype 0x02 contains too short binary size');

                }

                for (i = 0; i < binarySize; i++) {

                    _buffer[i] = buffer[index + i];

                }

                if (promoteBuffers && promoteValues) {

                    value = _buffer;

                }

                else {

                    value = new Binary(buffer.slice(index, index + binarySize), subType);

                    if (subType === BSON_BINARY_SUBTYPE_UUID_NEW && UUID.isValid(value)) {

                        value = value.toUUID();

                    }

                }

            }

            index = index + binarySize;

        }

        else if (elementType === BSON_DATA_REGEXP && bsonRegExp === false) {

            i = index;

            while (buffer[i] !== 0x00 && i < buffer.length) {

                i++;

            }

            if (i >= buffer.length)

                throw new BSONError('Bad BSON Document: illegal CString');

            const source = ByteUtils.toUTF8(buffer, index, i);

            index = i + 1;

            i = index;

            while (buffer[i] !== 0x00 && i < buffer.length) {

                i++;

            }

            if (i >= buffer.length)

                throw new BSONError('Bad BSON Document: illegal CString');

            const regExpOptions = ByteUtils.toUTF8(buffer, index, i);

            index = i + 1;

            const optionsArray = new Array(regExpOptions.length);

            for (i = 0; i < regExpOptions.length; i++) {

                switch (regExpOptions[i]) {

                    case 'm':

                        optionsArray[i] = 'm';

                        break;

                    case 's':

                        optionsArray[i] = 'g';

                        break;

                    case 'i':

                        optionsArray[i] = 'i';

                        break;

                }

            }

            value = new RegExp(source, optionsArray.join(''));

        }

        else if (elementType === BSON_DATA_REGEXP && bsonRegExp === true) {

            i = index;

            while (buffer[i] !== 0x00 && i < buffer.length) {

                i++;

            }

            if (i >= buffer.length)

                throw new BSONError('Bad BSON Document: illegal CString');

            const source = ByteUtils.toUTF8(buffer, index, i);

            index = i + 1;

            i = index;

            while (buffer[i] !== 0x00 && i < buffer.length) {

                i++;

            }

            if (i >= buffer.length)

                throw new BSONError('Bad BSON Document: illegal CString');

            const regExpOptions = ByteUtils.toUTF8(buffer, index, i);

            index = i + 1;

            value = new BSONRegExp(source, regExpOptions);

        }

        else if (elementType === BSON_DATA_SYMBOL) {

            const stringSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (stringSize <= 0 ||

                stringSize > buffer.length - index ||

                buffer[index + stringSize - 1] !== 0) {

                throw new BSONError('bad string length in bson');

            }

            const symbol = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);

            value = promoteValues ? symbol : new BSONSymbol(symbol);

            index = index + stringSize;

        }

        else if (elementType === BSON_DATA_TIMESTAMP) {

            const i = buffer[index++] +

                buffer[index++] * (1 << 8) +

                buffer[index++] * (1 << 16) +

                buffer[index++] * (1 << 24);

            const t = buffer[index++] +

                buffer[index++] * (1 << 8) +

                buffer[index++] * (1 << 16) +

                buffer[index++] * (1 << 24);

            value = new Timestamp({ i, t });

        }

        else if (elementType === BSON_DATA_MIN_KEY) {

            value = new MinKey();

        }

        else if (elementType === BSON_DATA_MAX_KEY) {

            value = new MaxKey();

        }

        else if (elementType === BSON_DATA_CODE) {

            const stringSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (stringSize <= 0 ||

                stringSize > buffer.length - index ||

                buffer[index + stringSize - 1] !== 0) {

                throw new BSONError('bad string length in bson');

            }

            const functionString = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);

            value = new Code(functionString);

            index = index + stringSize;

        }

        else if (elementType === BSON_DATA_CODE_W_SCOPE) {

            const totalSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (totalSize < 4 + 4 + 4 + 1) {

                throw new BSONError('code_w_scope total size shorter minimum expected length');

            }

            const stringSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (stringSize <= 0 ||

                stringSize > buffer.length - index ||

                buffer[index + stringSize - 1] !== 0) {

                throw new BSONError('bad string length in bson');

            }

            const functionString = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);

            index = index + stringSize;

            const _index = index;

            const objectSize = buffer[index] |

                (buffer[index + 1] << 8) |

                (buffer[index + 2] << 16) |

                (buffer[index + 3] << 24);

            const scopeObject = deserializeObject(buffer, _index, options, false);

            index = index + objectSize;

            if (totalSize < 4 + 4 + objectSize + stringSize) {

                throw new BSONError('code_w_scope total size is too short, truncating scope');

            }

            if (totalSize > 4 + 4 + objectSize + stringSize) {

                throw new BSONError('code_w_scope total size is too long, clips outer document');

            }

            value = new Code(functionString, scopeObject);

        }

        else if (elementType === BSON_DATA_DBPOINTER) {

            const stringSize = buffer[index++] |

                (buffer[index++] << 8) |

                (buffer[index++] << 16) |

                (buffer[index++] << 24);

            if (stringSize <= 0 ||

                stringSize > buffer.length - index ||

                buffer[index + stringSize - 1] !== 0)

                throw new BSONError('bad string length in bson');

            if (validation != null && validation.utf8) {

                if (!validateUtf8(buffer, index, index + stringSize - 1)) {

                    throw new BSONError('Invalid UTF-8 string in BSON document');

                }

            }

            const namespace = ByteUtils.toUTF8(buffer, index, index + stringSize - 1);

            index = index + stringSize;

            const oidBuffer = ByteUtils.allocate(12);

            oidBuffer.set(buffer.subarray(index, index + 12), 0);

            const oid = new ObjectId(oidBuffer);

            index = index + 12;

            value = new DBRef(namespace, oid);

        }

        else {

            throw new BSONError(`Detected unknown BSON type ${elementType.toString(16)} for fieldname "${name}"`);

        }

        if (name === '__proto__') {

            Object.defineProperty(object, name, {

                value,

                writable: true,

                enumerable: true,

                configurable: true

            });

        }

        else {

            object[name] = value;

        }

    }

    if (size !== index - startIndex) {

        if (isArray)

            throw new BSONError('corrupt array bson');

        throw new BSONError('corrupt object bson');

    }

    if (!isPossibleDBRef)

        return object;

    if (isDBRefLike(object)) {

        const copy = Object.assign({}, object);

        delete copy.$ref;

        delete copy.$id;

        delete copy.$db;

        return new DBRef(object.$ref, object.$id, object.$db, copy);

    }

    return object;

}

function getValidatedString(buffer, start, end, shouldValidateUtf8) {

    const value = ByteUtils.toUTF8(buffer, start, end);

    if (shouldValidateUtf8) {

        for (let i = 0; i < value.length; i++) {

            if (value.charCodeAt(i) === 0xfffd) {

                if (!validateUtf8(buffer, start, end)) {

                    throw new BSONError('Invalid UTF-8 string in BSON document');

                }

                break;

            }

        }

    }

    return value;

}



const regexp = /\x00/;

const ignoreKeys = new Set(['$db', '$ref', '$id', '$clusterTime']);

function serializeString(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_STRING;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes + 1;

    buffer[index - 1] = 0;

    const size = ByteUtils.encodeUTF8Into(buffer, value, index + 4);

    buffer[index + 3] = ((size + 1) >> 24) & 0xff;

    buffer[index + 2] = ((size + 1) >> 16) & 0xff;

    buffer[index + 1] = ((size + 1) >> 8) & 0xff;

    buffer[index] = (size + 1) & 0xff;

    index = index + 4 + size;

    buffer[index++] = 0;

    return index;

}

const NUMBER_SPACE = new DataView(new ArrayBuffer(8), 0, 8);

const FOUR_BYTE_VIEW_ON_NUMBER = new Uint8Array(NUMBER_SPACE.buffer, 0, 4);

const EIGHT_BYTE_VIEW_ON_NUMBER = new Uint8Array(NUMBER_SPACE.buffer, 0, 8);

function serializeNumber(buffer, key, value, index) {

    const isNegativeZero = Object.is(value, -0);

    const type = !isNegativeZero &&

        Number.isSafeInteger(value) &&

        value <= BSON_INT32_MAX &&

        value >= BSON_INT32_MIN

        ? BSON_DATA_INT

        : BSON_DATA_NUMBER;

    if (type === BSON_DATA_INT) {

        NUMBER_SPACE.setInt32(0, value, true);

    }

    else {

        NUMBER_SPACE.setFloat64(0, value, true);

    }

    const bytes = type === BSON_DATA_INT ? FOUR_BYTE_VIEW_ON_NUMBER : EIGHT_BYTE_VIEW_ON_NUMBER;

    buffer[index++] = type;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0x00;

    buffer.set(bytes, index);

    index += bytes.byteLength;

    return index;

}

function serializeBigInt(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_LONG;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index += numberOfWrittenBytes;

    buffer[index++] = 0;

    NUMBER_SPACE.setBigInt64(0, value, true);

    buffer.set(EIGHT_BYTE_VIEW_ON_NUMBER, index);

    index += EIGHT_BYTE_VIEW_ON_NUMBER.byteLength;

    return index;

}

function serializeNull(buffer, key, _, index) {

    buffer[index++] = BSON_DATA_NULL;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    return index;

}

function serializeBoolean(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_BOOLEAN;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    buffer[index++] = value ? 1 : 0;

    return index;

}

function serializeDate(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_DATE;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const dateInMilis = Long.fromNumber(value.getTime());

    const lowBits = dateInMilis.getLowBits();

    const highBits = dateInMilis.getHighBits();

    buffer[index++] = lowBits & 0xff;

    buffer[index++] = (lowBits >> 8) & 0xff;

    buffer[index++] = (lowBits >> 16) & 0xff;

    buffer[index++] = (lowBits >> 24) & 0xff;

    buffer[index++] = highBits & 0xff;

    buffer[index++] = (highBits >> 8) & 0xff;

    buffer[index++] = (highBits >> 16) & 0xff;

    buffer[index++] = (highBits >> 24) & 0xff;

    return index;

}

function serializeRegExp(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_REGEXP;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    if (value.source && value.source.match(regexp) != null) {

        throw new BSONError('value ' + value.source + ' must not contain null bytes');

    }

    index = index + ByteUtils.encodeUTF8Into(buffer, value.source, index);

    buffer[index++] = 0x00;

    if (value.ignoreCase)

        buffer[index++] = 0x69;

    if (value.global)

        buffer[index++] = 0x73;

    if (value.multiline)

        buffer[index++] = 0x6d;

    buffer[index++] = 0x00;

    return index;

}

function serializeBSONRegExp(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_REGEXP;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    if (value.pattern.match(regexp) != null) {

        throw new BSONError('pattern ' + value.pattern + ' must not contain null bytes');

    }

    index = index + ByteUtils.encodeUTF8Into(buffer, value.pattern, index);

    buffer[index++] = 0x00;

    const sortedOptions = value.options.split('').sort().join('');

    index = index + ByteUtils.encodeUTF8Into(buffer, sortedOptions, index);

    buffer[index++] = 0x00;

    return index;

}

function serializeMinMax(buffer, key, value, index) {

    if (value === null) {

        buffer[index++] = BSON_DATA_NULL;

    }

    else if (value._bsontype === 'MinKey') {

        buffer[index++] = BSON_DATA_MIN_KEY;

    }

    else {

        buffer[index++] = BSON_DATA_MAX_KEY;

    }

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    return index;

}

function serializeObjectId(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_OID;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    if (isUint8Array(value.id)) {

        buffer.set(value.id.subarray(0, 12), index);

    }

    else {

        throw new BSONError('object [' + JSON.stringify(value) + '] is not a valid ObjectId');

    }

    return index + 12;

}

function serializeBuffer(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_BINARY;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const size = value.length;

    buffer[index++] = size & 0xff;

    buffer[index++] = (size >> 8) & 0xff;

    buffer[index++] = (size >> 16) & 0xff;

    buffer[index++] = (size >> 24) & 0xff;

    buffer[index++] = BSON_BINARY_SUBTYPE_DEFAULT;

    buffer.set(value, index);

    index = index + size;

    return index;

}

function serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path) {

    if (path.has(value)) {

        throw new BSONError('Cannot convert circular structure to BSON');

    }

    path.add(value);

    buffer[index++] = Array.isArray(value) ? BSON_DATA_ARRAY : BSON_DATA_OBJECT;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const endIndex = serializeInto(buffer, value, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined, path);

    path.delete(value);

    return endIndex;

}

function serializeDecimal128(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_DECIMAL128;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    buffer.set(value.bytes.subarray(0, 16), index);

    return index + 16;

}

function serializeLong(buffer, key, value, index) {

    buffer[index++] =

        value._bsontype === 'Long' ? BSON_DATA_LONG : BSON_DATA_TIMESTAMP;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const lowBits = value.getLowBits();

    const highBits = value.getHighBits();

    buffer[index++] = lowBits & 0xff;

    buffer[index++] = (lowBits >> 8) & 0xff;

    buffer[index++] = (lowBits >> 16) & 0xff;

    buffer[index++] = (lowBits >> 24) & 0xff;

    buffer[index++] = highBits & 0xff;

    buffer[index++] = (highBits >> 8) & 0xff;

    buffer[index++] = (highBits >> 16) & 0xff;

    buffer[index++] = (highBits >> 24) & 0xff;

    return index;

}

function serializeInt32(buffer, key, value, index) {

    value = value.valueOf();

    buffer[index++] = BSON_DATA_INT;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    buffer[index++] = value & 0xff;

    buffer[index++] = (value >> 8) & 0xff;

    buffer[index++] = (value >> 16) & 0xff;

    buffer[index++] = (value >> 24) & 0xff;

    return index;

}

function serializeDouble(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_NUMBER;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    NUMBER_SPACE.setFloat64(0, value.value, true);

    buffer.set(EIGHT_BYTE_VIEW_ON_NUMBER, index);

    index = index + 8;

    return index;

}

function serializeFunction(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_CODE;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const functionString = value.toString();

    const size = ByteUtils.encodeUTF8Into(buffer, functionString, index + 4) + 1;

    buffer[index] = size & 0xff;

    buffer[index + 1] = (size >> 8) & 0xff;

    buffer[index + 2] = (size >> 16) & 0xff;

    buffer[index + 3] = (size >> 24) & 0xff;

    index = index + 4 + size - 1;

    buffer[index++] = 0;

    return index;

}

function serializeCode(buffer, key, value, index, checkKeys = false, depth = 0, serializeFunctions = false, ignoreUndefined = true, path) {

    if (value.scope && typeof value.scope === 'object') {

        buffer[index++] = BSON_DATA_CODE_W_SCOPE;

        const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

        index = index + numberOfWrittenBytes;

        buffer[index++] = 0;

        let startIndex = index;

        const functionString = value.code;

        index = index + 4;

        const codeSize = ByteUtils.encodeUTF8Into(buffer, functionString, index + 4) + 1;

        buffer[index] = codeSize & 0xff;

        buffer[index + 1] = (codeSize >> 8) & 0xff;

        buffer[index + 2] = (codeSize >> 16) & 0xff;

        buffer[index + 3] = (codeSize >> 24) & 0xff;

        buffer[index + 4 + codeSize - 1] = 0;

        index = index + codeSize + 4;

        const endIndex = serializeInto(buffer, value.scope, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined, path);

        index = endIndex - 1;

        const totalSize = endIndex - startIndex;

        buffer[startIndex++] = totalSize & 0xff;

        buffer[startIndex++] = (totalSize >> 8) & 0xff;

        buffer[startIndex++] = (totalSize >> 16) & 0xff;

        buffer[startIndex++] = (totalSize >> 24) & 0xff;

        buffer[index++] = 0;

    }

    else {

        buffer[index++] = BSON_DATA_CODE;

        const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

        index = index + numberOfWrittenBytes;

        buffer[index++] = 0;

        const functionString = value.code.toString();

        const size = ByteUtils.encodeUTF8Into(buffer, functionString, index + 4) + 1;

        buffer[index] = size & 0xff;

        buffer[index + 1] = (size >> 8) & 0xff;

        buffer[index + 2] = (size >> 16) & 0xff;

        buffer[index + 3] = (size >> 24) & 0xff;

        index = index + 4 + size - 1;

        buffer[index++] = 0;

    }

    return index;

}

function serializeBinary(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_BINARY;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const data = value.buffer;

    let size = value.position;

    if (value.sub_type === Binary.SUBTYPE_BYTE_ARRAY)

        size = size + 4;

    buffer[index++] = size & 0xff;

    buffer[index++] = (size >> 8) & 0xff;

    buffer[index++] = (size >> 16) & 0xff;

    buffer[index++] = (size >> 24) & 0xff;

    buffer[index++] = value.sub_type;

    if (value.sub_type === Binary.SUBTYPE_BYTE_ARRAY) {

        size = size - 4;

        buffer[index++] = size & 0xff;

        buffer[index++] = (size >> 8) & 0xff;

        buffer[index++] = (size >> 16) & 0xff;

        buffer[index++] = (size >> 24) & 0xff;

    }

    buffer.set(data, index);

    index = index + value.position;

    return index;

}

function serializeSymbol(buffer, key, value, index) {

    buffer[index++] = BSON_DATA_SYMBOL;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    const size = ByteUtils.encodeUTF8Into(buffer, value.value, index + 4) + 1;

    buffer[index] = size & 0xff;

    buffer[index + 1] = (size >> 8) & 0xff;

    buffer[index + 2] = (size >> 16) & 0xff;

    buffer[index + 3] = (size >> 24) & 0xff;

    index = index + 4 + size - 1;

    buffer[index++] = 0x00;

    return index;

}

function serializeDBRef(buffer, key, value, index, depth, serializeFunctions, path) {

    buffer[index++] = BSON_DATA_OBJECT;

    const numberOfWrittenBytes = ByteUtils.encodeUTF8Into(buffer, key, index);

    index = index + numberOfWrittenBytes;

    buffer[index++] = 0;

    let startIndex = index;

    let output = {

        $ref: value.collection || value.namespace,

        $id: value.oid

    };

    if (value.db != null) {

        output.$db = value.db;

    }

    output = Object.assign(output, value.fields);

    const endIndex = serializeInto(buffer, output, false, index, depth + 1, serializeFunctions, true, path);

    const size = endIndex - startIndex;

    buffer[startIndex++] = size & 0xff;

    buffer[startIndex++] = (size >> 8) & 0xff;

    buffer[startIndex++] = (size >> 16) & 0xff;

    buffer[startIndex++] = (size >> 24) & 0xff;

    return endIndex;

}

function serializeInto(buffer, object, checkKeys, startingIndex, depth, serializeFunctions, ignoreUndefined, path) {

    if (path == null) {

        if (object == null) {

            buffer[0] = 0x05;

            buffer[1] = 0x00;

            buffer[2] = 0x00;

            buffer[3] = 0x00;

            buffer[4] = 0x00;

            return 5;

        }

        if (Array.isArray(object)) {

            throw new BSONError('serialize does not support an array as the root input');

        }

        if (typeof object !== 'object') {

            throw new BSONError('serialize does not support non-object as the root input');

        }

        else if ('_bsontype' in object && typeof object._bsontype === 'string') {

            throw new BSONError(`BSON types cannot be serialized as a document`);

        }

        else if (isDate(object) ||

            isRegExp(object) ||

            isUint8Array(object) ||

            isAnyArrayBuffer(object)) {

            throw new BSONError(`date, regexp, typedarray, and arraybuffer cannot be BSON documents`);

        }

        path = new Set();

    }

    path.add(object);

    let index = startingIndex + 4;

    if (Array.isArray(object)) {

        for (let i = 0; i < object.length; i++) {

            const key = `${i}`;

            let value = object[i];

            if (typeof value?.toBSON === 'function') {

                value = value.toBSON();

            }

            if (typeof value === 'string') {

                index = serializeString(buffer, key, value, index);

            }

            else if (typeof value === 'number') {

                index = serializeNumber(buffer, key, value, index);

            }

            else if (typeof value === 'bigint') {

                index = serializeBigInt(buffer, key, value, index);

            }

            else if (typeof value === 'boolean') {

                index = serializeBoolean(buffer, key, value, index);

            }

            else if (value instanceof Date || isDate(value)) {

                index = serializeDate(buffer, key, value, index);

            }

            else if (value === undefined) {

                index = serializeNull(buffer, key, value, index);

            }

            else if (value === null) {

                index = serializeNull(buffer, key, value, index);

            }

            else if (isUint8Array(value)) {

                index = serializeBuffer(buffer, key, value, index);

            }

            else if (value instanceof RegExp || isRegExp(value)) {

                index = serializeRegExp(buffer, key, value, index);

            }

            else if (typeof value === 'object' && value._bsontype == null) {

                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (typeof value === 'object' &&

                value[Symbol.for('@@mdb.bson.version')] !== BSON_MAJOR_VERSION) {

                throw new BSONVersionError();

            }

            else if (value._bsontype === 'ObjectId') {

                index = serializeObjectId(buffer, key, value, index);

            }

            else if (value._bsontype === 'Decimal128') {

                index = serializeDecimal128(buffer, key, value, index);

            }

            else if (value._bsontype === 'Long' || value._bsontype === 'Timestamp') {

                index = serializeLong(buffer, key, value, index);

            }

            else if (value._bsontype === 'Double') {

                index = serializeDouble(buffer, key, value, index);

            }

            else if (typeof value === 'function' && serializeFunctions) {

                index = serializeFunction(buffer, key, value, index);

            }

            else if (value._bsontype === 'Code') {

                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (value._bsontype === 'Binary') {

                index = serializeBinary(buffer, key, value, index);

            }

            else if (value._bsontype === 'BSONSymbol') {

                index = serializeSymbol(buffer, key, value, index);

            }

            else if (value._bsontype === 'DBRef') {

                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions, path);

            }

            else if (value._bsontype === 'BSONRegExp') {

                index = serializeBSONRegExp(buffer, key, value, index);

            }

            else if (value._bsontype === 'Int32') {

                index = serializeInt32(buffer, key, value, index);

            }

            else if (value._bsontype === 'MinKey' || value._bsontype === 'MaxKey') {

                index = serializeMinMax(buffer, key, value, index);

            }

            else if (typeof value._bsontype !== 'undefined') {

                throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);

            }

        }

    }

    else if (object instanceof Map || isMap(object)) {

        const iterator = object.entries();

        let done = false;

        while (!done) {

            const entry = iterator.next();

            done = !!entry.done;

            if (done)

                continue;

            const key = entry.value[0];

            let value = entry.value[1];

            if (typeof value?.toBSON === 'function') {

                value = value.toBSON();

            }

            const type = typeof value;

            if (typeof key === 'string' && !ignoreKeys.has(key)) {

                if (key.match(regexp) != null) {

                    throw new BSONError('key ' + key + ' must not contain null bytes');

                }

                if (checkKeys) {

                    if ('$' === key[0]) {

                        throw new BSONError('key ' + key + " must not start with '$'");

                    }

                    else if (~key.indexOf('.')) {

                        throw new BSONError('key ' + key + " must not contain '.'");

                    }

                }

            }

            if (type === 'string') {

                index = serializeString(buffer, key, value, index);

            }

            else if (type === 'number') {

                index = serializeNumber(buffer, key, value, index);

            }

            else if (type === 'bigint') {

                index = serializeBigInt(buffer, key, value, index);

            }

            else if (type === 'boolean') {

                index = serializeBoolean(buffer, key, value, index);

            }

            else if (value instanceof Date || isDate(value)) {

                index = serializeDate(buffer, key, value, index);

            }

            else if (value === null || (value === undefined && ignoreUndefined === false)) {

                index = serializeNull(buffer, key, value, index);

            }

            else if (isUint8Array(value)) {

                index = serializeBuffer(buffer, key, value, index);

            }

            else if (value instanceof RegExp || isRegExp(value)) {

                index = serializeRegExp(buffer, key, value, index);

            }

            else if (type === 'object' && value._bsontype == null) {

                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (typeof value === 'object' &&

                value[Symbol.for('@@mdb.bson.version')] !== BSON_MAJOR_VERSION) {

                throw new BSONVersionError();

            }

            else if (value._bsontype === 'ObjectId') {

                index = serializeObjectId(buffer, key, value, index);

            }

            else if (type === 'object' && value._bsontype === 'Decimal128') {

                index = serializeDecimal128(buffer, key, value, index);

            }

            else if (value._bsontype === 'Long' || value._bsontype === 'Timestamp') {

                index = serializeLong(buffer, key, value, index);

            }

            else if (value._bsontype === 'Double') {

                index = serializeDouble(buffer, key, value, index);

            }

            else if (value._bsontype === 'Code') {

                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (typeof value === 'function' && serializeFunctions) {

                index = serializeFunction(buffer, key, value, index);

            }

            else if (value._bsontype === 'Binary') {

                index = serializeBinary(buffer, key, value, index);

            }

            else if (value._bsontype === 'BSONSymbol') {

                index = serializeSymbol(buffer, key, value, index);

            }

            else if (value._bsontype === 'DBRef') {

                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions, path);

            }

            else if (value._bsontype === 'BSONRegExp') {

                index = serializeBSONRegExp(buffer, key, value, index);

            }

            else if (value._bsontype === 'Int32') {

                index = serializeInt32(buffer, key, value, index);

            }

            else if (value._bsontype === 'MinKey' || value._bsontype === 'MaxKey') {

                index = serializeMinMax(buffer, key, value, index);

            }

            else if (typeof value._bsontype !== 'undefined') {

                throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);

            }

        }

    }

    else {

        if (typeof object?.toBSON === 'function') {

            object = object.toBSON();

            if (object != null && typeof object !== 'object') {

                throw new BSONError('toBSON function did not return an object');

            }

        }

        for (const key of Object.keys(object)) {

            let value = object[key];

            if (typeof value?.toBSON === 'function') {

                value = value.toBSON();

            }

            const type = typeof value;

            if (typeof key === 'string' && !ignoreKeys.has(key)) {

                if (key.match(regexp) != null) {

                    throw new BSONError('key ' + key + ' must not contain null bytes');

                }

                if (checkKeys) {

                    if ('$' === key[0]) {

                        throw new BSONError('key ' + key + " must not start with '$'");

                    }

                    else if (~key.indexOf('.')) {

                        throw new BSONError('key ' + key + " must not contain '.'");

                    }

                }

            }

            if (type === 'string') {

                index = serializeString(buffer, key, value, index);

            }

            else if (type === 'number') {

                index = serializeNumber(buffer, key, value, index);

            }

            else if (type === 'bigint') {

                index = serializeBigInt(buffer, key, value, index);

            }

            else if (type === 'boolean') {

                index = serializeBoolean(buffer, key, value, index);

            }

            else if (value instanceof Date || isDate(value)) {

                index = serializeDate(buffer, key, value, index);

            }

            else if (value === undefined) {

                if (ignoreUndefined === false)

                    index = serializeNull(buffer, key, value, index);

            }

            else if (value === null) {

                index = serializeNull(buffer, key, value, index);

            }

            else if (isUint8Array(value)) {

                index = serializeBuffer(buffer, key, value, index);

            }

            else if (value instanceof RegExp || isRegExp(value)) {

                index = serializeRegExp(buffer, key, value, index);

            }

            else if (type === 'object' && value._bsontype == null) {

                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (typeof value === 'object' &&

                value[Symbol.for('@@mdb.bson.version')] !== BSON_MAJOR_VERSION) {

                throw new BSONVersionError();

            }

            else if (value._bsontype === 'ObjectId') {

                index = serializeObjectId(buffer, key, value, index);

            }

            else if (type === 'object' && value._bsontype === 'Decimal128') {

                index = serializeDecimal128(buffer, key, value, index);

            }

            else if (value._bsontype === 'Long' || value._bsontype === 'Timestamp') {

                index = serializeLong(buffer, key, value, index);

            }

            else if (value._bsontype === 'Double') {

                index = serializeDouble(buffer, key, value, index);

            }

            else if (value._bsontype === 'Code') {

                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, path);

            }

            else if (typeof value === 'function' && serializeFunctions) {

                index = serializeFunction(buffer, key, value, index);

            }

            else if (value._bsontype === 'Binary') {

                index = serializeBinary(buffer, key, value, index);

            }

            else if (value._bsontype === 'BSONSymbol') {

                index = serializeSymbol(buffer, key, value, index);

            }

            else if (value._bsontype === 'DBRef') {

                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions, path);

            }

            else if (value._bsontype === 'BSONRegExp') {

                index = serializeBSONRegExp(buffer, key, value, index);

            }

            else if (value._bsontype === 'Int32') {

                index = serializeInt32(buffer, key, value, index);

            }

            else if (value._bsontype === 'MinKey' || value._bsontype === 'MaxKey') {

                index = serializeMinMax(buffer, key, value, index);

            }

            else if (typeof value._bsontype !== 'undefined') {

                throw new BSONError(`Unrecognized or invalid _bsontype: ${String(value._bsontype)}`);

            }

        }

    }

    path.delete(object);

    buffer[index++] = 0x00;

    const size = index - startingIndex;

    buffer[startingIndex++] = size & 0xff;

    buffer[startingIndex++] = (size >> 8) & 0xff;

    buffer[startingIndex++] = (size >> 16) & 0xff;

    buffer[startingIndex++] = (size >> 24) & 0xff;

    return index;

}



function isBSONType(value) {

    return (value != null &&

        typeof value === 'object' &&

        '_bsontype' in value &&

        typeof value._bsontype === 'string');

}

const keysToCodecs = {

    $oid: ObjectId,

    $binary: Binary,

    $uuid: Binary,

    $symbol: BSONSymbol,

    $numberInt: Int32,

    $numberDecimal: Decimal128,

    $numberDouble: Double,

    $numberLong: Long,

    $minKey: MinKey,

    $maxKey: MaxKey,

    $regex: BSONRegExp,

    $regularExpression: BSONRegExp,

    $timestamp: Timestamp

};

function deserializeValue(value, options = {}) {

    if (typeof value === 'number') {

        const in32BitRange = value <= BSON_INT32_MAX && value >= BSON_INT32_MIN;

        const in64BitRange = value <= BSON_INT64_MAX && value >= BSON_INT64_MIN;

        if (options.relaxed || options.legacy) {

            return value;

        }

        if (Number.isInteger(value) && !Object.is(value, -0)) {

            if (in32BitRange) {

                return new Int32(value);

            }

            if (in64BitRange) {

                if (options.useBigInt64) {

                    return BigInt(value);

                }

                return Long.fromNumber(value);

            }

        }

        return new Double(value);

    }

    if (value == null || typeof value !== 'object')

        return value;

    if (value.$undefined)

        return null;

    const keys = Object.keys(value).filter(k => k.startsWith('$') && value[k] != null);

    for (let i = 0; i < keys.length; i++) {

        const c = keysToCodecs[keys[i]];

        if (c)

            return c.fromExtendedJSON(value, options);

    }

    if (value.$date != null) {

        const d = value.$date;

        const date = new Date();

        if (options.legacy) {

            if (typeof d === 'number')

                date.setTime(d);

            else if (typeof d === 'string')

                date.setTime(Date.parse(d));

            else if (typeof d === 'bigint')

                date.setTime(Number(d));

            else

                throw new BSONRuntimeError(`Unrecognized type for EJSON date: ${typeof d}`);

        }

        else {

            if (typeof d === 'string')

                date.setTime(Date.parse(d));

            else if (Long.isLong(d))

                date.setTime(d.toNumber());

            else if (typeof d === 'number' && options.relaxed)

                date.setTime(d);

            else if (typeof d === 'bigint')

                date.setTime(Number(d));

            else

                throw new BSONRuntimeError(`Unrecognized type for EJSON date: ${typeof d}`);

        }

        return date;

    }

    if (value.$code != null) {

        const copy = Object.assign({}, value);

        if (value.$scope) {

            copy.$scope = deserializeValue(value.$scope);

        }

        return Code.fromExtendedJSON(value);

    }

    if (isDBRefLike(value) || value.$dbPointer) {

        const v = value.$ref ? value : value.$dbPointer;

        if (v instanceof DBRef)

            return v;

        const dollarKeys = Object.keys(v).filter(k => k.startsWith('$'));

        let valid = true;

        dollarKeys.forEach(k => {

            if (['$ref', '$id', '$db'].indexOf(k) === -1)

                valid = false;

        });

        if (valid)

            return DBRef.fromExtendedJSON(v);

    }

    return value;

}

function serializeArray(array, options) {

    return array.map((v, index) => {

        options.seenObjects.push({ propertyName: `index ${index}`, obj: null });

        try {

            return serializeValue(v, options);

        }

        finally {

            options.seenObjects.pop();

        }

    });

}

function getISOString(date) {

    const isoStr = date.toISOString();

    return date.getUTCMilliseconds() !== 0 ? isoStr : isoStr.slice(0, -5) + 'Z';

}

function serializeValue(value, options) {

    if (value instanceof Map || isMap(value)) {

        const obj = Object.create(null);

        for (const [k, v] of value) {

            if (typeof k !== 'string') {

                throw new BSONError('Can only serialize maps with string keys');

            }

            obj[k] = v;

        }

        return serializeValue(obj, options);

    }

    if ((typeof value === 'object' || typeof value === 'function') && value !== null) {

        const index = options.seenObjects.findIndex(entry => entry.obj === value);

        if (index !== -1) {

            const props = options.seenObjects.map(entry => entry.propertyName);

            const leadingPart = props

                .slice(0, index)

                .map(prop => `${prop} -> `)

                .join('');

            const alreadySeen = props[index];

            const circularPart = ' -> ' +

                props

                    .slice(index + 1, props.length - 1)

                    .map(prop => `${prop} -> `)

                    .join('');

            const current = props[props.length - 1];

            const leadingSpace = ' '.repeat(leadingPart.length + alreadySeen.length / 2);

            const dashes = '-'.repeat(circularPart.length + (alreadySeen.length + current.length) / 2 - 1);

            throw new BSONError('Converting circular structure to EJSON:\n' +

                `    ${leadingPart}${alreadySeen}${circularPart}${current}\n` +

                `    ${leadingSpace}\\${dashes}/`);

        }

        options.seenObjects[options.seenObjects.length - 1].obj = value;

    }

    if (Array.isArray(value))

        return serializeArray(value, options);

    if (value === undefined)

        return null;

    if (value instanceof Date || isDate(value)) {

        const dateNum = value.getTime(), inRange = dateNum > -1 && dateNum < 253402318800000;

        if (options.legacy) {

            return options.relaxed && inRange

                ? { $date: value.getTime() }

                : { $date: getISOString(value) };

        }

        return options.relaxed && inRange

            ? { $date: getISOString(value) }

            : { $date: { $numberLong: value.getTime().toString() } };

    }

    if (typeof value === 'number' && (!options.relaxed || !isFinite(value))) {

        if (Number.isInteger(value) && !Object.is(value, -0)) {

            if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {

                return { $numberInt: value.toString() };

            }

            if (value >= BSON_INT64_MIN && value <= BSON_INT64_MAX) {

                return { $numberLong: value.toString() };

            }

        }

        return { $numberDouble: Object.is(value, -0) ? '-0.0' : value.toString() };

    }

    if (typeof value === 'bigint') {

        if (!options.relaxed) {

            return { $numberLong: BigInt.asIntN(64, value).toString() };

        }

        return Number(BigInt.asIntN(64, value));

    }

    if (value instanceof RegExp || isRegExp(value)) {

        let flags = value.flags;

        if (flags === undefined) {

            const match = value.toString().match(/[gimuy]*$/);

            if (match) {

                flags = match[0];

            }

        }

        const rx = new BSONRegExp(value.source, flags);

        return rx.toExtendedJSON(options);

    }

    if (value != null && typeof value === 'object')

        return serializeDocument(value, options);

    return value;

}

const BSON_TYPE_MAPPINGS = {

    Binary: (o) => new Binary(o.value(), o.sub_type),

    Code: (o) => new Code(o.code, o.scope),

    DBRef: (o) => new DBRef(o.collection || o.namespace, o.oid, o.db, o.fields),

    Decimal128: (o) => new Decimal128(o.bytes),

    Double: (o) => new Double(o.value),

    Int32: (o) => new Int32(o.value),

    Long: (o) => Long.fromBits(o.low != null ? o.low : o.low_, o.low != null ? o.high : o.high_, o.low != null ? o.unsigned : o.unsigned_),

    MaxKey: () => new MaxKey(),

    MinKey: () => new MinKey(),

    ObjectId: (o) => new ObjectId(o),

    BSONRegExp: (o) => new BSONRegExp(o.pattern, o.options),

    BSONSymbol: (o) => new BSONSymbol(o.value),

    Timestamp: (o) => Timestamp.fromBits(o.low, o.high)

};

function serializeDocument(doc, options) {

    if (doc == null || typeof doc !== 'object')

        throw new BSONError('not an object instance');

    const bsontype = doc._bsontype;

    if (typeof bsontype === 'undefined') {

        const _doc = {};

        for (const name of Object.keys(doc)) {

            options.seenObjects.push({ propertyName: name, obj: null });

            try {

                const value = serializeValue(doc[name], options);

                if (name === '__proto__') {

                    Object.defineProperty(_doc, name, {

                        value,

                        writable: true,

                        enumerable: true,

                        configurable: true

                    });

                }

                else {

                    _doc[name] = value;

                }

            }

            finally {

                options.seenObjects.pop();

            }

        }

        return _doc;

    }

    else if (doc != null &&

        typeof doc === 'object' &&

        typeof doc._bsontype === 'string' &&

        doc[Symbol.for('@@mdb.bson.version')] !== BSON_MAJOR_VERSION) {

        throw new BSONVersionError();

    }

    else if (isBSONType(doc)) {

        let outDoc = doc;

        if (typeof outDoc.toExtendedJSON !== 'function') {

            const mapper = BSON_TYPE_MAPPINGS[doc._bsontype];

            if (!mapper) {

                throw new BSONError('Unrecognized or invalid _bsontype: ' + doc._bsontype);

            }

            outDoc = mapper(outDoc);

        }

        if (bsontype === 'Code' && outDoc.scope) {

            outDoc = new Code(outDoc.code, serializeValue(outDoc.scope, options));

        }

        else if (bsontype === 'DBRef' && outDoc.oid) {

            outDoc = new DBRef(serializeValue(outDoc.collection, options), serializeValue(outDoc.oid, options), serializeValue(outDoc.db, options), serializeValue(outDoc.fields, options));

        }

        return outDoc.toExtendedJSON(options);

    }

    else {

        throw new BSONError('_bsontype must be a string, but was: ' + typeof bsontype);

    }

}

function parse(text, options) {

    const ejsonOptions = {

        useBigInt64: options?.useBigInt64 ?? false,

        relaxed: options?.relaxed ?? true,

        legacy: options?.legacy ?? false

    };

    return JSON.parse(text, (key, value) => {

        if (key.indexOf('\x00') !== -1) {

            throw new BSONError(`BSON Document field names cannot contain null bytes, found: ${JSON.stringify(key)}`);

        }

        return deserializeValue(value, ejsonOptions);

    });

}

function stringify(value, replacer, space, options) {

    if (space != null && typeof space === 'object') {

        options = space;

        space = 0;

    }

    if (replacer != null && typeof replacer === 'object' && !Array.isArray(replacer)) {

        options = replacer;

        replacer = undefined;

        space = 0;

    }

    const serializeOptions = Object.assign({ relaxed: true, legacy: false }, options, {

        seenObjects: [{ propertyName: '(root)', obj: null }]

    });

    const doc = serializeValue(value, serializeOptions);

    return JSON.stringify(doc, replacer, space);

}

function EJSONserialize(value, options) {

    options = options || {};

    return JSON.parse(stringify(value, options));

}

function EJSONdeserialize(ejson, options) {

    options = options || {};

    return parse(JSON.stringify(ejson), options);

}

const EJSON = Object.create(null);

EJSON.parse = parse;

EJSON.stringify = stringify;

EJSON.serialize = EJSONserialize;

EJSON.deserialize = EJSONdeserialize;

Object.freeze(EJSON);



const MAXSIZE = 1024 * 1024 * 17;

let buffer = ByteUtils.allocate(MAXSIZE);

function setInternalBufferSize(size) {

    if (buffer.length < size) {

        buffer = ByteUtils.allocate(size);

    }

}

function serialize(object, options = {}) {

    const checkKeys = typeof options.checkKeys === 'boolean' ? options.checkKeys : false;

    const serializeFunctions = typeof options.serializeFunctions === 'boolean' ? options.serializeFunctions : false;

    const ignoreUndefined = typeof options.ignoreUndefined === 'boolean' ? options.ignoreUndefined : true;

    const minInternalBufferSize = typeof options.minInternalBufferSize === 'number' ? options.minInternalBufferSize : MAXSIZE;

    if (buffer.length < minInternalBufferSize) {

        buffer = ByteUtils.allocate(minInternalBufferSize);

    }

    const serializationIndex = serializeInto(buffer, object, checkKeys, 0, 0, serializeFunctions, ignoreUndefined, null);

    const finishedBuffer = ByteUtils.allocate(serializationIndex);

    finishedBuffer.set(buffer.subarray(0, serializationIndex), 0);

    return finishedBuffer;

}

function serializeWithBufferAndIndex(object, finalBuffer, options = {}) {

    const checkKeys = typeof options.checkKeys === 'boolean' ? options.checkKeys : false;

    const serializeFunctions = typeof options.serializeFunctions === 'boolean' ? options.serializeFunctions : false;

    const ignoreUndefined = typeof options.ignoreUndefined === 'boolean' ? options.ignoreUndefined : true;

    const startIndex = typeof options.index === 'number' ? options.index : 0;

    const serializationIndex = serializeInto(buffer, object, checkKeys, 0, 0, serializeFunctions, ignoreUndefined, null);

    finalBuffer.set(buffer.subarray(0, serializationIndex), startIndex);

    return startIndex + serializationIndex - 1;

}

function deserialize(buffer, options = {}) {

    return internalDeserialize(ByteUtils.toLocalBufferType(buffer), options);

}

function calculateObjectSize(object, options = {}) {

    options = options || {};

    const serializeFunctions = typeof options.serializeFunctions === 'boolean' ? options.serializeFunctions : false;

    const ignoreUndefined = typeof options.ignoreUndefined === 'boolean' ? options.ignoreUndefined : true;

    return internalCalculateObjectSize(object, serializeFunctions, ignoreUndefined);

}

function deserializeStream(data, startIndex, numberOfDocuments, documents, docStartIndex, options) {

    const internalOptions = Object.assign({ allowObjectSmallerThanBufferSize: true, index: 0 }, options);

    const bufferData = ByteUtils.toLocalBufferType(data);

    let index = startIndex;

    for (let i = 0; i < numberOfDocuments; i++) {

        const size = bufferData[index] |

            (bufferData[index + 1] << 8) |

            (bufferData[index + 2] << 16) |

            (bufferData[index + 3] << 24);

        internalOptions.index = index;

        documents[docStartIndex + i] = internalDeserialize(bufferData, internalOptions);

        index = index + size;

    }

    return index;

}



var bson = /*#__PURE__*/Object.freeze({

__proto__: null,

BSONError: BSONError,

BSONRegExp: BSONRegExp,

BSONRuntimeError: BSONRuntimeError,

BSONSymbol: BSONSymbol,

BSONType: BSONType,

BSONValue: BSONValue,

BSONVersionError: BSONVersionError,

Binary: Binary,

Code: Code,

DBRef: DBRef,

Decimal128: Decimal128,

Double: Double,

EJSON: EJSON,

Int32: Int32,

Long: Long,

MaxKey: MaxKey,

MinKey: MinKey,

ObjectId: ObjectId,

Timestamp: Timestamp,

UUID: UUID,

calculateObjectSize: calculateObjectSize,

deserialize: deserialize,

deserializeStream: deserializeStream,

serialize: serialize,

serializeWithBufferAndIndex: serializeWithBufferAndIndex,

setInternalBufferSize: setInternalBufferSize

});



exports.BSON = bson;

exports.BSONError = BSONError;

exports.BSONRegExp = BSONRegExp;

exports.BSONRuntimeError = BSONRuntimeError;

exports.BSONSymbol = BSONSymbol;

exports.BSONType = BSONType;

exports.BSONValue = BSONValue;

exports.BSONVersionError = BSONVersionError;

exports.Binary = Binary;

exports.Code = Code;

exports.DBRef = DBRef;

exports.Decimal128 = Decimal128;

exports.Double = Double;

exports.EJSON = EJSON;

exports.Int32 = Int32;

exports.Long = Long;

exports.MaxKey = MaxKey;

exports.MinKey = MinKey;

exports.ObjectId = ObjectId;

exports.Timestamp = Timestamp;

exports.UUID = UUID;

exports.calculateObjectSize = calculateObjectSize;

exports.deserialize = deserialize;

exports.deserializeStream = deserializeStream;

exports.serialize = serialize;

exports.serializeWithBufferAndIndex = serializeWithBufferAndIndex;

exports.setInternalBufferSize = setInternalBufferSize;



return exports;



})({});

//# sourceMappingURL=bson.bundle.js.map

;

/* __XB_APP_SPLIT__: lib↑ core↓ */

!function(){"use strict";if(window.__xbMain)return;Object.defineProperty(window,"__xbMain",{value:!0,configurable:!1,enumerable:!1,writable:!1});const e={},t={summer_26_plaza_postcard:1,summer_26_beach_postcard:1,summer_26_desert_postcard:1,summer_26_post_minigame_plaza:1,summer_26_post_minigame_beach:1,summer_26_post_minigame_forest:1},n="SummerGreeting",o="Etkinlik \u0130mza (Yaz)",i=[{id:"StarGreeting",label:"Star Greeting",emoji:"\u2b50",diam:1,fame:100,sc:25,cdSec:900},{id:"LoveGreeting",label:"Love Greeting",emoji:"\ud83d\udc95",diam:5,fame:250,sc:150,cdSec:900},{id:"RainbowGreeting",label:"Rainbow Greeting",emoji:"\ud83c\udf08",diam:15,fame:900,sc:500,cdSec:900},{id:"PartyGreeting",label:"Party Greeting",emoji:"\ud83c\udf88",diam:25,fame:1750,sc:1e3,cdSec:1800},{id:"SuperStarGreeting",label:"Super Star Greeting",emoji:"\ud83c\udf1f",diam:50,fame:3500,sc:2500,cdSec:1800}];function r(e){return i.find(t=>t.id===e)||null}function a(e){try{return e.map(e=>atob(e)).join("")}catch{return""}}const s="",l="",c=window.BSON??null;try{delete window.BSON}catch{}if("BSON"in window)try{window.BSON=void 0}catch{}const d={nonce:"",homes:[],questions:{},emojis:null},p=[],u=[],f={version:"",source:"",uniqueCount:0,indexCount:0},m=new Map;function g(e){if(Array.isArray(e)){for(const t of e){if(!t||"string"!=typeof t.name||!t.name)continue;if(__hd().includes(t.name))continue;if(t.bundled&&!t.sourceNick)continue;if(!t.bson_data&&!t.sourceNick)continue;const e=p.findIndex(e=>e.name===t.name);if(e>=0){const n=p[e];p[e]={...n,...t,img:t.img&&String(t.img).length?t.img:n.img||"",bson_data:t.bson_data&&String(t.bson_data).length?t.bson_data:n.bson_data||"",bundled:!1}}else p.push({name:t.name,img:t.img||"",bson_data:t.bson_data||"",bundled:!1,hasBson:!1!==t.hasBson,sourceNick:t.sourceNick||"",sourceProfileId:t.sourceProfileId||"",sourceHomeId:t.sourceHomeId||"",harvestedAt:t.harvestedAt||0})}try{Q(p)}catch{}}}const h=new Map;const __BLOCKED_HOMES=new Set(["diamond_shop","easter_22_forest","fallback_room","halloween_21_forest","halloween_21_vip_club","myhome_basic","myhome_basic_2floor","myhome_bling_vip","spring_22_vip","summer_22_plaza","summer_festival_vip_club","under_the_sea","xmas_giftbox_vip"]);function y(e){const t=String(e||"").trim();if(!t)return Promise.reject(new Error("home name bos"));const n=p.find(e=>e.name===t);if(n&&n.bson_data)return Promise.resolve(n);if(h.has(t))return h.get(t);const o=`${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,i=new Promise((e,n)=>{const i=setTimeout(()=>{m.delete(o),n(new Error("ev bson timeout"))},2e4);m.set(o,{name:t,resolve:t=>{clearTimeout(i),e(t)},reject:e=>{clearTimeout(i),n(e)}});try{window.postMessage({__xbHome:1,dir:"req",reqId:o,name:t},window.location.origin)}catch(e){clearTimeout(i),m.delete(o),n(e)}}).finally(()=>{h.delete(t)});return h.set(t,i),i}function b(e){if(!e||"object"!=typeof e)return;d.emojis=e;const t=Array.isArray(e.emojis)?e.emojis:Array.isArray(e)?e:[];if(t.length){u.length=0;for(const e of t)e&&"string"==typeof e.e&&u.push(e);f.version=String(e.version||""),f.source=String(e.source||""),f.uniqueCount=Number(e.uniqueCount||u.length)||u.length,f.indexCount=Number(e.indexCount||0)||u.reduce((e,t)=>e+(Array.isArray(t.k)?t.k.length:0),0);try{cc()}catch{}try{Sc&&Sc()}catch{}}}window.__xbCatLoading=false;window.__xbCatFailed=false;window.__xbCatReady=false;window.__xbPackLoading=false;function __xbEnsureCatalog(){if(window.__xbCatReady||p.some(function(x){return x&&x.bundled}))return;if(window.__xbCatLoading)return;window.__xbCatLoading=true;window.__xbCatFailed=false;try{vs&&vs()}catch{}try{window.postMessage({__xbNeedCatalog:1,why:"panel"},window.location.origin)}catch(e){window.__xbCatLoading=false}}function __xbEnsurePack(){if(d.emojis)return;if(window.__xbPackLoading)return;window.__xbPackLoading=true;try{Sc&&Sc()}catch{}const o=Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);try{window.postMessage({__xbPack:1,dir:"req",reqId:o},window.location.origin)}catch(e){window.__xbPackLoading=false}}const __atv=(()=>{let __t=null;return()=>{clearTimeout(__t);__t=setTimeout(()=>{__t=null;try{vs&&vs()}catch{}},180)}})();window.addEventListener("message",t=>{if(t.source!==window)return;const n=t.data;if(!n||"object"!=typeof n)return;if(1===n.__xbHome&&"res"===n.dir&&"string"==typeof n.reqId){const e=m.get(n.reqId);if(!e)return;if(m.delete(n.reqId),n.ok&&n.home&&"string"==typeof n.home.name){const __f=n.home,__ix=p.findIndex(x=>x.name===__f.name);if(__ix>=0){const __c=p[__ix];p[__ix]={...__c,...__f,img:__f.img&&String(__f.img).length?__f.img:__c.img||"",bson_data:__f.bson_data&&String(__f.bson_data).length?__f.bson_data:__c.bson_data||"",bundled:__c.bson_data&&String(__c.bson_data).length?!!__c.bundled:!!__f.bundled}}else g([__f]);const t=p.find(e=>e.name===__f.name)||__f;try{e.resolve(t)}catch{}try{__atv()}catch{}}else try{e.reject(new Error(n.error||"ev bson yuklenemedi"))}catch{}return}if(1===n.__xbCatalog&&"res"===n.dir){if(n.pending){window.__xbCatLoading=true;window.__xbCatFailed=false;try{vs&&vs()}catch{}return}window.__xbCatLoading=false;if(!n.ok){window.__xbCatFailed=true;window.__xbCatReady=false;try{vs&&vs()}catch{}return}window.__xbCatFailed=false;window.__xbCatReady=true;try{vs&&vs()}catch{}return}if(1===n.__xbPack&&"res"===n.dir){window.__xbPackLoading=false;if(!n.ok||!n.emojis){try{Sc&&Sc()}catch{}return}return void b(n.emojis)}const o=Object.keys(n);if(1!==o.length)return;const i=o[0];if(!/^[a-f0-9]{32}$/.test(i))return;const r=n[i];if(r&&"object"==typeof r&&Array.isArray(r.homes)&&"object"==typeof r.questions&&(!d.nonce||!p.some(function(x){return x&&x.bundled}))){d.nonce="string"==typeof r.nonce?r.nonce:i,d.questions=r.questions||{};try{Object.assign(e,d.questions)}catch{}r.emojis&&b(r.emojis);if(Array.isArray(r.homes)){for(const __h of r.homes){if(!__h||"string"!=typeof __h.name||__BLOCKED_HOMES.has(String(__h.name).toLowerCase())||__hd().includes(__h.name)||p.some(x=>x.name===__h.name))continue;p.push({name:__h.name,img:"string"==typeof __h.img&&__h.img?__h.img:"",bson_data:"",bundled:!0,hasBson:!!__h.hasBson,sourceNick:"",sourceProfileId:"",sourceHomeId:"",harvestedAt:0})}}window.__xbCatLoading=false;window.__xbCatFailed=false;window.__xbCatReady=true;try{vs&&vs()}catch{}const __ml=(__f)=>{if(!__f||"string"!=typeof __f.name)return;const __ix=p.findIndex(x=>x.name===__f.name);if(__ix>=0){const __c=p[__ix];p[__ix]={...__c,...__f,img:__f.img&&String(__f.img).length?__f.img:__c.img||"",bson_data:__f.bson_data&&String(__f.bson_data).length?__f.bson_data:__c.bson_data||""}}try{__atv()}catch{}};p.slice().forEach(function(__h,__i){if(!__h||!__h.bundled||__h.bson_data)return;const __go=()=>{if(p.some(x=>x.name===__h.name&&x.bson_data))return;y(__h.name).then(__ml).catch(()=>{})};setTimeout(__go,180+__i*140);setTimeout(__go,5e3+__i*140)})}});try{window.postMessage({__xbNeedBoot:1},"*")}catch(e){}const x="j68d";let k="https://eu.mspapis.com",w="https://ugc-eu.mspcdns.com",v=null;const S=/[\u200B-\u200F\u2060\u2062-\u2064\uFEFF\u00AD\u034F\u180E]/g,C=(Object.create(null),["f922447a43434c1f9e65ebdae0f3c194","5e2e86fda70b486986ab370a60ab5641","e80ab1526b0d4bd88c8d23619234969e","5ad1d1732a184c7db2c7d90826f75b02","953b2a98ee024bfeaa68697ba60a280e","cf7bc982a67b46ec99f231169b00fd65","66ff8292c1fa4d4892651c7da43af50c","882a76f6e7f84ac08820ca103e2628d1","b30198dab5dd44ab89e0aeee8bfb527f","5d2392e07bff4344836d31d319fb74ce"]),I=new Set(["daily_open_gift_normal","daily_open_gift_vip","daily_pet_pets","daily_spend_starcoins","daily_spend_diamonds"]),$=new Set(["quiz:chal","quiz:init","quiz:answer","quiz:result","quiz:start","quiz:end","quiz:score","quiz:question","game:state","game:start","game:end"]),B=6e4,z=new Uint8Array([137,80,78,71,13,10,26,10]),T=new Set(["IHDR","PLTE","IDAT","tRNS","IEND"]),L=(new Set(["IHDR","PLTE","tRNS","IDAT","IEND","iCCP","sRGB","gAMA","cHRM","sBIT","bKGD","hIST","tEXt","zTXt","iTXt","tIME"]),{6050:"13,99 \u20ac",14050:"39,99 \u20ac",42050:"77,99 \u20ac",42010:"77,99 \u20ac"}),P=new Set(["1002","6050","14050","42010","42050"]),M=(e=8)=>{const t=Array.from(crypto.getRandomValues(new Uint8Array(e))).map(e=>e.toString(36)).join("");return/^\d/.test(t)?"x"+t:t},A={wrap:M(),body:M(),fonts:M(),kf:M(),pkgList:M(),pkgFloat:M(),mood:M(),status:M(),outfitTarget:M(),roomTp:M(),toasts:M(),agFloat:M(),homes:M(),crScroll:M(),restoreFloat:M(),restoreList:M(),friendsFloat:M()};let E=null,D=null;function j(){return D||(document.body?(E=document.createElement("div"),E.setAttribute("data-xb-host","1"),document.body.appendChild(E),D=E.attachShadow({mode:"closed"}),D):null)}const F="_xb_prefs_v1",_={theme:"th",chat:"cf",autoLiker:"al",cleanConsole:"cc",hidePlayers:"hp",invisJoin:"iv",spCrystals:"sc",spMessages:"sm",spAccept:"sa",spReject:"sr",spDelLvl:"sdl",spDelVip:"sdv",spAutoLiker:"sal",emojiFav:"ef",emojiUsage:"eu",dmSpamOn:"dso",dmSpamLevel:"dsl",dmSpamWorker:"dsw",dmSpamBatch:"dsb",dmSpamAutoLock:"dsa",dmSpamFlood:"dsf",dmSpamQuiet:"dsq",dmSpamLeave:"dslv",dmSpamMode:"dsm",dmSpamInstant:"dsi",dmSpamRuleLink:"dsrl",dmSpamRuleAd:"dsra",dmSpamRuleKw:"dsrk",dmSpamShield:"dss",dmSpamLeaveFirst:"dslf",dmSpamRejectFr:"dsrf",dmSpamBlockFr:"dsbf",dmSpamBlockConc:"dsbc",syncEndpoint:"tbu",syncSecret:"tbk",syncEnabled:"tbo",rlUiOn:"ruo",lang:"lg",moodsSaved:"ms",moodLast:"ml",moodByProfile:"mbp",moodLock:"mlk",waydByProfile:"wbp",homesDb:"hd",homesSelected:"hsel",homesDeleted:"hdel",statusDraft:"std",uiTab:"utab",lastAction:"lact",petCaptures:"pc",uiCompact:"uic",uiSound:"uis",panelTitle:"ptt",panelOpacity:"pop",panelFont:"pfn",dmSpamAdapt:"dsa2"},R="_xb_homes_v1";let O=null;function U(){if(O)return O;try{const e=localStorage.getItem(F);O=e&&JSON.parse(e)||{}}catch{O={}}return O}function N(){try{localStorage.setItem(F,JSON.stringify(O||{}))}catch{}}const q=e=>{const t=U();return Object.prototype.hasOwnProperty.call(t,e)?t[e]:null},H=(e,t)=>{U()[e]=t,N()};!function(){try{if("2"===q("dscm"))return;const e=parseInt(q(_.dmSpamWorker),10);(!Number.isFinite(e)||e<=50)&&H(_.dmSpamWorker,"300");const t=parseInt(q(_.dmSpamBlockConc),10);(!Number.isFinite(t)||t<=200)&&H(_.dmSpamBlockConc,"2000");const n=parseInt(q(_.dmSpamBatch),10);(!Number.isFinite(n)||n>50)&&H(_.dmSpamBatch,"25");const o=parseInt(q(_.dmSpamFlood),10);Number.isFinite(o)||H(_.dmSpamFlood,"30"),null==q(_.dmSpamMode)&&H(_.dmSpamMode,"max"),H("dscm","2")}catch{}}();function __hd(){try{const e=U()[_.homesDeleted];return Array.isArray(e)?e:[]}catch{return[]}}const W=["very_slow","slow","normal","fast","very_fast"],G={very_slow:2,slow:1.5,normal:1,fast:.5,very_fast:.25},V={get very_slow(){return re("speed_very_slow")},get slow(){return re("speed_slow")},get normal(){return re("speed_normal")},get fast(){return re("speed_fast")},get very_fast(){return re("speed_very_fast")}},K={crystals:_.spCrystals,messages:_.spMessages,acceptFriends:_.spAccept,rejectFriends:_.spReject,deleteFriendsLevel:_.spDelLvl,deleteFriendsVip:_.spDelVip,autoLiker:_.spAutoLiker};function J(e){const t=q(K[e]);return W.includes(t)?t:"normal"}function Y(e,t){W.includes(t)&&H(K[e],t)}function Q(e){if(!Array.isArray(e))return;const t=function(e){return(e||[]).filter(e=>e&&e.name&&!e.bundled&&e.bson_data).map(e=>({name:e.name,img:"string"==typeof e.img?e.img:"",bson_data:e.bson_data||"",bundled:!1,hasBson:!1!==e.hasBson,sourceNick:e.sourceNick||"",sourceProfileId:e.sourceProfileId||"",sourceHomeId:e.sourceHomeId||"",harvestedAt:e.harvestedAt||0}))}(e);let n=!1;try{localStorage.setItem(R,JSON.stringify(t)),n=!0}catch{try{const e=t.map(e=>({...e,img:""}));localStorage.setItem(R,JSON.stringify(e)),n=!0}catch{}}try{n&&H(_.homesDb,t.map(e=>({name:e.name,harvestedAt:e.harvestedAt||0})))}catch{}}function X(){try{const e=q(_.homesSelected);return e?String(e):""}catch{return""}}function Z(e){try{const t=String(e||"").trim();if(t)H(_.homesSelected,t);else try{delete U()[_.homesSelected],N()}catch{}}catch{}}function ee(){try{const e=function(){try{const e=localStorage.getItem(R);if(e){const t=JSON.parse(e);if(Array.isArray(t)&&t.length)return t}}catch{}try{const e=q(_.homesDb);return Array.isArray(e)?e:null}catch{return null}}();return e&&e.length&&(void 0!==p&&Array.isArray(p))?(g(e.filter(e=>e&&"string"==typeof e.name&&e.name&&!e.bundled&&e.bson_data)),p.length):0}catch{return 0}}try{ee()}catch{}const te=[{code:"tr",short:"TR",name:"T\xfcrk\xe7e"},{code:"en",short:"EN",name:"English"},{code:"de",short:"DE",name:"Deutsch"},{code:"fr",short:"FR",name:"Fran\xe7ais"},{code:"es",short:"ES",name:"Espa\xf1ol"},{code:"pt",short:"PT",name:"Portugu\xeas"},{code:"pl",short:"PL",name:"Polski"},{code:"nl",short:"NL",name:"Nederlands"},{code:"ru",short:"RU",name:"\u0420\u0443\u0441\u0441\u043a\u0438\u0439"},{code:"ar",short:"AR",name:"\u0627\u0644\u0639\u0631\u0628\u064a\u0629",rtl:!0}],ne="1.8.40",oe=(()=>{const e=(e,t,n,o,i,r,a,s,l,c)=>({tr:e,en:t,de:n,fr:o,es:i,pt:r,pl:a,nl:s,ru:l,ar:c});return{emoji_fav_hint:e("Sag tik ile kaydet / sil.","Right-click to save / remove.","Rechtsklick: speichern / entfernen.","Clic droit: enregistrer / retirer.","Clic derecho: guardar / quitar.","Clique direito: salvar / remover.","PPM: zapisz / usun.","Rechtsklik: opslaan / verwijderen.","PKM: sohranit / udalit.","Ibra yamin: hifz / izala."),emoji_top_hint:e("Sag tik ile kaydet veya en coktan cikar.","Right-click to save or remove from most used.","Rechtsklick: speichern oder aus Meistgenutzt entfernen.","Clic droit: enregistrer ou retirer des plus utilises.","Clic derecho: guardar o quitar de mas usados.","Clique direito: salvar ou remover dos mais usados.","PPM: zapisz lub usun z najczestszych.","Rechtsklik: opslaan of verwijderen uit meest gebruikt.","PKM: sohranit ili ubrat iz chastyh.","Ibra yamin: hifz aw izala min al-akthar."),emoji_none:e("Emoji bulunamadi.","No emoji found.","Kein Emoji gefunden.","Aucun emoji trouve.","No se encontro emoji.","Nenhum emoji encontrado.","Nie znaleziono emoji.","Geen emoji gevonden.","Emoji ne naydeno.","Lam yatim al-thur."),emoji_loading:e("Emoji verisi yukleniyor.","Loading emoji data.","Emoji-Daten werden geladen.","Chargement des emojis.","Cargando emojis.","Carregando emojis.","Ladowanie emoji.","Emoji worden geladen.","Zagruzka emoji.","Jari tahmil al-thur."),emoji_ctx_copy:e("Kopyala","Copy","Kopieren","Copier","Copiar","Copiar","Kopiuj","Kopiëren","Копировать","نسخ"),emoji_ctx_fav_add:e("Sık kullanılanlara kaydet","Save to favorites","In Favoriten speichern","Enregistrer dans les favoris","Guardar en favoritos","Salvar nos favoritos","Zapisz w ulubionych","Opslaan in favorieten","Сохранить в избранное","حفظ في المفضلة"),emoji_ctx_fav_del:e("Sık kullanılanlardan sil","Remove from favorites","Aus Favoriten entfernen","Retirer des favoris","Quitar de favoritos","Remover dos favoritos","Usuń z ulubionych","Verwijderen uit favorieten","Удалить из избранного","إزالة من المفضلة"),emoji_ctx_top_add:e("En çoğa kaydet","Save to most used","Zu Meistgenutzt","Enregistrer aux plus utilises","Guardar en mas usados","Salvar nos mais usados","Zapisz w najczestszych","Opslaan bij meest gebruikt","Sohranit v chastye","Hifz lil-akthar"),emoji_ctx_top_del:e("En çoktan çıkart","Remove from most used","Aus Meistgenutzt","Retirer des plus utilises","Quitar de mas usados","Remover dos mais usados","Usun z najczestszych","Verwijderen uit meest gebruikt","Ubrat iz chastyh","Izala min al-akthar"),fav_profile_info:e("Profil bilgisi","Profile info","Profilinfo","Infos profil","Info perfil","Info perfil","Info profilu","Profielinfo","Инфо профиля","معلومات الملف"),avatar_reset_warn:e("Oyundan çıkıp girince profil fotoğrafı ve takılı eşyalar sıfırlanabilir.","Profile photo and equipped items may reset after you leave and rejoin.","Profilbild und Ausrüstung können nach dem Neustart zurückgesetzt werden.","La photo et l'équipement peuvent se réinitialiser après reconnexion.","La foto y los objetos pueden reiniciarse al salir y entrar.","A foto e os itens podem resetar ao sair e entrar.","Zdjęcie i ekwipunek mogą się zresetować po wyjściu.","Profielfoto en items kunnen resetten na opnieuw inloggen.","Фото и экипировка могут сброситься после перезахода.","قد تُعاد صورة الملف والأغراض بعد الخروج والدخول."),avatar_upload:e("Yükle","Upload","Hochladen","Télécharger","Subir","Enviar","Prześlij","Uploaden","Загрузить","رفع"),mood_selected_prefix:e("Seçili: ","Selected: ","Gewählt: ","Sélection: ","Seleccionado: ","Selecionado: ","Wybrano: ","Geselecteerd: ","Выбрано: ","المختار: "),mood_none_selected:e("Henüz ruh hali seçilmedi","No mood selected yet","Noch keine Stimmung gewählt","Aucune humeur sélectionnée","Aún no hay humor seleccionado","Nenhum humor selecionado","Nie wybrano nastroju","Nog geen mood geselecteerd","Настроение ещё не выбрано","لم يُختر مزاج بعد"),mood_open_lib:e("Kütüphaneyi aç","Open library","Bibliothek öffnen","Ouvrir la bibliothèque","Abrir biblioteca","Abrir biblioteca","Otwórz bibliotekę","Open bibliotheek","Открыть библиотеку","افتح المكتبة"),mood_others_card:e("Başkasının ruh hali","Someone else's mood","Stimmung eines anderen","Humeur d'autrui","Humor de otro","Humor de outro","Nastrój kogoś","Mood van een ander","Чужое настроение","مزاج شخص آخر"),mood_others_hint:e("Nick yaz — ruh halini çekip kalıcı uygula.","Enter a nick — pull and apply permanently.","Nick eingeben — laden und dauerhaft anwenden.","Entre un nick — tire et applique durablement.","Escribe un nick — trae y aplica de forma permanente.","Digite um nick — puxe e aplique permanentemente.","Wpisz nick — pobierz i zastosuj trwale.","Vul een nick in — haal op en pas permanent toe.","Введи ник — загрузи и примени навсегда.","اكتب النك — اجلب وطبق بشكل دائم."),mood_apply_other:e("Ruh halini uygula","Apply mood","Stimmung anwenden","Appliquer l'humeur","Aplicar humor","Aplicar humor","Zastosuj nastrój","Mood toepassen","Применить настроение","تطبيق المزاج"),profile_info_card:e("Profil bilgisi","Profile info","Profilinfo","Infos profil","Info de perfil","Info do perfil","Info profilu","Profielinfo","Информация профиля","معلومات الملف"),profile_info_hint:e("Nick ile profil bilgisi.","Profile info by nick.","Profilinfo per Nick.","Infos profil par nick.","Info de perfil por nick.","Info do perfil por nick.","Info profilu po nicku.","Profielinfo via nick.","Инфо профиля по нику.","معلومات الملف بالنك."),profile_open_btn:e("Profili aç","Open profile","Profil öffnen","Ouvrir le profil","Abrir perfil","Abrir perfil","Otwórz profil","Open profiel","Открыть профиль","افتح الملف"),profile_copy_id:e("ID kopyala","Copy ID","ID kopieren","Copier l'ID","Copiar ID","Copiar ID","Kopiuj ID","Kopieer ID","Копировать ID","نسخ المعرّف"),tab_feedback:e("Öneri","Feedback","Feedback","Avis","Opinión","Feedback","Opinia","Feedback","Отзыв","اقتراح"),feedback_title:e("Öneri / Şikayet","Feedback","Feedback","Avis / Plainte","Opinión / Queja","Feedback","Opinia / Skarga","Feedback","Отзыв / Жалоба","اقتراح / شكوى"),feedback_hint:e("Panelin durumunu değerlendirin, öneri ve şikayetleriniz bizim için önemlidir.","Rate the panel — your suggestions and complaints matter to us.","Bewerte das Panel — deine Vorschläge und Beschwerden sind uns wichtig.","Évalue le panneau — vos suggestions et plaintes comptent pour nous.","Evalúa el panel — tus sugerencias y quejas son importantes.","Avalie o painel — suas sugestões e reclamações importam.","Oceń panel — twoje sugestie i skargi są dla nas ważne.","Beoordeel het panel — je suggesties en klachten zijn belangrijk.","Оцени панель — ваши предложения и жалобы важны для нас.","قيّم اللوحة — اقتراحاتك وشكاواك مهمة لنا."),feedback_send:e("Gönder","Send","Senden","Envoyer","Enviar","Enviar","Wyślij","Versturen","Отправить","إرسال"),feedback_ph:e("Öneri/şikayet yazabilirsiniz","You can write a suggestion or complaint","Schreibe einen Vorschlag oder eine Beschwerde","Écris une suggestion ou une plainte","Puedes escribir una sugerencia o queja","Você pode escrever uma sugestão ou reclamação","Możesz napisać sugestię lub skargę","Je kunt een suggestie of klacht schrijven","Можешь написать предложение или жалобу","يمكنك كتابة اقتراح أو شكوى"),feedback_short:e("En az 5 karakter yaz.","Write at least 5 characters.","Mindestens 5 Zeichen.","Au moins 5 caractères.","Mínimo 5 caracteres.","Mínimo 5 caracteres.","Minimum 5 znaków.","Minimaal 5 tekens.","Минимум 5 символов.","اكتب 5 أحرف على الأقل."),feedback_level:e("Lv 5+ gerekli.","Lv 5+ required.","Lv 5+ nötig.","Lv 5+ requis.","Lv 5+ requerido.","Lv 5+ necessário.","Wymagane Lv 5+.","Lv 5+ vereist.","Нужен Lv 5+.","مطلوب Lv 5+."),feedback_ok:e("Öneri/şikayetiniz bizlere ulaştı, teşekkürler!","Your feedback reached us, thank you!","Dein Feedback ist bei uns angekommen, danke!","Votre avis nous est parvenu, merci!","¡Tu opinión nos llegó, gracias!","Seu feedback chegou até nós, obrigado!","Twoja opinia do nas dotarła, dziękujemy!","Je feedback is bij ons aangekomen, bedankt!","Ваш отзыв до нас дошёл, спасибо!","وصلنا اقتراحك/شكواك، شكراً!"),feedback_fail:e("Gönderilemedi.","Could not send.","Senden fehlgeschlagen.","Envoi impossible.","No se pudo enviar.","Falha ao enviar.","Nie udało się wysłać.","Versturen mislukt.","Не удалось отправить.","فشل الإرسال."),feedback_need_login:e("Önce hesabına gir.","Log in first.","Zuerst einloggen.","Connecte-toi d'abord.","Inicia sesión primero.","Entre na conta primeiro.","Najpierw zaloguj się.","Log eerst in.","Сначала войди.","سجّل الدخول أولاً."),site_link:e("Site","Site","Seite","Site","Sitio","Site","Strona","Site","Sayt","Mawqi"),home_copy_title:e("EV KOPYALAMA","HOME COPY","HAUS KOPIE","COPIE MAISON","COPIA CASA","COPIA CASA","KOPIA DOMU","HUIS KOPIE","КОПИЯ ДОМА","نسخ المنزل"),home_copy_hint:e("Nick ile istediğiniz kişinin evini çekin.","Pull any player's home by nick.","Haus per Nick laden.","Tire la maison par nick.","Trae la casa por nick.","Puxe a casa pelo nick.","Pobierz dom po nicku.","Haal huis op via nick.","Загрузи дом по нику.","اجلب البيت بالنك."),mood_pick:e("Ruh hali sec","Pick mood","Stimmung waehlen","Choisir humeur","Elegir humor","Escolher humor","Wybierz nastroj","Kies mood","Vyberi nastroenie","Ikhtar al-mizaj"),mood_pull_btn:e("Ruh halini çek","Pull mood","Stimmung laden","Tirer l'humeur","Traer humor","Puxar humor","Pobierz nastrój","Mood ophalen","Загрузить настроение","اجلب المزاج"),mood_apply_this:e("Bu ruh halini uygula","Apply this mood","Diese Stimmung anwenden","Appliquer cette humeur","Aplicar este humor","Aplicar este humor","Zastosuj ten nastrój","Deze mood toepassen","Применить это настроение","تطبيق هذا المزاج"),avatar_pick_hint:e("Gorsel sec — yukle.","Pick image — upload.","Bild waehlen — hochladen.","Choisir image — envoyer.","Elige imagen — subir.","Escolha imagem — enviar.","Wybierz obraz — wyslij.","Kies beeld — upload.","Vyberi foto — zagruzi.","Ikhtar sura — arfa."),fav_imza:e("İmza","Autograph","Autogramm","Autographe","Autógrafo","Autógrafo","Autograf","Handtekening","Автограф","توقيع"),fav_ghost:e("Ghost","Ghost","Geist","Ghost","Ghost","Ghost","Duch","Ghost","Призрак","شبح"),fav_quests:e("Görev","Quests","Quests","Quêtes","Misiones","Missões","Zadania","Quests","Задания","مهام"),fav_emoji:e("Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","Эмодзи","إيموجي"),fav_profile:e("Profil","Profile","Profil","Profil","Perfil","Perfil","Profil","Profiel","Профиль","الملف"),fav_vip:e("VIP","VIP","VIP","VIP","VIP","VIP","VIP","VIP","VIP","VIP"),room_photo:e("ODA RESMİ","ROOM PHOTO","ZIMMERBILD","PHOTO SALON","FOTO HABITACIÓN","FOTO SALA","ZDJECIE POKOJU","KAMERFOTO","ФОТО КОМНАТЫ","صورة الغرفة"),room_photo_hint:e("Ev / oda resmi oyundan çıkıp girince kaybolmaz.","House / room photo stays after rejoin.","Haus-/Raumbild bleibt nach dem Rejoin.","La photo de salon reste apres reconnexion.","La foto de la habitacion no se pierde al salir.","A foto da sala permanece apos relogar.","Zdjecie pokoju zostaje po ponownym wejsciu.","Kamerfoto blijft na opnieuw joinen.","Foto komnaty sohranyaetsya posle perezehoda.","Surat al-ghurfa la takhtafi baad al-khuruj."),status_card:e("DURUM","STATUS","STATUS","STATUT","ESTADO","STATUS","STATUS","STATUS","СТАТУС","الحالة"),status_card_hint:e("Yeni durum paylaş veya eski durumu geri getir. Uyguladıktan sonra oyundan çık gir yapın. Beğeni/Yorum korunur","Share or restore a status. Rejoin the game after applying. Likes/comments are kept.","Neuen Status teilen oder alten wiederherstellen. Likes/Kommentare bleiben.","Partage un nouveau statut ou restaure lancien. Likes/commentaires conserves.","Comparte un estado nuevo o restaura el anterior. Se conservan likes/comentarios.","Compartilhe um status novo ou restaure o antigo. Curtidas/comentarios preservados.","Udostepnij nowy status lub przywroc stary. Polubienia/komentarze zostaja.","Deel een nieuwe status of herstel een oude. Likes/reacties blijven.","Novyy status ili vosstanovlenie starogo. Layki/kommentarii sohranyayutsya.","Shark haliya jadida aw istad al-qadima."),settings_sound:e("Ses efektleri","Sound effects","Soundeffekte","Effets sonores","Efectos de sonido","Efeitos sonoros","Efekty dzwiekowe","Geluidseffecten","Zvukovye effekty","Asar sawtiyya"),settings_sound_desc:e("Tum tiklamalarda yumusak tik sesi.","Soft click on every tap.","Sanfter Klickton bei jedem Tippen.","Clic doux a chaque appui.","Clic suave en cada toque.","Clique suave em cada toque.","Miekki klik przy kazdym nacisnieciu.","Zachte klik bij elke tik.","Myagkiy klik pri kazhdom nazhatii.","Naqra naima ma kulla dabsa."),settings_panel:e("Panel","Panel","Panel","Panneau","Panel","Painel","Panel","Paneel","Panel","Lawha"),settings_opacity:e("Panel şeffaflığı","Panel opacity","Paneltransparenz","Opacité du panneau","Opacidad del panel","Opacidade do painel","Przezroczystość panelu","Paneeldekking","Прозрачность панели","شفافية اللوحة"),settings_font:e("Yazı fontu","Text font","Schriftart","Police","Fuente","Fonte","Czcionka","Lettertype","Шрифт","الخط"),settings_font_hint:e("Tüm panel, sekme, buton ve yazılar. Kalıcı.","Whole panel, tabs, buttons and text. Saved.","Ganzes Panel, Tabs, Buttons und Text. Dauerhaft.","Tout le panneau, onglets, boutons et textes. Permanent.","Todo el panel, pestañas, botones y textos. Permanente.","Todo o painel, abas, botões e textos. Permanente.","Cały panel, karty, przyciski i teksty. Trwałe.","Hele paneel, tabbladen, knoppen en tekst. Blijvend.","Вся панель, вкладки, кнопки и тексты. Сохраняется.","كل اللوحة، التبويبات، الأزرار والنصوص. دائم."),brand_name:e("6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space","6x0k Space"),brand_sub:e("Oyun i\xe7i ara\xe7lar","Player tools","Spieler-Tools","Outils joueur","Herramientas","Ferramentas","Narz\u0119dzia","Speler tools","\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b","\u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0644\u0627\u0639\u0628"),settings:e("Ayarlar","Settings","Einstellungen","Param\xe8tres","Ajustes","Defini\xe7\xf5es","Ustawienia","Instellingen","\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438","\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"),minimize:e("K\xfc\xe7\xfclt","Minimize","Minimieren","R\xe9duire","Minimizar","Minimizar","Minimalizuj","Minimaliseren","\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c","\u062a\u0635\u063a\u064a\u0631"),theme_color:e("Tema Rengi","Theme Color","Themenfarbe","Couleur du th\xe8me","Color del tema","Cor do tema","Kolor motywu","Themakleur","\u0426\u0432\u0435\u0442 \u0442\u0435\u043c\u044b","\u0644\u0648\u0646 \u0627\u0644\u0645\u0638\u0647\u0631"),language:e("Dil","Language","Sprache","Langue","Idioma","Idioma","J\u0119zyk","Taal","\u042f\u0437\u044b\u043a","\u0627\u0644\u0644\u063a\u0629"),language_hint:e("Se\xe7 \u2014 panel an\u0131nda \xe7evrilir","Select \u2014 panel translates instantly","W\xe4hlen \u2014 Panel wird sofort \xfcbersetzt","Choisir \u2014 traduction imm\xe9diate","Elige \u2014 se traduce al instante","Escolha \u2014 traduz na hora","Wybierz \u2014 t\u0142umaczenie od razu","Kies \u2014 direct vertaald","\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u2014 \u043c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434","\u0627\u062e\u062a\u0631 \u2014 \u062a\u0631\u062c\u0645\u0629 \u0641\u0648\u0631\u064a\u0629"),lang_applied:e("Dil uyguland\u0131","Language applied","Sprache \xfcbernommen","Langue appliqu\xe9e","Idioma aplicado","Idioma aplicado","J\u0119zyk zastosowany","Taal toegepast","\u042f\u0437\u044b\u043a \u043f\u0440\u0438\u043c\u0435\u043d\u0451\u043d","\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0644\u063a\u0629"),tab_profile:e("Profil","Profile","Profil","Profil","Perfil","Perfil","Profil","Profiel","\u041f\u0440\u043e\u0444\u0438\u043b\u044c","\u0627\u0644\u0645\u0644\u0641"),tab_auto:e("Oto","Auto","Auto","Auto","Auto","Auto","Auto","Auto","\u0410\u0432\u0442\u043e","\u062a\u0644\u0642\u0627\u0626\u064a"),tab_friends:e("Arkada\u015f","Friends","Freunde","Amis","Amigos","Amigos","Znajomi","Vrienden","\u0414\u0440\u0443\u0437\u044c\u044f","\u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621"),tab_bots:e("Botlar","Bots","Bots","Bots","Bots","Bots","Boty","Bots","\u0411\u043e\u0442\u044b","\u0628\u0648\u062a\u0627\u062a"),tab_homes:e("EV","HOME","HOME","MAISON","CASA","CASA","DOM","HUIS","\u0414\u041e\u041c","\u0645\u0646\u0632\u0644"),tab_misc:e("Di\u011fer","Other","Sonstiges","Divers","Otros","Outros","Inne","Overig","\u0414\u0440\u0443\u0433\u043e\u0435","\u0623\u062e\u0631\u0649"),tab_emoji:e("Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","Emoji","\u042d\u043c\u043e\u0434\u0437\u0438","\u0625\u064a\u0645\u0648\u062c\u064a"),tab_spam:e("Spam","Spam","Spam","Spam","Spam","Spam","Spam","Spam","Спам","Spam"),tab_chat:e("Sohbet","Chat","Chat","Chat","Chat","Chat","Czat","Chat","\u0427\u0430\u0442","\u062f\u0631\u062f\u0634\u0629"),gender:e("Cinsiyet","Gender","Geschlecht","Genre","Género","Gênero","Płeć","Geslacht","Пол","الجنس"),gender_desc:e("Avatar cinsiyetini değiştir. Takılı eşyalar korunur; sonra oyundan çıkıp gir.","Change avatar gender. Equipped items stay. Rejoin the game after changing.","Avatar-Geschlecht ändern. Ausrüstung bleibt. Danach neu einloggen.","Changer le genre. Équipement conservé. Reconnecte-toi après.","Cambia el género. Objetos equipados se conservan. Vuelve a entrar.","Mudar gênero. Itens equipados ficam. Entre novamente depois.","Zmień płeć. Ekwipunek zostaje. Wejdź ponownie.","Geslacht wijzigen. Items blijven. Log opnieuw in.","Сменить пол. Вещи сохраняются. Перезайди в игру.","تغيير الجنس. تبقى العناصر. أعد الدخول."),gender_btn:e("Cinsiyeti değiştir","Change gender","Geschlecht ändern","Changer le genre","Cambiar género","Mudar gênero","Zmień płeć","Geslacht wijzigen","Сменить пол","تغيير الجنس"),mood:e("Ruh hali","Mood","Stimmung","Humeur","Ánimo","Humor","Nastrój","Stemming","Настроение","المزاج"),mood_desc:e("Soft / Normal kütüphaneden seç. Kalıcı bağ bu hesaba özeldir.","Soft / Normal library. Permanent bind is per account. After apply, open shop or change room.","Soft/Normal. Dauerhaft pro Konto. Danach Shop öffnen oder Raum wechseln.","Soft/Normal. Permanent par compte. Ensuite magasin ou changer de salle.","Soft/Normal. Permanente por cuenta. Luego tienda o cambia de sala.","Soft/Normal. Permanente por conta. Depois loja ou mude de sala.","Soft/Normal. Trwałe na konto. Potem sklep lub zmień pokój.","Soft/Normal. Permanent per account. Daarna shop of kamer wisselen.","Soft/Normal. Постоянно на аккаунт. Затем магазин или смени комнату.","Soft/Normal. دائم لكل حساب. ثم المتجر أو غيّر الغرفة."),mood_hint:e("Ayna ile kopyala \u2192 listeye eklenir. Her kayda isim ver, tek tek sil. Son ruh hali \xe7\u0131k\u0131\u015fta kal\u0131r.","Copy with mirror \u2192 list. Name each, delete one by one. Last mood keeps on exit.","Mit Spiegel kopieren \u2192 Liste. Benennen, einzeln l\xf6schen. Letzte Stimmung bleibt.","Copier avec miroir \u2192 liste. Nommer, supprimer un par un. Derni\xe8re humeur gard\xe9e.","Copia con espejo \u2192 lista. Nombra y borra uno a uno. \xdaltimo \xe1nimo se guarda.","Copie com espelho \u2192 lista. Nomeie e delete um a um. \xdaltimo humor fica.","Kopiuj lustrem \u2192 lista. Nazwij, usuwaj pojedynczo. Ostatni nastr\xf3j zostaje.","Kopieer met spiegel \u2192 lijst. Benoem, per stuk wissen. Laatste stemming blijft.","\u041a\u043e\u043f\u0438\u044f \u0437\u0435\u0440\u043a\u0430\u043b\u043e\u043c \u2192 \u0441\u043f\u0438\u0441\u043e\u043a. \u0418\u043c\u044f, \u0443\u0434\u0430\u043b\u044f\u0442\u044c \u043f\u043e \u043e\u0434\u043d\u043e\u043c\u0443. \u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f.","\u0627\u0646\u0633\u062e \u0628\u0627\u0644\u0645\u0631\u0622\u0629 \u2192 \u0627\u0644\u0642\u0627\u0626\u0645\u0629. \u0633\u0645\u0651\u0650 \u0648\u0627\u062d\u0630\u0641 \u0648\u0627\u062d\u062f\u0627\u064b \u0648\u0627\u062d\u062f\u0627\u064b. \u0622\u062e\u0631 \u0645\u0632\u0627\u062c \u064a\u0628\u0642\u0649."),apply:e("Uygula","Apply","Anwenden","Appliquer","Aplicar","Aplicar","Zastosuj","Toepassen","Применить","تطبيق"),status:e("Durum","Status","Status","Statut","Estado","Status","Status","Status","\u0421\u0442\u0430\u0442\u0443\u0441","\u0627\u0644\u062d\u0627\u0644\u0629"),status_desc:e('Önce oyunda bir kez durum kaydet; sonra buradan güncelle veya geri getir.',"First save \u201cWhat are you doing\u201d in-game (WAYD), then update here. LoveIt/comments stay.","Zuerst im Spiel \u201cWas machst du\u201d speichern (WAYD), dann hier updaten.","Enregistre d\u2019abord le statut en jeu (WAYD), puis mets \xe0 jour ici.","Guarda primero el estado en el juego (WAYD), luego actualiza aqu\xed.","Salve primeiro o status no jogo (WAYD), depois atualize aqui.","Najpierw zapisz status w grze (WAYD), potem zaktualizuj tutaj.","Sla eerst status in-game op (WAYD), werk hier bij.","\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438 \u0441\u0442\u0430\u0442\u0443\u0441 \u0432 \u0438\u0433\u0440\u0435 (WAYD), \u043f\u043e\u0442\u043e\u043c \u043e\u0431\u043d\u043e\u0432\u0438 \u0437\u0434\u0435\u0441\u044c.","\u0627\u062d\u0641\u0638 \u0627\u0644\u062d\u0627\u0644\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u0644\u0639\u0628\u0629 \u0623\u0648\u0644\u0627\u064b (WAYD) \u062b\u0645 \u062d\u062f\u0651\u062b \u0645\u0646 \u0647\u0646\u0627."),status_ph:e("Ne yap\u0131yorsun?","What are you doing?","Was machst du?","Que fais-tu ?","\xbfQu\xe9 haces?","O que est\xe1 fazendo?","Co robisz?","Wat doe je?","\u0427\u0435\u043c \u0437\u0430\u043d\u0438\u043c\u0430\u0435\u0448\u044c\u0441\u044f?","\u0645\u0627\u0630\u0627 \u062a\u0641\u0639\u0644\u061f"),status_update:e("Durumu kaydet","Save status","Status speichern","Enregistrer","Guardar estado","Salvar status","Zapisz status","Status opslaan","Сохранить статус","حفظ الحالة"),status_restore:e("Durumu geri getir","Restore status","Status wiederherstellen","Restaurer le statut","Restaurar estado","Restaurar status","Przywróć status","Status herstellen","Восстановить статус","استعادة الحالة"),avatar_title:e("Profil fotoğrafı","Profile photo","Profilbild","Photo de profil","Foto de perfil","Foto de perfil","Zdjęcie profilowe","Profielfoto","Фото профиля","صورة الملف"),avatar_desc:e("G\xf6rsel y\xfckle. B\xfcy\xfck \xf6l\xe7ek sunucu limitine kadar zorlar (PNG ~60KB).","Upload image. Large scale up to server limit (PNG ~60KB).","Bild hochladen. Gro\xdfe Skala bis Serverlimit.","Importer une image. Grande taille jusqu\u2019\xe0 la limite.","Sube imagen. Escala grande hasta el l\xedmite.","Envie imagem. Escala grande at\xe9 o limite.","Prze\u015blij obraz. Du\u017ca skala do limitu.","Upload afbeelding. Grote schaal tot limiet.","\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0444\u043e\u0442\u043e. \u041c\u0430\u0441\u0448\u0442\u0430\u0431 \u0434\u043e \u043b\u0438\u043c\u0438\u0442\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430.","\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629. \u0645\u0642\u064a\u0627\u0633 \u0643\u0628\u064a\u0631 \u062d\u062a\u0649 \u062d\u062f \u0627\u0644\u062e\u0627\u062f\u0645."),avatar_btn:e("Profil Foto\u011fraf\u0131 Yap","Set Profile Photo","Als Profilbild setzen","D\xe9finir la photo","Usar como foto","Definir foto","Ustaw zdj\u0119cie","Profielfoto zetten","\u041f\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0444\u043e\u0442\u043e","\u062a\u0639\u064a\u064a\u0646 \u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0644\u0641"),drop_hint:e("B\u0131rak veya se\xe7","Drop or choose","Ablegen oder w\xe4hlen","D\xe9poser ou choisir","Suelta o elige","Solte ou escolha","Upu\u015b\u0107 lub wybierz","Sleep of kies","\u041f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0438\u043b\u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435","\u0623\u0633\u0642\u0637 \u0623\u0648 \u0627\u062e\u062a\u0631"),scale:e("\xd6l\xe7ek","Scale","Skalierung","\xc9chelle","Escala","Escala","Skala","Schaal","\u041c\u0430\u0441\u0448\u0442\u0430\u0431","\u0627\u0644\u0645\u0642\u064a\u0627\u0633"),scale_std:e("standart","standard","Standard","standard","est\xe1ndar","padr\xe3o","standard","standaard","\u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442","\u0642\u064a\u0627\u0633\u064a"),scale_big:e("b\xfcy\xfck","large","gro\xdf","grand","grande","grande","du\u017ca","groot","\u0431\u043e\u043b\u044c\u0448\u043e\u0439","\u0643\u0628\u064a\u0631"),scale_xl:e("\xe7ok b\xfcy\xfck","very large","sehr gro\xdf","tr\xe8s grand","muy grande","muito grande","bardzo du\u017ca","zeer groot","\u043e\u0447\u0435\u043d\u044c \u0431\u043e\u043b\u044c\u0448\u043e\u0439","\u0643\u0628\u064a\u0631 \u062c\u062f\u0627\u064b"),scale_max:e("maks g\xfcvenli","max safe","max sicher","max s\xfbr","m\xe1x seguro","m\xe1x seguro","maks bezpieczna","max veilig","\u043c\u0430\u043a\u0441 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e","\u0623\u0642\u0635\u0649 \u0622\u0645\u0646"),scale_force:e("zorla","force","erzwingen","forcer","forzar","for\xe7ar","wymu\u015b","forceren","\u0444\u043e\u0440\u0441\u0438\u0440\u043e\u0432\u0430\u0442\u044c","\u0625\u062c\u0628\u0627\u0631"),scale_extreme:e("ekstrem \u2014 sunucu s\u0131n\u0131r\u0131na s\u0131k\u0131\u015ft\u0131r\u0131l\u0131r","extreme \u2014 compressed to server limit","extrem \u2014 auf Serverlimit komprimiert","extr\xeame \u2014 compress\xe9 \xe0 la limite","extremo \u2014 comprimido al l\xedmite","extremo \u2014 comprimido ao limite","ekstrem \u2014 do limitu serwera","extreem \u2014 gecomprimeerd tot limiet","\u044d\u043a\u0441\u0442\u0440\u0435\u043c\u0430\u043b\u044c\u043d\u043e \u2014 \u0434\u043e \u043b\u0438\u043c\u0438\u0442\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430","\u0645\u062a\u0637\u0631\u0641 \u2014 \u064a\u064f\u0636\u063a\u0637 \u0644\u062d\u062f \u0627\u0644\u062e\u0627\u062f\u0645"),scale_ultra:e("ultra \u2014 sunucu s\u0131n\u0131r\u0131na s\u0131k\u0131\u015ft\u0131r\u0131l\u0131r","ultra \u2014 compressed to server limit","ultra \u2014 Serverlimit","ultra \u2014 limite serveur","ultra \u2014 l\xedmite servidor","ultra \u2014 limite do servidor","ultra \u2014 limit serwera","ultra \u2014 serverlimiet","\u0443\u043b\u044c\u0442\u0440\u0430 \u2014 \u043b\u0438\u043c\u0438\u0442 \u0441\u0435\u0440\u0432\u0435\u0440\u0430","\u0641\u0627\u0626\u0642 \u2014 \u062d\u062f \u0627\u0644\u062e\u0627\u062f\u0645"),need_image:e("\xd6nce bir g\xf6rsel b\u0131rak veya se\xe7","Drop or choose an image first","Zuerst Bild ablegen oder w\xe4hlen","D\xe9posez ou choisissez une image","Suelta o elige una imagen primero","Solte ou escolha uma imagem","Najpierw upu\u015b\u0107 lub wybierz obraz","Sleep of kies eerst een afbeelding","\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0438\u043b\u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435","\u0623\u0633\u0642\u0637 \u0623\u0648 \u0627\u062e\u062a\u0631 \u0635\u0648\u0631\u0629 \u0623\u0648\u0644\u0627\u064b"),room_title:e("Oda Resmi (Kendi Ev)","Room Image (My Home)","Raumbild (Mein Zuhause)","Image de pi\xe8ce (Maison)","Imagen de sala (Mi casa)","Imagem do quarto (Minha casa)","Obraz pokoju (M\xf3j dom)","Kamerbeeld (Mijn huis)","\u0424\u043e\u0442\u043e \u043a\u043e\u043c\u043d\u0430\u0442\u044b (\u041c\u043e\u0439 \u0434\u043e\u043c)","\u0635\u0648\u0631\u0629 \u0627\u0644\u063a\u0631\u0641\u0629 (\u0645\u0646\u0632\u0644\u064a)"),room_desc:e("Varsay\u0131lan evinin \xf6nizleme/snapshot g\xf6rselini de\u011fi\u015ftir. B\xfcy\xfck \xf6l\xe7ek se\xe7ilebilir.","Change your default home preview/snapshot. Large scale available.","Standard-Home-Vorschau \xe4ndern. Gro\xdfe Skala m\xf6glich.","Changer l\u2019aper\xe7u de ta maison. Grande \xe9chelle possible.","Cambia la vista de tu casa. Escala grande disponible.","Altere a pr\xe9via da sua casa. Escala grande dispon\xedvel.","Zmie\u0144 podgl\u0105d domu. Du\u017ca skala dost\u0119pna.","Wijzig home-preview. Grote schaal mogelijk.","\u0421\u043c\u0435\u043d\u0438 \u043f\u0440\u0435\u0432\u044c\u044e \u0434\u043e\u043c\u0430. \u0411\u043e\u043b\u044c\u0448\u043e\u0439 \u043c\u0430\u0441\u0448\u0442\u0430\u0431 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.","\u063a\u064a\u0651\u0631 \u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u0646\u0632\u0644\u0643. \u0645\u0642\u064a\u0627\u0633 \u0643\u0628\u064a\u0631 \u0645\u062a\u0627\u062d."),room_btn:e("Oda Resmini Uygula","Apply Room Image","Raumbild anwenden","Appliquer l\u2019image","Aplicar imagen de sala","Aplicar imagem","Zastosuj obraz pokoju","Kamerbeeld toepassen","\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u043e\u0442\u043e \u043a\u043e\u043c\u043d\u0430\u0442\u044b","\u062a\u0637\u0628\u064a\u0642 \u0635\u0648\u0631\u0629 \u0627\u0644\u063a\u0631\u0641\u0629"),daily_quests:e("G\xfcnl\xfck G\xf6revler","Daily Quests","T\xe4gliche Quests","Qu\xeates quotidiennes","Misiones diarias","Miss\xf5es di\xe1rias","Codzienne misje","Dagelijkse quests","\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u043d\u0438\u044f","\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u064a\u0648\u0645\u064a\u0629"),daily_quests_desc:e("Hediye, pet ve challenge leaf questleri. Harcama (starcoin/elmas) g\xf6revleri atlan\u0131r \u2014 elle yap. Bazen tetiklenmezse tekrar bas; \xf6zet fail g\xf6sterir.","Gift, pet and challenge leaf quests. Spend quests (SC/diamond) skipped \u2014 do manually. Retry if stuck; summary shows fails.","Geschenk-/Pet-/Challenge-Quests. Ausgaben-Quests manuell. Bei H\xe4nger erneut; Zusammenfassung zeigt Fehler.","Qu\xeates cadeaux/pets/defis. D\xe9penses manuelles. R\xe9essaie si bloqu\xe9.","Misiones regalo/mascota/reto. Gasto manual. Reintenta si falla.","Miss\xf5es presente/pet/desafio. Gastos manuais. Tente de novo se travar.","Misje prezent/pet/wyzwanie. Wydatki r\u0119cznie. Pon\xf3w przy b\u0142\u0119dzie.","Cadeau-/pet-/challenge-quests. Uitgaven handmatig. Opnieuw bij vastlopen.","\u041a\u0432\u0435\u0441\u0442\u044b \u043f\u043e\u0434\u0430\u0440\u043a\u043e\u0432/\u043f\u0438\u0442\u043e\u043c\u0446\u0435\u0432/\u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0435\u0439. \u0422\u0440\u0430\u0442\u044b \u0432\u0440\u0443\u0447\u043d\u0443\u044e. \u041f\u043e\u0432\u0442\u043e\u0440\u0438 \u043f\u0440\u0438 \u0441\u0431\u043e\u0435.","\u0645\u0647\u0627\u0645 \u0627\u0644\u0647\u062f\u0627\u064a\u0627/\u0627\u0644\u062d\u064a\u0648\u0627\u0646\u0627\u062a/\u0627\u0644\u062a\u062d\u062f\u064a\u0627\u062a. \u0645\u0647\u0627\u0645 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u064a\u062f\u0648\u064a\u0627\u064b. \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0639\u0646\u062f \u0627\u0644\u062a\u0639\u062b\u0631."),quests_run:e("G\xf6revleri \xc7al\u0131\u015ft\u0131r","Run Quests","Quests starten","Lancer les qu\xeates","Ejecutar misiones","Executar miss\xf5es","Uruchom misje","Quests starten","\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u043a\u0432\u0435\u0441\u0442\u044b","\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0647\u0627\u0645"),quests_done:e("{n} bitti","{n} done","{n} fertig","{n} termin\xe9es","{n} hechas","{n} feitas","{n} gotowe","{n} klaar","{n} \u0433\u043e\u0442\u043e\u0432\u043e","{n} \u062a\u0645"),event_collect:e("Hepsini Topla","Collect All","Alles sammeln","Tout collecter","Recoger todo","Coletar tudo","Zbierz wszystko","Alles verzamelen","\u0421\u043e\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0451","\u0627\u062c\u0645\u0639 \u0627\u0644\u0643\u0644"),event_gear:e("Etkinlik","Event","Event","\xc9v\xe9nement","Evento","Evento","Wydarzenie","Evenement","\u0421\u043e\u0431\u044b\u0442\u0438\u0435","\u0641\u0639\u0627\u0644\u064a\u0629"),unread_title:e("Okunmam\u0131\u015f Mesajlar","Unread Messages","Ungelesene Nachrichten","Messages non lus","Mensajes no le\xeddos","Mensagens n\xe3o lidas","Nieprzeczytane","Ongelezen berichten","\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435","\u0631\u0633\u0627\u0626\u0644 \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629"),unread_desc:e("T\xfcm okunmam\u0131\u015f konu\u015fmalar\u0131 tek t\u0131kla okundu yap. Bildirim rozetlerini temizler.","Mark all unread threads as read in one click. Clears badges.","Alle ungelesenen Threads als gelesen. Badges weg.","Marquer tous non lus comme lus. Badges effac\xe9s.","Marca no le\xeddos como le\xeddos. Limpia insignias.","Marca n\xe3o lidas como lidas. Limpa badges.","Oznacz wszystkie jako przeczytane. Czy\u015bci badge.","Alles als gelezen. Badges weg.","\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u0441\u0435 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u043c. \u0421\u043d\u0438\u043c\u0430\u0435\u0442 \u0431\u0435\u0439\u0434\u0436\u0438.","\u0639\u0644\u0651\u0645 \u0627\u0644\u0643\u0644 \u0643\u0645\u0642\u0631\u0648\u0621. \u064a\u0632\u064a\u0644 \u0627\u0644\u0634\u0627\u0631\u0627\u062a."),unread_banner:e("\xd6nce oyundaki gelen kutusunu a\xe7; ara\xe7 mesaj servisini bulsun.","Open the in-game inbox first so the tool finds the message service.","\xd6ffne zuerst den Posteingang im Spiel.","Ouvre d\u2019abord la bo\xeete de r\xe9ception en jeu.","Abre primero el buz\xf3n del juego.","Abra primeiro a caixa de entrada do jogo.","Najpierw otw\xf3rz skrzynk\u0119 w grze.","Open eerst de in-game inbox.","\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439 \u0432\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0432 \u0438\u0433\u0440\u0435.","\u0627\u0641\u062a\u062d \u0635\u0646\u062f\u0648\u0642 \u0627\u0644\u0648\u0627\u0631\u062f \u062f\u0627\u062e\u0644 \u0627\u0644\u0644\u0639\u0628\u0629 \u0623\u0648\u0644\u0627\u064b."),unread_btn:e("Hepsini Okundu Yap","Mark All Read","Alles gelesen","Tout marquer lu","Marcar todo le\xeddo","Marcar tudo lido","Oznacz wszystkie","Alles gelezen","\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u0441\u0451","\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0643\u0644 \u0643\u0645\u0642\u0631\u0648\u0621"),messages_gear:e("Mesajlar","Messages","Nachrichten","Messages","Mensajes","Mensagens","Wiadomo\u015bci","Berichten","\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","\u0627\u0644\u0631\u0633\u0627\u0626\u0644"),accept_title:e("\u0130stekleri Kabul","Accept Requests","Anfragen annehmen","Accepter les demandes","Aceptar solicitudes","Aceitar pedidos","Akceptuj pro\u015bby","Verzoeken accepteren","\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0438","\u0642\u0628\u0648\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a"),accept_desc:e("Bekleyen t\xfcm arkada\u015fl\u0131k isteklerini tek t\u0131kla kabul et.","Accept all pending friend requests in one click.","Alle ausstehenden Freundschaftsanfragen annehmen.","Accepter toutes les demandes d\u2019amis.","Acepta todas las solicitudes pendientes.","Aceite todos os pedidos pendentes.","Zaakceptuj wszystkie pro\u015bby o znajomo\u015b\u0107.","Accepteer alle openstaande vriendverzoeken.","\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0432\u0441\u0435 \u0437\u0430\u044f\u0432\u043a\u0438 \u0432 \u0434\u0440\u0443\u0437\u044c\u044f.","\u0627\u0642\u0628\u0644 \u0643\u0644 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0635\u062f\u0627\u0642\u0629 \u0627\u0644\u0645\u0639\u0644\u0642\u0629."),accept_btn:e("T\xfcm \u0130stekleri Kabul Et","Accept All Requests","Alle annehmen","Tout accepter","Aceptar todas","Aceitar todos","Akceptuj wszystkie","Alles accepteren","\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0432\u0441\u0435","\u0642\u0628\u0648\u0644 \u0627\u0644\u0643\u0644"),accept_gear:e("Kabul","Accept","Annehmen","Accepter","Aceptar","Aceitar","Akceptuj","Accepteren","\u041f\u0440\u0438\u043d\u044f\u0442\u044c","\u0642\u0628\u0648\u0644"),reject_title:e("\u0130stekleri Reddet","Reject Requests","Anfragen ablehnen","Refuser les demandes","Rechazar solicitudes","Recusar pedidos","Odrzu\u0107 pro\u015bby","Verzoeken weigeren","\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0438","\u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628\u0627\u062a"),reject_desc:e("Bekleyen t\xfcm istekleri reddet. Mevcut arkada\u015flara dokunmaz.","Reject all pending requests. Existing friends stay.","Alle ausstehenden ablehnen. Bestehende Freunde bleiben.","Refuser toutes les demandes. Amis actuels inchang\xe9s.","Rechaza todas las pendientes. Amigos actuales se quedan.","Recuse todos pendentes. Amigos atuais ficam.","Odrzu\u0107 wszystkie. Istniej\u0105cy znajomi zostaj\u0105.","Weiger alle openstaande. Bestaande vrienden blijven.","\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0432\u0441\u0435 \u043e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0435. \u0422\u0435\u043a\u0443\u0449\u0438\u0435 \u0434\u0440\u0443\u0437\u044c\u044f \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f.","\u0627\u0631\u0641\u0636 \u0643\u0644 \u0627\u0644\u0645\u0639\u0644\u0642\u0629. \u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621 \u0627\u0644\u062d\u0627\u0644\u064a\u0648\u0646 \u064a\u0628\u0642\u0648\u0646."),reject_btn:e("T\xfcm \u0130stekleri Reddet","Reject All Requests","Alle ablehnen","Tout refuser","Rechazar todas","Recusar todos","Odrzu\u0107 wszystkie","Alles weigeren","\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0432\u0441\u0435","\u0631\u0641\u0636 \u0627\u0644\u0643\u0644"),reject_gear:e("Red","Reject","Ablehnen","Refuser","Rechazar","Recusar","Odrzu\u0107","Weigeren","\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c","\u0631\u0641\u0636"),low_lvl_title:e("D\xfc\u015f\xfck Seviye Sil","Delete Low Level","Niedriglevel l\xf6schen","Supprimer bas niveau","Borrar nivel bajo","Apagar n\xedvel baixo","Usu\u0144 niski poziom","Laag level verwijderen","\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0438\u0437\u043a\u0438\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c","\u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u0646\u062e\u0641\u0636"),low_lvl_desc:e("Se\xe7ilen seviyenin alt\u0131ndaki t\xfcm arkada\u015flar\u0131 siler.","Deletes all friends below the selected level.","L\xf6scht alle Freunde unter dem gew\xe4hlten Level.","Supprime les amis sous le niveau choisi.","Borra amigos bajo el nivel elegido.","Apaga amigos abaixo do n\xedvel.","Usuwa znajomych poni\u017cej poziomu.","Verwijdert vrienden onder het niveau.","\u0423\u0434\u0430\u043b\u044f\u0435\u0442 \u0434\u0440\u0443\u0437\u0435\u0439 \u043d\u0438\u0436\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0443\u0440\u043e\u0432\u043d\u044f.","\u064a\u062d\u0630\u0641 \u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621 \u062f\u0648\u0646 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u062d\u062f\u062f."),low_lvl_btn:e("D\xfc\u015f\xfck Seviye Arkada\u015flar\u0131 Sil","Delete Low-Level Friends","Niedriglevel-Freunde l\xf6schen","Supprimer amis bas niveau","Borrar amigos de nivel bajo","Apagar amigos de n\xedvel baixo","Usu\u0144 znajomych niskiego poziomu","Laaglevel-vrienden verwijderen","\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0434\u0440\u0443\u0437\u0435\u0439 \u043d\u0438\u0437\u043a\u043e\u0433\u043e \u0443\u0440\u043e\u0432\u043d\u044f","\u062d\u0630\u0641 \u0623\u0635\u062f\u0642\u0627\u0621 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0645\u0646\u062e\u0641\u0636"),low_lvl_opt:e("Seviye {n} alt\u0131","Below level {n}","Unter Level {n}","Sous niveau {n}","Bajo nivel {n}","Abaixo do n\xedvel {n}","Poni\u017cej poziomu {n}","Onder level {n}","\u041d\u0438\u0436\u0435 \u0443\u0440\u043e\u0432\u043d\u044f {n}","\u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 {n}"),del_gear:e("Sil","Delete","L\xf6schen","Supprimer","Borrar","Apagar","Usu\u0144","Verwijderen","\u0423\u0434\u0430\u043b\u0438\u0442\u044c","\u062d\u0630\u0641"),no_vip_title:e("VIP Olmayanlar\u0131 Sil","Delete Non-VIP","Nicht-VIP l\xf6schen","Supprimer non-VIP","Borrar no VIP","Apagar sem VIP","Usu\u0144 bez VIP","Non-VIP verwijderen","\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0431\u0435\u0437 VIP","\u062d\u0630\u0641 \u063a\u064a\u0631 VIP"),no_vip_desc:e("Aktif VIP olmayan arkada\u015flar\u0131 siler; VIP kalanlar durur.","Deletes friends without active VIP; VIPs stay.","L\xf6scht Freunde ohne aktives VIP; VIP bleibt.","Supprime amis sans VIP actif ; VIP restent.","Borra amigos sin VIP activo; VIP se quedan.","Apaga amigos sem VIP; VIP ficam.","Usuwa bez aktywnego VIP; VIP zostaj\u0105.","Verwijdert non-VIP; VIPs blijven.","\u0423\u0434\u0430\u043b\u044f\u0435\u0442 \u0431\u0435\u0437 VIP; VIP \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f.","\u064a\u062d\u0630\u0641 \u0628\u0644\u0627 VIP \u0646\u0634\u0637\u061b VIP \u064a\u0628\u0642\u0648\u0646."),no_vip_btn:e("VIP Olmayan Arkada\u015flar\u0131 Sil","Delete Non-VIP Friends","Nicht-VIP-Freunde l\xf6schen","Supprimer amis non-VIP","Borrar amigos no VIP","Apagar amigos sem VIP","Usu\u0144 znajomych bez VIP","Non-VIP-vrienden verwijderen","\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0434\u0440\u0443\u0437\u0435\u0439 \u0431\u0435\u0437 VIP","\u062d\u0630\u0641 \u0623\u0635\u062f\u0642\u0627\u0621 \u063a\u064a\u0631 VIP"),flist_title:e("Arkada\u015f Listesi","Friends List","Freundesliste","Liste d\u2019amis","Lista de amigos","Lista de amigos","Lista znajomych","Vriendenlijst","\u0421\u043f\u0438\u0441\u043e\u043a \u0434\u0440\u0443\u0437\u0435\u0439","\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621"),flist_desc:e("S\xfcr\xfcklenebilir pencere: avatarlar, nick arama, canl\u0131 liste.","Draggable window: avatars, nick search, live list.","Ziehbares Fenster: Avatare, Nick-Suche, Live-Liste.","Fen\xeatre mobile : avatars, recherche, liste live.","Ventana arrastrable: avatares, b\xfasqueda, lista.","Janela arrast\xe1vel: avatares, busca, lista.","Okno: awatary, szukaj nicku, lista na \u017cywo.","Sleepbaar venster: avatars, zoek nick, live lijst.","\u041e\u043a\u043d\u043e: \u0430\u0432\u0430\u0442\u0430\u0440\u044b, \u043f\u043e\u0438\u0441\u043a \u043d\u0438\u043a\u0430, \u0436\u0438\u0432\u043e\u0439 \u0441\u043f\u0438\u0441\u043e\u043a.","\u0646\u0627\u0641\u0630\u0629: \u0635\u0648\u0631\u060c \u0628\u062d\u062b \u0639\u0646 \u0644\u0642\u0628\u060c \u0642\u0627\u0626\u0645\u0629 \u062d\u064a\u0629."),flist_btn:e("Arkada\u015f Listesi","Friends List","Freundesliste","Liste d\u2019amis","Lista de amigos","Lista de amigos","Lista znajomych","Vriendenlijst","\u0421\u043f\u0438\u0441\u043e\u043a \u0434\u0440\u0443\u0437\u0435\u0439","\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621"),quiz_title:e("StarQuiz Bot","StarQuiz Bot","StarQuiz-Bot","Bot StarQuiz","Bot StarQuiz","Bot StarQuiz","Bot StarQuiz","StarQuiz-bot","\u0411\u043e\u0442 StarQuiz","\u0628\u0648\u062a StarQuiz"),quiz_desc:e("Yerle\u015fik bilgi bankas\u0131 ile quiz sorular\u0131n\u0131 otomatik cevaplar.","Auto-answers quiz with built-in knowledge base.","Beantwortet Quiz automatisch mit Wissenbank.","R\xe9pond au quiz via base int\xe9gr\xe9e.","Responde el quiz con base integrada.","Responde o quiz com base embutida.","Odpowiada na quiz z wbudowan\u0105 baz\u0105.","Beantwoordt quiz met ingebouwde kennis.","\u041e\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043d\u0430 \u043a\u0432\u0438\u0437 \u0441\u043e \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u043e\u0439 \u0431\u0430\u0437\u043e\u0439.","\u064a\u062c\u064a\u0628 \u0639\u0644\u0649 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0628\u0642\u0627\u0639\u062f\u0629 \u0645\u062f\u0645\u062c\u0629."),quiz_on:e("Quiz Botunu A\xe7","Enable Quiz Bot","Quiz-Bot aktivieren","Activer le bot quiz","Activar bot de quiz","Ativar bot de quiz","W\u0142\u0105cz bota quizu","Quiz-bot aanzetten","\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043a\u0432\u0438\u0437-\u0431\u043e\u0442\u0430","\u062a\u0641\u0639\u064a\u0644 \u0628\u0648\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631"),quiz_off:e("Quiz Botunu Kapat","Disable Quiz Bot","Quiz-Bot deaktivieren","D\xe9sactiver le bot quiz","Desactivar bot de quiz","Desativar bot de quiz","Wy\u0142\u0105cz bota quizu","Quiz-bot uitzetten","\u0412\u044b\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043a\u0432\u0438\u0437-\u0431\u043e\u0442\u0430","\u0625\u064a\u0642\u0627\u0641 \u0628\u0648\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631"),quiz_answers:e("{n} cevap","{n} answers","{n} Antworten","{n} r\xe9ponses","{n} respuestas","{n} respostas","{n} odpowiedzi","{n} antwoorden","{n} \u043e\u0442\u0432\u0435\u0442\u043e\u0432","{n} \u0625\u062c\u0627\u0628\u0629"),kb_label:e("\xd6zel bilgi bankas\u0131","Custom knowledge base","Eigene Wissensdatenbank","Base de connaissances","Base de conocimiento","Base de conhecimento","W\u0142asna baza wiedzy","Eigen kennisbank","\u0421\u0432\u043e\u044f \u0431\u0430\u0437\u0430 \u0437\u043d\u0430\u043d\u0438\u0439","\u0642\u0627\u0639\u062f\u0629 \u0645\u0639\u0631\u0641\u0629 \u0645\u062e\u0635\u0635\u0629"),kb_title:e("\xd6zel soru bankas\u0131 y\xfckle (JSON)","Load custom question bank (JSON)","Eigene Fragen laden (JSON)","Charger banque (JSON)","Cargar banco (JSON)","Carregar banco (JSON)","Wczytaj baz\u0119 (JSON)","Laad bank (JSON)","\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0431\u0430\u043d\u043a (JSON)","\u062a\u062d\u0645\u064a\u0644 \u0628\u0646\u0643 \u0623\u0633\u0626\u0644\u0629 (JSON)"),sign_title:e("\u0130mza","Autograph","Autogramm","Autographe","Aut\xf3grafo","Aut\xf3grafo","Autograf","Handtekening","\u0410\u0432\u0442\u043e\u0433\u0440\u0430\u0444","\u062a\u0648\u0642\u064a\u0639"),sign_desc:e("\u0130mza ve sohbet selamlar\u0131 i\xe7in kayan panel. \xd6nce hedef profili a\xe7.","Floating panel for greets/autographs. Open target profile first.","Schwebendes Panel f\xfcr Gr\xfc\xdfe. Zuerst Zielprofil \xf6ffnen.","Panneau flottant pour salutations. Ouvre le profil cible.","Panel flotante de saludos. Abre el perfil objetivo.","Painel flutuante de cumprimentos. Abra o perfil alvo.","P\u0142ywaj\u0105cy panel powita\u0144. Najpierw otw\xf3rz profil.","Zwevend paneel voor groeten. Open eerst doelprofiel.","\u041f\u043b\u0430\u0432\u0430\u044e\u0449\u0430\u044f \u043f\u0430\u043d\u0435\u043b\u044c \u043f\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0439. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c.","\u0644\u0648\u062d\u0629 \u0639\u0627\u0626\u0645\u0629 \u0644\u0644\u062a\u062d\u064a\u0627\u062a. \u0627\u0641\u062a\u062d \u0645\u0644\u0641 \u0627\u0644\u0647\u062f\u0641 \u0623\u0648\u0644\u0627\u064b."),sign_open:e("\u0130mza Panelini A\xe7","Open Autograph Panel","Autogramm-Panel \xf6ffnen","Ouvrir panneau auto.","Abrir panel de aut\xf3grafo","Abrir painel de aut\xf3grafo","Otw\xf3rz panel autografu","Autograafpaneel openen","\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c \u0430\u0432\u0442\u043e\u0433\u0440\u0430\u0444\u0430","\u0641\u062a\u062d \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639"),sign_close:e("\u0130mza Panelini Kapat","Close Autograph Panel","Autogramm-Panel schlie\xdfen","Fermer panneau auto.","Cerrar panel de aut\xf3grafo","Fechar painel de aut\xf3grafo","Zamknij panel autografu","Autograafpaneel sluiten","\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c \u0430\u0432\u0442\u043e\u0433\u0440\u0430\u0444\u0430","\u0625\u063a\u0644\u0627\u0642 \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639"),misc_heading:e("Di\u011fer","Other","Sonstiges","Divers","Otros","Outros","Inne","Overig","\u0414\u0440\u0443\u0433\u043e\u0435","\u0623\u062e\u0631\u0649"),chat_bypass:e("Sohbet filtresi","Chat Filter Bypass","Chatfilter-Bypass","Bypass filtre chat","Bypass filtro de chat","Bypass do filtro de chat","Bypass filtra czatu","Chatfilter-bypass","\u041e\u0431\u0445\u043e\u0434 \u0447\u0430\u0442-\u0444\u0438\u043b\u044c\u0442\u0440\u0430","\u062a\u062c\u0627\u0648\u0632 \u0641\u0644\u062a\u0631 \u0627\u0644\u062f\u0631\u062f\u0634\u0629"),vip_open_btn:e("VIP Paket Panelini Aç","Open VIP Pack Panel","VIP-Paket öffnen","Ouvrir le panneau VIP","Abrir panel VIP","Abrir painel VIP","Otwórz panel VIP","VIP-paneel openen","Открыть VIP панель","فتح لوحة VIP"),vip_card_title:e("VIP Paketler","VIP Packs","VIP-Pakete","Packs VIP","Paquetes VIP","Pacotes VIP","Pakiety VIP","VIP-pakketten","VIP пакеты","باقات VIP"),vip_card_desc:e("Bölgeye göre indirimli VIP teklifleri","Discounted VIP offers by region","Rabattierte VIP-Angebote nach Region","Offres VIP à prix réduit selon la région","Ofertas VIP con descuento según la región","Ofertas VIP com desconto por região","Promocyjne oferty VIP według regionu","Korting VIP-aanbiedingen per regio","Скидки на VIP по региону","عروض VIP مخفضة حسب المنطقة"),afk_card_desc:e("Belirtilen isim veya nick sohbette geçerse otomatik cevap verir. (Spama karşı korumalıdır).","Auto-replies when the listed name or nick appears in chat. (Spam protected.)","Antwortet automatisch, wenn der genannte Name/Nick im Chat vorkommt. (Spamgeschützt.)","Répond automatiquement si le nom/pseudo listé apparaît dans le chat. (Protégé contre le spam.)","Responde automáticamente si el nombre/nick aparece en el chat. (Protegido contra spam.)","Responde automaticamente se o nome/nick aparecer no chat. (Protegido contra spam.)","Automatycznie odpowiada, gdy podany nick pojawia się na czacie. (Ochrona antyspamowa.)","Antwoordt automatisch als de genoemde nick in de chat verschijnt. (Spambeveiligd.)","Автоответ при упоминании имени/ника в чате. (Защита от спама.)","يرد تلقائياً عند ظهور الاسم/اللقب في الدردشة. (محمي من الرسائل المزعجة.)"),afk_nick_note:e("Otomatik mesaj gönderirken '{nick}' bunu eklerseniz, mesaj otomatik olarak o kişinin adıyla seslenerek gider.","If you add '{nick}' in the auto message, it greets that person by name.","Wenn Sie '{nick}' in die Auto-Nachricht einfügen, wird der Name der Person eingesetzt.","Si vous ajoutez '{nick}' au message auto, le message appelle la personne par son nom.","Si añades '{nick}' al mensaje automático, saluda a esa persona por su nombre.","Se adicionar '{nick}' na mensagem automática, ela chama a pessoa pelo nome.","Jeśli dodasz '{nick}' w auto-wiadomości, zwróci się do osoby po imieniu.","Als je '{nick}' toevoegt, spreekt het bericht die persoon bij naam aan.","Если добавить '{nick}', сообщение обратится к человеку по имени.","إذا أضفت '{nick}' فسينادي الرسالة الشخص باسمه."),afk_msg_ph:e("Örnek: {nick} bilgisayarda değilim.","Example: {nick} I am away from the PC.","Beispiel: {nick} ich bin nicht am PC.","Exemple : {nick} je ne suis pas à l’ordinateur.","Ejemplo: {nick} no estoy en el PC.","Exemplo: {nick} não estou no computador.","Przykład: {nick} nie ma mnie przy komputerze.","Voorbeeld: {nick} ik ben niet achter de PC.","Пример: {nick} меня нет за компьютером.","مثال: {nick} لست أمام الجهاز."),afk_words_hint:e("Size nasıl seslenildiğinde otomatik cevap verilsin? Birden fazla kelime için virgül kullanın.","When should it auto-reply? Use commas to list multiple words.","Wann soll automatisch geantwortet werden? Mehrere Wörter mit Komma trennen.","Quand répondre automatiquement ? Séparez plusieurs mots par des virgules.","¿Cuándo responder automáticamente? Separa varias palabras con comas.","Quando responder automaticamente? Separe várias palavras com vírgulas.","Kiedy ma odpowiadać automatycznie? Oddziel słowa przecinkami.","Wanneer automatisch antwoorden? Scheid woorden met komma's.","Когда отвечать автоматически? Разделяйте слова запятыми.","متى يرد تلقائياً؟ افصل الكلمات بفواصل."),afk_words_ph:e("Örnek: nick, isim, hitap, kelime","Example: nick, name, title, word","Beispiel: Nick, Name, Anrede, Wort","Exemple : pseudo, nom, titre, mot","Ejemplo: nick, nombre, trato, palabra","Exemplo: nick, nome, tratamento, palavra","Przykład: nick, imię, zwrot, słowo","Voorbeeld: nick, naam, aanspreekvorm, woord","Пример: ник, имя, обращение, слово","مثال: لقب، اسم، نداء، كلمة"),afk_dm_desc:e("Gelen tüm mesajlara otomatik olarak belirtilen mesajı gönderir. Çalışması için AFK Mod açık olmalıdır.","Sends the set reply to all incoming DMs. AFK Mode must be on.","Sendet die festgelegte Antwort an alle DMs. AFK-Modus muss an sein.","Envoie la réponse définie à tous les DM. Le mode AFK doit être activé.","Envía la respuesta a todos los DM. El modo AFK debe estar activo.","Envia a resposta a todos os DMs. O modo AFK precisa estar ativo.","Wysyła ustawioną odpowiedź na wszystkie DM. Tryb AFK musi być włączony.","Stuurt het ingestelde antwoord naar alle DM's. AFK-modus moet aan staan.","Отправляет заданный ответ на все ЛС. Режим AFK должен быть включён.","يرسل الرد المحدد لجميع الرسائل الخاصة. يجب تفعيل وضع AFK."),afk_dm_ph:e("Örnek: Bilgisayarda değilim, gelince döneceğim.","Example: I am away, I will be back later.","Beispiel: Ich bin nicht am PC, komme später zurück.","Exemple : Je ne suis pas à l’ordinateur, je reviens.","Ejemplo: No estoy en el PC, vuelvo luego.","Exemplo: Não estou no PC, volto já.","Przykład: Nie ma mnie przy komputerze, wrócę.","Voorbeeld: Ik ben niet achter de PC, ik kom terug.","Пример: Меня нет за компьютером, скоро вернусь.","مثال: لست أمام الجهاز، سأعود لاحقاً."),afk_dm_list:e("Gelen DM","Incoming DMs","Eingehende DMs","DM reçus","DM entrantes","DMs recebidas","Przychodzące DM","Binnenkomende DM's","Входящие ЛС","الرسائل الواردة"),ghost_title:e("Ghost oda girişi","Ghost room join","Ghost-Raumbeitritt","Entrée Ghost","Entrada Ghost","Entrada Ghost","Wejście Ghost","Ghost-kamerjoin","Вход Ghost","دخول Ghost"),ghost_desc:e("Açıp bir odaya girerseniz sizi kimse göremez ama yine de odada olursunuz. Yazılanları görebilir, odaya mesaj atabilir, imzalaşabilirsiniz.","If you turn it on and join a room, nobody sees you but you are still there. You can read chat, send messages, and exchange signatures.","Wenn aktiv und du einen Raum betrittst, sieht dich niemand — du bist aber drin. Chat lesen, schreiben und Autogramme gehen.","Activé, personne ne vous voit dans la salle, mais vous y êtes. Vous lisez, écrivez et échangez des signatures.","Si lo activas y entras a una sala, nadie te ve pero sigues dentro. Puedes leer, escribir e intercambiar firmas.","Se ativar e entrar numa sala, ninguém te vê mas você está lá. Pode ler, escrever e trocar assinaturas.","Po włączeniu nikt cię nie widzi w pokoju, ale jesteś w nim. Czytasz chat, piszesz i wymieniasz autografy.","Als je dit aanzet en een kamer join, ziet niemand je, maar je bent er wel. Je kunt lezen, schrijven en handtekeningen uitwisselen.","Если включить и зайти в комнату, вас не видно, но вы там. Можно читать чат, писать и обмениваться автографами.","عند التفعيل والدخول لغرفة لا يراك أحد لكنك موجود. يمكنك القراءة والكتابة وتبادل التوقيعات."),event_waiting:e("ETKİNLİK BEKLENİYOR","EVENT PENDING","EVENT AUSSTEHEND","ÉVÉNEMENT EN ATTENTE","EVENTO PENDIENTE","EVENTO PENDENTE","OCZEKIWANIE NA EVENT","EVENT VERWACHT","ОЖИДАНИЕ ИВЕНТА","بانتظار الفعالية"),emoji_panel:e("Emoji Paneli","Emoji Panel","Emoji-Panel","Panneau emoji","Panel de emojis","Painel de emojis","Panel emoji","Emoji-paneel","Панель эмодзи","لوحة الإيموجي"),emoji_search_ph:e("Emoji ara (gül, kemik, kalp…)","Search emoji (smile, bone, heart…)","Emoji suchen (Lächeln, Knochen, Herz…)","Rechercher un emoji (sourire, os, cœur…)","Buscar emoji (sonrisa, hueso, corazón…)","Pesquisar emoji (sorriso, osso, coração…)","Szukaj emoji (uśmiech, kość, serce…)","Zoek emoji (lach, bot, hart…)","Поиск эмодзи (улыбка, кость, сердце…)","ابحث عن إيموجي (ابتسامة، عظمة، قلب…)"),emoji_fav:e("Sık Kullanılanlar","Frequently Used","Häufig verwendet","Fréquemment utilisés","Usados con frecuencia","Usados com frequência","Często używane","Vaak gebruikt","Часто используемые","الأكثر استخداماً"),emoji_top:e("En Çok Kullanılanlar","Most Used","Meistverwendet","Les plus utilisés","Más usados","Mais usados","Najczęściej używane","Meest gebruikt","Самые используемые","الأكثر استعمالاً"),emoji_results:e("Sonuçlar","Results","Ergebnisse","Résultats","Resultados","Resultados","Wyniki","Resultaten","Результаты","النتائج"),emoji_more:e("Daha Fazla","Load More","Mehr laden","Charger plus","Cargar más","Carregar mais","Więcej","Meer laden","Ещё","المزيد"),chat_bypass_desc:e("Her kelime ba\u015f\u0131 b\xfcy\xfck; her kelimenin \u0130\xc7\u0130NE g\xf6r\xfcnmez LRM (tek kelime dahil). DM + oda WS. BYPASS chip ile a\xe7.","Title Case; LRM inside every word (single words too). DM + room WS. Enable via BYPASS chip.","Title Case; LRM in jedem Wort. DM + Raum-WS.","Title Case; LRM dans chaque mot. DM + salon WS.","Title Case; LRM en cada palabra. DM + sala WS.","Title Case; LRM em cada palavra. DM + sala WS.","Title Case; LRM w ka\u017cdym s\u0142owie. DM + pok\xf3j WS.","Title Case; LRM in elk woord. DM + kamer WS.","Title Case; LRM \u0432 \u043a\u0430\u0436\u0434\u043e\u043c \u0441\u043b\u043e\u0432\u0435. DM + \u043a\u043e\u043c\u043d\u0430\u0442\u0430 WS.","Title Case\u061b LRM \u062f\u0627\u062e\u0644 \u0643\u0644 \u0643\u0644\u0645\u0629. DM + \u063a\u0631\u0641\u0629 WS."),clean_console:e("Temiz Konsol","Clean Console","Saubere Konsole","Console propre","Consola limpia","Console limpa","Czysta konsola","Schone console","\u0427\u0438\u0441\u0442\u0430\u044f \u043a\u043e\u043d\u0441\u043e\u043b\u044c","\u0648\u062d\u062f\u0629 \u0646\u0638\u064a\u0641\u0629"),clean_console_desc:e("Devtools g\xfcr\xfclt\xfcs\xfcn\xfc gizler (asset cache, GC vb.). Ger\xe7ek hatalar kal\u0131r.","Hides devtools noise (asset cache, GC\u2026). Real errors stay.","Verbirgt Devtools-Rauschen. Echte Fehler bleiben.","Masque le bruit DevTools. Les vraies erreurs restent.","Oculta ruido de DevTools. Errores reales quedan.","Oculta ru\xeddo do DevTools. Erros reais ficam.","Ukrywa szum DevTools. Prawdziwe b\u0142\u0119dy zostaj\u0105.","Verbergt DevTools-ruis. Echte fouten blijven.","\u0421\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u0448\u0443\u043c DevTools. \u0420\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u043e\u0448\u0438\u0431\u043a\u0438 \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f.","\u064a\u062e\u0641\u064a \u0636\u0648\u0636\u0627\u0621 DevTools. \u0627\u0644\u0623\u062e\u0637\u0627\u0621 \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629 \u062a\u0628\u0642\u0649."),toggle_on:e("a\xe7\u0131k","on","an","activ\xe9","activado","ligado","w\u0142.","aan","\u0432\u043a\u043b","\u062a\u0634\u063a\u064a\u0644"),toggle_off:e("kapal\u0131","off","aus","d\xe9sactiv\xe9","desactivado","desligado","wy\u0142.","uit","\u0432\u044b\u043a\u043b","\u0625\u064a\u0642\u0627\u0641"),homes_title:e("Glitch Evler","Glitch Homes","Glitch-Homes","Maisons glitch","Casas glitch","Casas glitch","Domy glitch","Glitch-huizen","\u0413\u043b\u0438\u0442\u0447-\u0434\u043e\u043c\u0430","\u0645\u0646\u0627\u0632\u0644 glitch"),homes_desc:e("Nick yaz \u2192 \xc7ek+Uygula. \xc7ekilen evler kal\u0131c\u0131; liste sadece oda g\xf6rseli.","Type nick \u2192 Pull+Apply. Homes persist; list shows only room image.","Nick \u2192 Holen+Anwenden. Homes bleiben; nur Raumbild.","Nick \u2192 Extraire+Appliquer. Maisons persistantes; image seule.","Nick \u2192 Sacar+Aplicar. Casas persistentes; solo imagen.","Nick \u2192 Puxar+Aplicar. Casas persistem; s\xf3 imagem.","Nick \u2192 Pobierz+Zastosuj. Domy zapisane; tylko obraz.","Nick \u2192 Trek+Toepassen. Huizen bewaard; alleen beeld.","\u041d\u0438\u043a \u2192 \u0421\u043a\u0430\u0447\u0430\u0442\u044c+\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c. \u0414\u043e\u043c\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u044e\u0442\u0441\u044f; \u0442\u043e\u043b\u044c\u043a\u043e \u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0430.","\u0644\u0642\u0628 \u2192 \u0633\u062d\u0628+\u062a\u0637\u0628\u064a\u0642. \u0627\u0644\u0645\u0646\u0627\u0632\u0644 \u062b\u0627\u0628\u062a\u0629\u061b \u0627\u0644\u0635\u0648\u0631\u0629 \u0641\u0642\u0637."),homes_ph:e("Nick veya profileId","Nick or profileId","Nick oder profileId","Pseudo ou profileId","Nick o profileId","Nick ou profileId","Nick lub profileId","Nick of profileId","\u041d\u0438\u043a \u0438\u043b\u0438 profileId","\u0644\u0642\u0628 \u0623\u0648 profileId"),homes_pull_apply:e("\xc7ek + Uygula","Pull + Apply","Holen + Anwenden","Extraire + Appliquer","Sacar + Aplicar","Puxar + Aplicar","Pobierz + Zastosuj","Trek + Toepassen","\u0421\u043a\u0430\u0447\u0430\u0442\u044c + \u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c","\u0633\u062d\u0628 + \u062a\u0637\u0628\u064a\u0642"),homes_apply:e("Evi Uygula","Apply Home","Home anwenden","Appliquer la maison","Aplicar casa","Aplicar casa","Zastosuj dom","Huis toepassen","\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0434\u043e\u043c","\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0646\u0632\u0644"),homes_pull_only:e("Sadece \xc7ek (listeye ekle)","Pull Only (add to list)","Nur holen (zur Liste)","Extraire seulement","Solo sacar (a la lista)","S\xf3 puxar (\xe0 lista)","Tylko pobierz (do listy)","Alleen trekken (lijst)","\u0422\u043e\u043b\u044c\u043a\u043e \u0441\u043a\u0430\u0447\u0430\u0442\u044c (\u0432 \u0441\u043f\u0438\u0441\u043e\u043a)","\u0633\u062d\u0628 \u0641\u0642\u0637 (\u0623\u0636\u0641 \u0644\u0644\u0642\u0627\u0626\u0645\u0629)"),homes_softrare:e("\u2014","\u2014","\u2014","\u2014","\u2014","\u2014","\u2014","\u2014","\u2014","\u2014"),homes_need_nick:e("Nick yaz veya a\u015fa\u011f\u0131dan ev se\xe7","Type a nick or pick a home below","Nick tippen oder Home unten w\xe4hlen","Tape un nick ou choisis une maison","Escribe un nick o elige una casa","Digite um nick ou escolha uma casa","Wpisz nick lub wybierz dom","Typ een nick of kies een huis","\u0412\u0432\u0435\u0434\u0438 \u043d\u0438\u043a \u0438\u043b\u0438 \u0432\u044b\u0431\u0435\u0440\u0438 \u0434\u043e\u043c","\u0627\u0643\u062a\u0628 \u0644\u0642\u0628\u0627\u064b \u0623\u0648 \u0627\u062e\u062a\u0631 \u0645\u0646\u0632\u0644\u0627\u064b"),homes_need_pick:e("\xd6nce bir ev se\xe7 veya nick yaz","Pick a home or type a nick first","Zuerst Home w\xe4hlen oder Nick tippen","Choisis une maison ou un nick","Elige una casa o escribe un nick","Escolha uma casa ou digite um nick","Najpierw wybierz dom lub wpisz nick","Kies eerst een huis of typ een nick","\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u0434\u043e\u043c \u0438\u043b\u0438 \u0432\u0432\u0435\u0434\u0438 \u043d\u0438\u043a","\u0627\u062e\u062a\u0631 \u0645\u0646\u0632\u0644\u0627\u064b \u0623\u0648 \u0627\u0643\u062a\u0628 \u0644\u0642\u0628\u0627\u064b \u0623\u0648\u0644\u0627\u064b"),homes_need_pull:e("\xc7ekmek i\xe7in nick yaz","Type a nick to pull","Nick zum Holen tippen","Tape un nick pour extraire","Escribe un nick para sacar","Digite um nick para puxar","Wpisz nick do pobrania","Typ een nick om te trekken","\u0412\u0432\u0435\u0434\u0438 \u043d\u0438\u043a \u0434\u043b\u044f \u0441\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u044f","\u0627\u0643\u062a\u0628 \u0644\u0642\u0628\u0627\u064b \u0644\u0644\u0633\u062d\u0628"),speed_very_slow:e("\xc7ok Yava\u015f","Very Slow","Sehr langsam","Tr\xe8s lent","Muy lento","Muito lento","Bardzo wolno","Zeer traag","\u041e\u0447\u0435\u043d\u044c \u043c\u0435\u0434\u043b\u0435\u043d\u043d\u043e","\u0628\u0637\u064a\u0621 \u062c\u062f\u0627\u064b"),speed_slow:e("Yava\u015f","Slow","Langsam","Lent","Lento","Lento","Wolno","Traag","\u041c\u0435\u0434\u043b\u0435\u043d\u043d\u043e","\u0628\u0637\u064a\u0621"),speed_normal:e("Normal","Normal","Normal","Normal","Normal","Normal","Normalny","Normaal","\u041e\u0431\u044b\u0447\u043d\u044b\u0439","\u0639\u0627\u062f\u064a"),speed_fast:e("H\u0131zl\u0131","Fast","Schnell","Rapide","R\xe1pido","R\xe1pido","Szybko","Snel","\u0411\u044b\u0441\u0442\u0440\u043e","\u0633\u0631\u064a\u0639"),speed_very_fast:e("\xc7ok H\u0131zl\u0131","Very Fast","Sehr schnell","Tr\xe8s rapide","Muy r\xe1pido","Muito r\xe1pido","Bardzo szybko","Zeer snel","\u041e\u0447\u0435\u043d\u044c \u0431\u044b\u0441\u0442\u0440\u043e","\u0633\u0631\u064a\u0639 \u062c\u062f\u0627\u064b"),event_pickup_label:e("Kartpostal / Etkinlik Topla","Postcards / Collect Event","Postkarten / Event sammeln","Cartes postales / Collecte","Postales / Evento","Cart\xf5es / Evento","Poczt\xf3wki / Event","Kaarten / Event","\u041e\u0442\u043a\u0440\u044b\u0442\u043a\u0438 / \u0418\u0432\u0435\u043d\u0442","\u0628\u0637\u0627\u0642\u0627\u062a / \u0641\u0639\u0627\u0644\u064a\u0629"),home_copy_apply:e("Uygula","Apply","Anwenden","Appliquer","Aplicar","Aplicar","Zastosuj","Toepassen","Применить","تطبيق"),homes_soft_list:e("Soft evler","Soft homes","Soft-Häuser","Maisons Soft","Casas Soft","Casas Soft","Domy Soft","Soft-huizen","Дома Soft","منازل Soft"),homes_self_pull:e("Kendi Evimi Çek","Pull My Home","Mein Haus holen","Récupérer ma maison","Traer mi casa","Puxar minha casa","Pobierz mój dom","Mijn huis ophalen","Забрать мой дом","جلب منزلي"),homes_need_login:e("Önce oyuna gir","Enter the game first","Zuerst ins Spiel","Entre d'abord dans le jeu","Entra primero al juego","Entre no jogo primeiro","Najpierw wejdź do gry","Ga eerst het spel in","Сначала войди в игру","ادخل اللعبة أولاً"),upload_btn:e("Yükle","Upload","Hochladen","Téléverser","Subir","Enviar","Prześlij","Uploaden","Загрузить","رفع"),drop_image_here:e("Görseli buraya bırak veya tıkla","Drop image here or click","Bild hier ablegen oder klicken","Déposez une image ou cliquez","Suelta la imagen o haz clic","Solte a imagem ou clique","Upuść obraz lub kliknij","Sleep afbeelding hier of klik","Перетащите изображение или нажмите","أسقط الصورة هنا أو انقر"),emoji_records:e("{n} kayıt","{n} records","{n} Einträge","{n} enregistrements","{n} registros","{n} registros","{n} wpisów","{n} records","{n} записей","{n} سجل"),emoji_count:e("{n} emoji","{n} emoji","{n} Emoji","{n} émojis","{n} emojis","{n} emojis","{n} emoji","{n} emoji","{n} эмодзи","{n} إيموجي"),emoji_cat_all:e("Tüm","All","Alle","Tout","Todo","Tudo","Wszystkie","Alles","Все","الكل"),emoji_cat_faces:e("Yüzler","Faces","Gesichter","Visages","Caras","Rostos","Twarze","Gezichten","Лица","وجوه"),emoji_cat_people:e("İnsan","People","Menschen","Personnes","Personas","Pessoas","Ludzie","Mensen","Люди","أشخاص"),emoji_cat_animals:e("Hayvan","Animals","Tiere","Animaux","Animales","Animais","Zwierzęta","Dieren","Животные","حيوانات"),emoji_cat_food:e("Yemek","Food","Essen","Nourriture","Comida","Comida","Jedzenie","Eten","Еда","طعام"),emoji_cat_travel:e("Yerler","Places","Orte","Lieux","Lugares","Lugares","Miejsca","Plaatsen","Места","أماكن"),emoji_cat_activity:e("Aktivite","Activity","Aktivität","Activité","Actividad","Atividade","Aktywność","Activiteit","Активность","نشاط"),emoji_cat_objects:e("Nesne","Objects","Objekte","Objets","Objetos","Objetos","Obiekty","Objecten","Предметы","أشياء"),emoji_cat_symbols:e("Sembol","Symbols","Symbole","Symboles","Símbolos","Símbolos","Symbole","Symbolen","Символы","رموز"),emoji_cat_flags:e("Bayrak","Flags","Flaggen","Drapeaux","Banderas","Bandeiras","Flagi","Vlaggen","Флаги","أعلام"),mood_perm_label:e("Kalıcı bağ · {name}","Permanent bind · {name}","Dauerhaft · {name}","Lien permanent · {name}","Vínculo permanente · {name}","Vínculo permanente · {name}","Trwałe · {name}","Permanent · {name}","Постоянно · {name}","ربط دائم · {name}"),mood_perm_clear:e("Bu hesapta kalıcıyı bırak","Clear permanent on this account","Dauerhaft für dieses Konto lösen","Retirer le permanent sur ce compte","Quitar permanente en esta cuenta","Remover permanente nesta conta","Usuń trwałe na tym koncie","Permanent voor dit account wissen","Снять постоянное с этого аккаунта","إزالة الدائم لهذا الحساب"),quests_run:e("Görevleri çalıştır","Run quests","Quests starten","Lancer les quêtes","Ejecutar misiones","Executar missões","Uruchom zadania","Quests starten","Запустить задания","تشغيل المهام"),chat_players_mood:e("Oyuncular · ruh hali ayna","Players · mood mirror","Spieler · Stimmung spiegeln","Joueurs · miroir d'humeur","Jugadores · espejo de humor","Jogadores · espelho de humor","Gracze · lustro nastroju","Spelers · stemmingspiegel","Игроки · зеркало настроения","اللاعبون · مرآة المزاج"),chat_people_count:e("{n} kişi","{n} people","{n} Personen","{n} personnes","{n} personas","{n} pessoas","{n} osób","{n} personen","{n} чел.","{n} أشخاص"),chat_activity:e("Aktivite","Activity","Aktivität","Activité","Actividad","Atividade","Aktywność","Activiteit","Активность","نشاط"),ghost_on_toast:e("Ghost açıldı — odaya gir veya hareket et","Ghost on — join a room or move","Geist an — Raum betreten oder bewegen","Ghost activé — entrez ou bougez","Ghost activo — entra o muévete","Ghost ativo — entre ou mova-se","Ghost włączony — wejdź lub rusz się","Ghost aan — ga een kamer in of beweeg","Ghost включён — зайди или двигайся","تم تفعيل الشبح — ادخل غرفة أو تحرّك"),ghost_off_toast:e("Ghost kapalı — normal görünürsün","Ghost off — you appear normal","Geist aus — normal sichtbar","Ghost off — apparence normale","Ghost off — apariencia normal","Ghost off — aparência normal","Ghost wyłączony — wyglądasz normalnie","Ghost uit — normaal zichtbaar","Ghost выкл — обычный вид","الشبح متوقف — تظهر بشكل طبيعي"),spam_title:e("Spam Koruma","Spam Protection","Spam-Schutz","Protection spam","Protección spam","Proteção spam","Ochrona spam","Spambeveiliging","Защита от спама","حماية من السبام"),spam_rate:e("Spam hızı","Spam rate","Spam-Rate","Débit spam","Tasa de spam","Taxa de spam","Tempo spamu","Spamtempo","Скорость спама","معدل السبام"),spam_tick_low:e("düşük","low","niedrig","faible","bajo","baixo","niski","laag","низкий","منخفض"),spam_tick_mid:e("orta","mid","mittel","moyen","medio","médio","średni","middel","средний","متوسط"),spam_tick_high:e("yüksek","high","hoch","élevé","alto","alto","wysoki","hoog","высокий","مرتفع"),spam_tick_crit:e("kritik","critical","kritisch","critique","crítico","crítico","krytyczny","kritiek","критический","حرج"),spam_dm_block:e("Spam DM Engelle","Block spam DMs","Spam-DMs blockieren","Bloquer les DM spam","Bloquear DM spam","Bloquear DM spam","Blokuj spam DM","Spam-DM blokkeren","Блок спам-ЛС","حظر رسائل السبام"),spam_dm_hint:e("DM ve arkadaşlık isteği spamını etkisiz hale getirir. Önerilen: En Hızlı.","Stops DM and friend-request spam. Recommended: Fastest.","Stoppt DM- und Freundschaftsspam. Empfohlen: Am schnellsten.","Stoppe le spam DM/amis. Recommandé : Le plus rapide.","Detiene spam de DM y amigos. Recomendado: Más rápido.","Para spam de DM e amigos. Recomendado: Mais rápido.","Zatrzymuje spam DM i zaproszeń. Zalecane: Najszybciej.","Stopt DM- en vriendverzoek-spam. Aanbevolen: Snelst.","Останавливает спам ЛС и заявок. Рекомендуется: Макс.","يوقف سبام الرسائل وطلبات الصداقة. المُستحسن: الأسرع."),spam_mode_normal:e("Normal","Normal","Normal","Normal","Normal","Normal","Normalny","Normaal","Обычный","عادي"),spam_mode_agresif:e("Agresif","Aggressive","Aggressiv","Agressif","Agresivo","Agressivo","Agresywny","Agressief","Агрессивный","عدواني"),spam_mode_max:e("MAX HIZ","MAX SPEED","MAX TEMPO","VITESSE MAX","VELOCIDAD MÁX","VELOCIDADE MÁX","MAX TEMPO","MAX SNELHEID","МАКС СКОРОСТЬ","أقصى سرعة"),spam_fastest:e("En Hızlı","Fastest","Am schnellsten","Le plus rapide","Más rápido","Mais rápido","Najszybciej","Snelst","Максимум","الأسرع"),spam_fastest_ok:e("En Hızlı ayarlar uygulandı","Fastest settings applied","Schnellste Einstellungen angewendet","Réglages les plus rapides appliqués","Ajustes más rápidos aplicados","Configurações mais rápidas aplicadas","Zastosowano najszybsze ustawienia","Snelste instellingen toegepast","Применены максимальные настройки","تم تطبيق أسرع الإعدادات"),spam_label_mod:e("MOD","MODE","MODUS","MODE","MODO","MODO","TRYB","MODUS","РЕЖИМ","وضع"),spam_label_level:e("SEVIYE","LEVEL","STUFE","NIVEAU","NIVEL","NÍVEL","POZIOM","NIVEAU","УРОВЕНЬ","مستوى"),spam_label_worker:e("WORKER","WORKER","WORKER","WORKER","WORKER","WORKER","WORKER","WORKER","WORKER","WORKER"),spam_label_batch:e("BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH","BATCH / FLUSH"),spam_label_flood:e("FLOOD EŞİĞİ","FLOOD THRESHOLD","FLOOD-SCHWELLE","SEUIL FLOOD","UMBRAL FLOOD","LIMITE FLOOD","PRÓG FLOOD","FLOOD-DREMPEL","ПОРОГ FLOOD","حد الفيضان"),spam_label_quiet:e("SESSİZ PENCERE","QUIET WINDOW","STILLE FENSTER","FENÊTRE CALME","VENTANA SILENCIOSA","JANELA SILENCIOSA","OKNO CISZY","STIL VENSTER","ТИХОЕ ОККНО","نافذة الهدوء"),spam_label_block:e("BLOCK PARALEL","BLOCK PARALLEL","BLOCK PARALLEL","BLOC PARALLÈLE","BLOQUEO PARALELO","BLOQUEIO PARALELO","BLOK RÓWNOLEGŁY","BLOK PARALLEL","ПАРАЛЛЕЛЬНЫЙ БЛОК","حظر متوازٍ"),spam_enable_all:e("Hepsini aktif et","Enable all","Alles aktivieren","Tout activer","Activar todo","Ativar tudo","Włącz wszystko","Alles inschakelen","Включить всё","تفعيل الكل"),spam_enable_all_ok:e("Tüm spam korumaları açıldı","All spam protections enabled","Alle Spam-Schutzfunktionen aktiv","Toutes les protections spam activées","Todas las protecciones spam activadas","Todas as proteções spam ativadas","Włączono całą ochronę spam","Alle spambescherming aan","Вся защита от спама включена","تم تفعيل كل حماية السبام"),spam_auto:e("Otomatik Spam Engelleme","Auto spam block","Automatische Spam-Sperre","Blocage spam auto","Bloqueo spam auto","Bloqueio spam auto","Auto blokada spamu","Auto spamblokkade","Автоблок спама","حظر سبام تلقائي"),spam_auto_desc:e("Gelen DM spamını engeller.","Blocks incoming DM spam.","Blockiert eingehenden DM-Spam.","Bloque le spam DM entrant.","Bloquea spam DM entrante.","Bloqueia spam DM recebido.","Blokuje przychodzący spam DM.","Blokkeert inkomende DM-spam.","Блокирует входящий спам ЛС.","يحظر سبام الرسائل الواردة."),spam_instant:e("Anında Engel","Instant block","Sofort sperren","Blocage immédiat","Bloqueo instantáneo","Bloqueio instantâneo","Natychmiastowy blok","Direct blokkeren","Мгновенный блок","حظر فوري"),spam_leave:e("Engelleneni sohbetten çıkar","Remove blocked from chat","Gesperrte aus Chat entfernen","Retirer les bloqués du chat","Quitar bloqueados del chat","Remover bloqueados do chat","Usuń zablokowanych z czatu","Verwijder geblokkeerden uit chat","Убрать заблокированных из чата","إزالة المحظورين من الدردشة"),spam_shield:e("Oyun Kalkanı","Game shield","Spielschild","Bouclier jeu","Escudo del juego","Escudo do jogo","Tarcza gry","Spelschild","Игровой щит","درع اللعبة"),spam_reject_fr:e("Arkadaş isteklerini oto red","Auto-reject friend requests","Freundschaftsanfragen auto ablehnen","Refuser auto les demandes d'amis","Rechazar auto solicitudes","Recusar auto pedidos","Auto odrzucaj zaproszenia","Vriendverzoeken auto weigeren","Автоотклонение заявок","رفض طلبات الصداقة تلقائياً"),spam_block_fr:e("Arkadaş isteklerini oto engelle","Auto-block friend requests","Freundschaftsanfragen auto sperren","Bloquer auto les demandes d'amis","Bloquear auto solicitudes","Bloquear auto pedidos","Auto blokuj zaproszenia","Vriendverzoeken auto blokkeren","Автоблок заявок","حظر طلبات الصداقة تلقائياً"),spam_scan_unread:e("Okunmayanları Tara","Scan unread","Ungelesene scannen","Scanner non lus","Escanear no leídos","Varrer não lidos","Skanuj nieprzeczytane","Scan ongelezen","Скан непрочитанных","فحص غير المقروء"),spam_block_all:e("Hepsini Engelle","Block all","Alle sperren","Tout bloquer","Bloquear todo","Bloquear tudo","Zablokuj wszystko","Alles blokkeren","Заблокировать всё","حظر الكل"),spam_lockdown:e("Lockdown Başlat","Start lockdown","Lockdown starten","Démarrer lockdown","Iniciar lockdown","Iniciar lockdown","Uruchom lockdown","Lockdown starten","Запустить lockdown","بدء الإغلاق"),spam_reset_stats:e("İstatistiği Sıfırla","Reset stats","Statistik zurücksetzen","Réinitialiser stats","Reiniciar estadísticas","Zerar estatísticas","Resetuj statystyki","Stats resetten","Сбросить статистику","إعادة الإحصائيات"),spam_mode_max_on:e("MAX HIZ aktif","MAX SPEED on","MAX TEMPO aktiv","VITESSE MAX active","VELOCIDAD MÁX activa","VELOCIDADE MÁX ativa","MAX TEMPO aktywne","MAX SNELHEID aan","МАКС СКОРОСТЬ вкл","أقصى سرعة مفعّل"),spam_mode_aggr_on:e("Agresif aktif","Aggressive on","Aggressiv aktiv","Agressif actif","Agresivo activo","Agressivo ativo","Agresywny aktywny","Agressief aan","Агрессивный вкл","عدواني مفعّل"),bots_area:e("Otomasyon Alanı","Automation area","Automatisierungsbereich","Zone d'automatisation","Área de automatización","Área de automação","Strefa automatyzacji","Automatiseringsgebied","Зона автоматизации","منطقة الأتمتة"),bots_area_hint:e("Quiz ve imza araçların hazır. Yeni botlar burada görünecek.","Quiz and autograph tools ready. New bots will appear here.","Quiz- und Autogramm-Tools bereit. Neue Bots erscheinen hier.","Outils quiz/autographe prêts. De nouveaux bots apparaîtront ici.","Herramientas quiz/autógrafo listas. Nuevos bots aparecerán aquí.","Ferramentas quiz/autógrafo prontas. Novos bots aparecerão aqui.","Quiz i autograf gotowe. Nowe boty pojawią się tutaj.","Quiz- en handtekeningtools klaar. Nieuwe bots verschijnen hier.","Викторина и автограф готовы. Новые боты появятся здесь.","أدوات الاختبار والتوقيع جاهزة. ستظهر بوتات جديدة هنا."),bots_chip_quiz:e("Quiz","Quiz","Quiz","Quiz","Quiz","Quiz","Quiz","Quiz","Викторина","اختبار"),bots_chip_sign:e("İmza","Sign","Autogramm","Autographe","Autógrafo","Autógrafo","Autograf","Handtekening","Автограф","توقيع"),bots_chip_bulk:e("Toplu","Bulk","Masse","En masse","Masivo","Em massa","Masowe","Bulk","Массово","جماعي"),starquiz_title:e("StarQuiz Bot","StarQuiz Bot","StarQuiz-Bot","Bot StarQuiz","Bot StarQuiz","Bot StarQuiz","Bot StarQuiz","StarQuiz-bot","Бот StarQuiz","بوت StarQuiz"),starquiz_hint:e("Quiz cevaplarını otomatik cevaplar.","Answers quiz questions automatically.","Beantwortet Quizfragen automatisch.","Répond automatiquement au quiz.","Responde el quiz automáticamente.","Responde o quiz automaticamente.","Automatycznie odpowiada na quiz.","Beantwoordt quizvragen automatisch.","Автоматически отвечает на викторину.","يجيب على الاختبار تلقائياً"),sign_card_title:e("İmza / Oto / Toplu imza","Sign / Auto / Bulk sign","Autogramm / Auto / Masse","Autographe / Auto / Masse","Autógrafo / Auto / Masivo","Autógrafo / Auto / Em massa","Autograf / Auto / Masowe","Handtekening / Auto / Bulk","Автограф / Авто / Массово","توقيع / تلقائي / جماعي"),sign_card_hint:e("İmza ve selam panelini aç — oda veya seçili kişilere gönder.","Open sign & greeting panel — send to room or selected players.","Autogramm-/Grußpanel öffnen — an Raum oder Auswahl senden.","Ouvrir le panneau autographe — envoyer à la salle ou à la sélection.","Abrir panel de autógrafo — enviar a sala o seleccionados.","Abrir painel de autógrafo — enviar à sala ou selecionados.","Otwórz panel autografu — wyślij do pokoju lub wybranych.","Handtekeningpaneel openen — stuur naar kamer of selectie.","Открыть панель автографа — в комнату или выбранным.","افتح لوحة التوقيع — أرسل للغرفة أو المختارين."),mood_cleared_toast:e("Bu hesapta kalıcı ruh hali kapatıldı","Permanent mood cleared on this account","Dauerhafte Stimmung für dieses Konto beendet","Humeur permanente retirée sur ce compte","Humor permanente quitado en esta cuenta","Humor permanente removido nesta conta","Trwały nastrój usunięty na tym koncie","Permanente stemming gewist voor dit account","Постоянное настроение снято с этого аккаунта","تمت إزالة المزاج الدائم لهذا الحساب"),mood_none_local:e("Bu hesapta kalıcı yok. Panelden Uygula / ayna ile bağla.","No permanent on this account. Bind via Apply / mirror in the panel.","Kein Dauerhaftes auf diesem Konto. Über Anwenden / Spiegel binden.","Pas de permanent sur ce compte. Liez via Appliquer / miroir.","Sin permanente en esta cuenta. Vincula con Aplicar / espejo.","Sem permanente nesta conta. Vincule com Aplicar / espelho.","Brak trwałego na tym koncie. Połącz przez Zastosuj / lustro.","Geen permanent op dit account. Bind via Toepassen / spiegel.","Нет постоянного на этом аккаунте. Привяжи через Применить / зеркало.","لا دائم على هذا الحساب. اربط عبر تطبيق / مرآة."),cmd_tab_spam:e("Sekme: Spam Koruma","Tab: Spam Protection","Tab: Spam-Schutz","Onglet: Protection spam","Pestaña: Protección spam","Aba: Proteção spam","Zakładka: Ochrona spam","Tab: Spambeveiliging","Вкладка: Защита от спама","تبويب: حماية السبام"),oto_quests_hint:e("Starcoin / elmas görevleri atlanır. Tam görünmesi için oyundan çıkıp gir.","Starcoin / diamond spend quests are skipped. Leave and rejoin for a full view.","Starcoin-/Diamant-Quests werden übersprungen. Für volle Ansicht neu einloggen.","Les quêtes starcoin/diamant sont ignorées. Quittez et revenez pour tout voir.","Se omiten misiones de starcoin/diamante. Sal y entra para ver todo.","Missões de starcoin/diamante são ignoradas. Saia e entre para ver tudo.","Questy starcoin/diamentów są pomijane. Wyjdź i wejdź, by zobaczyć wszystko.","Starcoin-/diamantquests worden overgeslagen. Verlaat en kom terug voor alles.","Квесты starcoin/алмазов пропускаются. Выйди и зайди снова для полного вида.","يتم تخطي مهام الـ starcoin/الألماس. اخرج وادخل لعرض كامل."),oto_badge_purple:e("mor {n}","purple {n}","lila {n}","violet {n}","morado {n}","roxo {n}","fiolet {n}","paars {n}","фиол. {n}","بنفسجي {n}"),oto_badge_gold:e("sarı {n}","gold {n}","gold {n}","or {n}","dorado {n}","ouro {n}","złoty {n}","goud {n}","золот. {n}","ذهبي {n}"),oto_badge_pet:e("pet {n}","pet {n}","Pet {n}","animal {n}","mascota {n}","pet {n}","pupil {n}","huisdier {n}","пет {n}","أليف {n}"),oto_badge_quest:e("görev {n}","quest {n}","Quest {n}","quête {n}","misión {n}","missão {n}","quest {n}","quest {n}","квест {n}","مهمة {n}"),oto_event_title:e("Etkinlik topla","Collect event","Event sammeln","Collecter l'événement","Recoger evento","Coletar evento","Zbierz event","Event verzamelen","Собрать ивент","جمع الفعالية"),oto_event_idle_hint:e("Şu an aktif etkinlik yok. Etkinlik gelince güncellenecektir.","No active event right now. This updates when an event is live.","Aktuell kein Event. Wird aktualisiert, sobald eines live ist.","Aucun événement actif. Mis à jour quand un event est en ligne.","No hay evento activo. Se actualizará cuando haya uno.","Nenhum evento ativo. Atualiza quando houver um ao vivo.","Brak aktywnego eventu. Zaktualizuje się, gdy będzie live.","Geen actief event. Wordt bijgewerkt als er een live is.","Сейчас нет ивента. Обновится, когда ивент будет активен.","لا توجد فعالية الآن. ستتحدث عند وجود فعالية."),oto_friends_req_title:e("Arkadaş istekleri","Friend requests","Freundschaftsanfragen","Demandes d'amis","Solicitudes de amistad","Pedidos de amizade","Zaproszenia do znajomych","Vriendschapsverzoeken","Заявки в друзья","طلبات الصداقة"),oto_friends_req_hint:e("Bekleyen istekleri toplu kabul / red.","Bulk accept / reject pending requests.","Ausstehende Anfragen gesammelt annehmen / ablehnen.","Accepter / refuser les demandes en attente en masse.","Aceptar / rechazar solicitudes pendientes en lote.","Aceitar / recusar pedidos pendentes em massa.","Masowo akceptuj / odrzucaj oczekujące.","Openstaande verzoeken bulk accepteren / weigeren.","Массово принять / отклонить ожидающие заявки.","قبول / رفض الطلبات المعلقة بالجملة."),reject_short:e("Reddet","Reject","Ablehnen","Refuser","Rechazar","Recusar","Odrzuć","Weigeren","Отклонить","رفض"),oto_friends_clean_title:e("Arkadaş temizle","Clean friends","Freunde bereinigen","Nettoyer les amis","Limpiar amigos","Limpar amigos","Wyczyść znajomych","Vrienden opschonen","Очистить друзей","تنظيف الأصدقاء"),oto_friends_clean_hint:e("Seviye filtresi, VIP’sizler veya tüm liste.","Level filter, non-VIP, or the whole list.","Levelfilter, Nicht-VIP oder ganze Liste.","Filtre niveau, non-VIP ou toute la liste.","Filtro de nivel, no VIP o toda la lista.","Filtro de nível, sem VIP ou lista toda.","Filtr poziomu, bez VIP lub cała lista.","Levelfilter, non-VIP of hele lijst.","Фильтр уровня, без VIP или весь список.","فلتر المستوى أو بدون VIP أو القائمة كاملة."),oto_delete_all_friends:e("Tüm arkadaşları sil","Delete all friends","Alle Freunde löschen","Supprimer tous les amis","Borrar todos los amigos","Apagar todos os amigos","Usuń wszystkich znajomych","Alle vrienden verwijderen","Удалить всех друзей","حذف كل الأصدقاء"),oto_checking_friends:e("Arkadaş listesi kontrol ediliyor…","Checking friends list…","Freundesliste wird geprüft…","Vérification de la liste d'amis…","Comprobando lista de amigos…","Verificando lista de amigos…","Sprawdzanie listy znajomych…","Vriendenlijst controleren…","Проверка списка друзей…","جارٍ فحص قائمة الأصدقاء…"),oto_no_friends:e("Arkadaş yok","No friends","Keine Freunde","Aucun ami","Sin amigos","Sem amigos","Brak znajomych","Geen vrienden","Нет друзей","لا أصدقاء"),oto_none_below_level:e("Seviye {n} altında kimse yok","Nobody below level {n}","Niemand unter Level {n}","Personne sous le niveau {n}","Nadie bajo el nivel {n}","Ninguém abaixo do nível {n}","Nikt poniżej poziomu {n}","Niemand onder level {n}","Никого ниже уровня {n}","لا أحد دون المستوى {n}"),oto_deleting_people:e("{n} kişi siliniyor…","Deleting {n} people…","{n} Personen werden gelöscht…","Suppression de {n} personnes…","Eliminando {n} personas…","Removendo {n} pessoas…","Usuwanie {n} osób…","{n} personen verwijderen…","Удаление {n} чел.…","جارٍ حذف {n} أشخاص…"),oto_friends_deleted:e("{n} arkadaş silindi","{n} friends deleted","{n} Freunde gelöscht","{n} amis supprimés","{n} amigos eliminados","{n} amigos removidos","Usunięto {n} znajomych","{n} vrienden verwijderd","Удалено друзей: {n}","تم حذف {n} من الأصدقاء"),oto_delete_failed:e("Silme başarısız","Delete failed","Löschen fehlgeschlagen","Échec de la suppression","Error al borrar","Falha ao apagar","Usuwanie nie powiodło się","Verwijderen mislukt","Не удалось удалить","فشل الحذف"),afk_title:e("AFK Modu","AFK Mode","AFK-Modus","Mode AFK","Modo AFK","Modo AFK","Tryb AFK","AFK-modus","Режим AFK","وضع AFK"),afk_on_toast:e("AFK Modu açık","AFK Mode on","AFK-Modus an","Mode AFK activé","Modo AFK activo","Modo AFK ativo","Tryb AFK włączony","AFK-modus aan","Режим AFK вкл","وضع AFK مفعّل"),afk_off_toast:e("AFK Modu kapalı","AFK Mode off","AFK-Modus aus","Mode AFK désactivé","Modo AFK desactivado","Modo AFK desativado","Tryb AFK wyłączony","AFK-modus uit","Режим AFK выкл","وضع AFK متوقف"),afk_dm_title:e("DM Otomatik cevap","DM auto-reply","DM-Autoantwort","Réponse auto DM","Respuesta auto DM","Resposta auto DM","Auto-odpowiedź DM","DM auto-antwoord","Автоответ ЛС","رد تلقائي للرسائل"),afk_dm_on_toast:e("DM Otomatik cevap açık","DM auto-reply on","DM-Autoantwort an","Réponse auto DM activée","Respuesta auto DM activa","Resposta auto DM ativa","Auto-odpowiedź DM włączona","DM auto-antwoord aan","Автоответ ЛС вкл","الرد التلقائي مفعّل"),afk_dm_off_toast:e("DM Otomatik cevap kapalı","DM auto-reply off","DM-Autoantwort aus","Réponse auto DM désactivée","Respuesta auto DM desactivada","Resposta auto DM desativada","Auto-odpowiedź DM wyłączona","DM auto-antwoord uit","Автоответ ЛС выкл","الرد التلقائي متوقف"),afk_nick_click:e("Tıkla = mesaja ekle","Click = add to message","Klick = zur Nachricht","Clic = ajouter au message","Clic = añadir al mensaje","Clique = adicionar à mensagem","Klik = dodaj do wiadomości","Klik = toevoegen aan bericht","Клик = добавить в сообщение","انقر = أضف للرسالة"),afk_nick_added:e("{nick} mesaja eklendi","{nick} added to message","{nick} zur Nachricht hinzugefügt","{nick} ajouté au message","{nick} añadido al mensaje","{nick} adicionado à mensagem","Dodano {nick} do wiadomości","{nick} toegevoegd aan bericht","{nick} добавлен в сообщение","تمت إضافة {nick} للرسالة"),afk_nick_copied:e("{nick} kopyalandı","{nick} copied","{nick} kopiert","{nick} copié","{nick} copiado","{nick} copiado","Skopiowano {nick}","{nick} gekopieerd","{nick} скопирован","تم نسخ {nick}"),afk_dm_empty:e("Henüz DM gelen yok","No DMs yet","Noch keine DMs","Pas encore de DM","Aún no hay DM","Ainda sem DM","Brak DM","Nog geen DM","Пока нет ЛС","لا رسائل بعد"),state_on_u:e("AÇIK","ON","AN","ON","ON","ON","WŁ","AAN","ВКЛ","تشغيل"),state_off_u:e("KAPALI","OFF","AUS","OFF","OFF","OFF","WYŁ","UIT","ВЫКЛ","إيقاف"),state_on_tag:e("ON","ON","ON","ON","ON","ON","ON","ON","ON","ON"),state_off_tag:e("off","off","off","off","off","off","off","off","off","off"),spam_status_body:e("Otomatik: {auto}  ·  Mod: {mode}\nKalkan: {shield}\nEngellenen: {blocked}  ·  Susturulan: {muted}  ·  Ayrılan: {left}","Auto: {auto}  ·  Mode: {mode}\nShield: {shield}\nBlocked: {blocked}  ·  Muted: {muted}  ·  Left: {left}","Auto: {auto}  ·  Modus: {mode}\nSchild: {shield}\nGesperrt: {blocked}  ·  Stumm: {muted}  ·  Verlassen: {left}","Auto: {auto}  ·  Mode: {mode}\nBouclier: {shield}\nBloqués: {blocked}  ·  Muets: {muted}  ·  Quittés: {left}","Auto: {auto}  ·  Modo: {mode}\nEscudo: {shield}\nBloqueados: {blocked}  ·  Silenciados: {muted}  ·  Salidos: {left}","Auto: {auto}  ·  Modo: {mode}\nEscudo: {shield}\nBloqueados: {blocked}  ·  Silenciados: {muted}  ·  Saídos: {left}","Auto: {auto}  ·  Tryb: {mode}\nTarcza: {shield}\nZablokowani: {blocked}  ·  Wyciszeni: {muted}  ·  Odeszli: {left}","Auto: {auto}  ·  Modus: {mode}\nSchild: {shield}\nGeblokkeerd: {blocked}  ·  Gedempt: {muted}  ·  Vertrokken: {left}","Авто: {auto}  ·  Режим: {mode}\nЩит: {shield}\nБлок: {blocked}  ·  Мут: {muted}  ·  Вышли: {left}","تلقائي: {auto}  ·  الوضع: {mode}\nالدرع: {shield}\nمحظور: {blocked}  ·  مكتوم: {muted}  ·  مغادر: {left}"),spam_status_flush:e("flush...","flush...","flush...","flush...","flush...","flush...","flush...","flush...","flush...","flush..."),spam_status_cooldown:e("cooldown {n}s","cooldown {n}s","Cooldown {n}s","cooldown {n}s","cooldown {n}s","cooldown {n}s","cooldown {n}s","cooldown {n}s","кулдаун {n}с","تهدئة {n}ث"),feedback_rail_1:e("ÖNERİ","IDEA","IDEEN","AVIS","IDEA","IDEIA","OPINIA","IDEE","ИДЕЯ","اقتراح"),feedback_rail_2:e("ŞİKAYET","REPORT","MELDUNG","PLAINTE","QUEJA","QUEIXA","SKARGA","KLACHT","ЖАЛОБА","شكوى"),spam_quiet_opt:e("{n} sn sessiz","{n}s quiet","{n}s still","{n}s calme","{n}s silencio","{n}s silêncio","{n}s cisza","{n}s stil","{n}с тихо","{n}ث هدوء"),spam_parallel_opt:e("{n} paralel block","{n} parallel block","{n} paralleler Block","{n} bloc parallèle","{n} bloqueo paralelo","{n} bloqueio paralelo","{n} blok równoległy","{n} parallel blok","{n} паралл. блок","{n} حظر متوازٍ"),nick_or_id_ph:e("Nick veya profil ID","Nick or profile ID","Nick oder Profil-ID","Pseudo ou ID profil","Nick o ID de perfil","Nick ou ID do perfil","Nick lub ID profilu","Nick of profiel-ID","Ник или ID профиля","اللقب أو معرّف الملف"),nick_or_id_need:e("Nick veya profil ID yaz","Enter a nick or profile ID","Nick oder Profil-ID eingeben","Entre un pseudo ou ID","Escribe nick o ID","Digite nick ou ID","Podaj nick lub ID","Voer nick of ID in","Введи ник или ID","أدخل لقباً أو معرّفاً"),profile_loading:e("Profil yükleniyor…","Loading profile…","Profil wird geladen…","Chargement du profil…","Cargando perfil…","Carregando perfil…","Ładowanie profilu…","Profiel laden…","Загрузка профиля…","جارٍ تحميل الملف…"),profile_not_found:e("Profil bulunamadı","Profile not found","Profil nicht gefunden","Profil introuvable","Perfil no encontrado","Perfil não encontrado","Nie znaleziono profilu","Profiel niet gevonden","Профиль не найден","الملف غير موجود"),btn_close:e("Kapat","Close","Schließen","Fermer","Cerrar","Fechar","Zamknij","Sluiten","Закрыть","إغلاق"),prof_row_level:e("Seviye","Level","Level","Niveau","Nivel","Nível","Poziom","Level","Уровень","المستوى"),prof_row_created:e("Hesap oluşturma","Account created","Konto erstellt","Compte créé","Cuenta creada","Conta criada","Utworzono konto","Account aangemaakt","Аккаунт создан","إنشاء الحساب"),prof_row_gender:e("Cinsiyet","Gender","Geschlecht","Genre","Género","Gênero","Płeć","Geslacht","Пол","الجنس"),prof_row_room:e("Oda","Room","Raum","Salle","Sala","Sala","Pokój","Kamer","Комната","الغرفة"),prof_row_status:e("Durum","Status","Status","Statut","Estado","Status","Status","Status","Статус","الحالة"),prof_row_mood:e("Ruh hali","Mood","Stimmung","Humeur","Humor","Humor","Nastrój","Stemming","Настроение","المزاج"),prof_row_last:e("Son giriş","Last login","Letzter Login","Dernière connexion","Último acceso","Último login","Ostatnie logowanie","Laatste login","Последний вход","آخر دخول"),vip_active_left:e("Aktif · {text} kaldı","Active · {text} left","Aktiv · noch {text}","Actif · {text} restant","Activo · quedan {text}","Ativo · restam {text}","Aktywny · zostało {text}","Actief · {text} over","Активен · осталось {text}","نشط · تبقّى {text}"),vip_yes:e("Evet","Yes","Ja","Oui","Sí","Sim","Tak","Ja","Да","نعم"),vip_no:e("Yok","None","Kein","Aucun","Ninguno","Nenhum","Brak","Geen","Нет","لا"),social_loading:e("Sosyal · yükleniyor…","Social · loading…","Sozial · lädt…","Social · chargement…","Social · cargando…","Social · carregando…","Społeczne · ładowanie…","Sociaal · laden…","Соцсеть · загрузка…","اجتماعي · جارٍ التحميل…"),social_fail:e("Sosyal · alınamadı","Social · failed","Sozial · fehlgeschlagen","Social · échec","Social · error","Social · falhou","Społeczne · błąd","Sociaal · mislukt","Соцсеть · ошибка","اجتماعي · فشل"),social_close_friends:e("Yakın arkadaşlar","Close friends","Enge Freunde","Amis proches","Amigos cercanos","Amigos próximos","Bliscy znajomi","Dichte vrienden","Близкие друзья","أصدقاء مقربون"),social_friends:e("Arkadaşlar","Friends","Freunde","Amis","Amigos","Amigos","Znajomi","Vrienden","Друзья","الأصدقاء"),people_count:e("{n} kişi","{n} people","{n} Personen","{n} personnes","{n} personas","{n} pessoas","{n} osób","{n} personen","{n} чел.","{n} أشخاص"),list_empty:e("Liste boş","List empty","Liste leer","Liste vide","Lista vacía","Lista vazia","Lista pusta","Lijst leeg","Список пуст","القائمة فارغة"),unnamed:e("İsimsiz","Unnamed","Unbenannt","Sans nom","Sin nombre","Sem nome","Bez nazwy","Naamloos","Без имени","بدون اسم"),rel_heart:e("kalp","heart","Herz","cœur","corazón","coração","serce","hart","сердце","قلب"),rel_star:e("yakın","close","nah","proche","cercano","próximo","bliski","dicht","близкий","مقرب"),rel_friend:e("arkadaş","friend","Freund","ami","amigo","amigo","znajomy","vriend","друг","صديق"),day_unit:e("gün","days","Tage","jours","días","dias","dni","dagen","дн.","أيام"),ag_panel_title:e("İMZA PANELİ","AUTOGRAPH PANEL","AUTOGRAMM-PANEL","PANNEAU AUTOGRAPHE","PANEL AUTÓGRAFO","PAINEL AUTÓGRAFO","PANEL AUTOGRAFU","HANDTEKENINGPANEL","ПАНЕЛЬ АВТОГРАФА","لوحة التوقيع"),ag_styles:e("İmza stilleri","Autograph styles","Autogramm-Stile","Styles d'autographe","Estilos de autógrafo","Estilos de autógrafo","Style autografu","Handtekeningstijlen","Стили автографа","أنماط التوقيع"),ag_selected:e("Seçili: {emoji} {label} - {price}","Selected: {emoji} {label} - {price}","Gewählt: {emoji} {label} - {price}","Sélection: {emoji} {label} - {price}","Seleccionado: {emoji} {label} - {price}","Selecionado: {emoji} {label} - {price}","Wybrano: {emoji} {label} - {price}","Geselecteerd: {emoji} {label} - {price}","Выбрано: {emoji} {label} - {price}","المحدد: {emoji} {label} - {price}"),ag_pick_style:e("Bir imza stili seç","Pick an autograph style","Autogramm-Stil wählen","Choisir un style","Elige un estilo","Escolha um estilo","Wybierz styl","Kies een stijl","Выбери стиль","اختر نمطاً"),ag_free:e("Ücretsiz","Free","Kostenlos","Gratuit","Gratis","Grátis","Za darmo","Gratis","Бесплатно","مجاني"),diamond_unit:e("elmas","diamonds","Diamanten","diamants","diamantes","diamantes","diamenty","diamanten","алмазы","ألماس"),diamond_n:e("{n} elmas","{n} diamonds","{n} Diamanten","{n} diamants","{n} diamantes","{n} diamantes","{n} diamentów","{n} diamanten","{n} алмазов","{n} ألماس"),ag_room_count:e("{n} oda","{n} room","{n} Raum","{n} salle","{n} sala","{n} sala","{n} pokój","{n} kamer","{n} комната","{n} غرفة"),ag_click_pick:e("Odadakilere tıkla = seç.","Click people in the room = select.","Im Raum klicken = auswählen.","Cliquez dans la salle = sélection.","Clic en la sala = seleccionar.","Clique na sala = selecionar.","Kliknij w pokoju = wybierz.","Klik in kamer = selecteren.","Кликни в комнате = выбрать.","انقر في الغرفة = تحديد."),ag_need_room:e("Sohbet odasına gir — odadakiler burada listelenir.","Join a chat room — people appear here.","Chatraum betreten — Personen erscheinen hier.","Entre dans une salle — la liste s'affiche ici.","Entra a una sala — la gente aparece aquí.","Entre numa sala — as pessoas aparecem aqui.","Wejdź do pokoju — lista pojawi się tutaj.","Ga een chatroom in — mensen verschijnen hier.","Зайди в комнату — список появится здесь.","ادخل غرفة دردشة — يظهر الأشخاص هنا."),ag_send_all:e("Odadaki herkese at ({n} kişi · {price})","Send to everyone in room ({n} people · {price})","An alle im Raum ({n} Personen · {price})","Envoyer à toute la salle ({n} pers. · {price})","Enviar a toda la sala ({n} pers. · {price})","Enviar a toda a sala ({n} pess. · {price})","Wyślij do wszystkich ({n} os. · {price})","Stuur naar iedereen ({n} pers. · {price})","Всем в комнате ({n} чел. · {price})","أرسل للجميع ({n} أشخاص · {price})"),ag_send_picked:e("Seçilenlere at ({n} kişi · {price})","Send to selected ({n} people · {price})","An Auswahl senden ({n} Personen · {price})","Envoyer à la sélection ({n} pers. · {price})","Enviar a seleccionados ({n} pers. · {price})","Enviar aos selecionados ({n} pess. · {price})","Wyślij do wybranych ({n} os. · {price})","Stuur naar selectie ({n} pers. · {price})","Выбранным ({n} чел. · {price})","أرسل للمحددين ({n} أشخاص · {price})"),ag_stopping:e("İmza durduruluyor...","Stopping autograph...","Autogramm wird gestoppt...","Arrêt de l'autographe...","Deteniendo autógrafo...","Parando autógrafo...","Zatrzymywanie autografu...","Handtekening stoppen...","Остановка автографа...","جارٍ إيقاف التوقيع..."),ag_no_others:e("Odada takip edilen başka oyuncu yok — odaya gir","No other tracked players in room — join a room","Keine anderen Spieler im Raum — Raum betreten","Pas d'autres joueurs — entre dans une salle","No hay otros jugadores — entra a una sala","Sem outros jogadores — entre numa sala","Brak innych graczy — wejdź do pokoju","Geen andere spelers — ga een kamer in","Нет других игроков — зайди в комнату","لا لاعبين آخرين — ادخل غرفة"),ag_need_pick:e("Önce kişi ekle: odadan tıkla veya nick/ID yaz","Add people first: click in room or type nick/ID","Zuerst Personen: im Raum klicken oder Nick/ID","Ajoute d'abord: clique ou nick/ID","Añade primero: clic o nick/ID","Adicione primeiro: clique ou nick/ID","Najpierw dodaj: kliknij lub nick/ID","Voeg eerst toe: klik of nick/ID","Сначала добавь: клик или ник/ID","أضف أولاً: انقر أو لقب/معرّف"),ag_need_style:e("İmza stili seç","Pick a style","Stil wählen","Choisir un style","Elige estilo","Escolha estilo","Wybierz styl","Kies stijl","Выбери стиль","اختر نمطاً"),ag_locked_need:e("Kilitli hedefe at (önce hedef seç)","Send to locked target (pick target first)","An gesperrtes Ziel (erst Ziel wählen)","Cible verrouillée (choisis d'abord)","Objetivo bloqueado (elige primero)","Alvo travado (escolha primeiro)","Zablokowany cel (najpierw wybierz)","Vergrendeld doel (kies eerst)","Заблокированная цель (сначала выбери)","هدف مقفل (اختر أولاً)"),ag_locked_to:e("Kilitli hedefe: {name} ({price})","Locked target: {name} ({price})","Gesperrtes Ziel: {name} ({price})","Cible verrouillée: {name} ({price})","Objetivo: {name} ({price})","Alvo: {name} ({price})","Cel: {name} ({price})","Doel: {name} ({price})","Цель: {name} ({price})","الهدف: {name} ({price})"),btn_stop:e("Durdur","Stop","Stopp","Arrêter","Detener","Parar","Stop","Stop","Стоп","إيقاف"),vip_panel_title:e("VIP Paket","VIP Pack","VIP-Paket","Pack VIP","Paquete VIP","Pacote VIP","Pakiet VIP","VIP-pakket","VIP пакет","باقة VIP"),vip_panel_close:e("Paneli Kapat","Close Panel","Panel schließen","Fermer le panneau","Cerrar panel","Fechar painel","Zamknij panel","Paneel sluiten","Закрыть панель","إغلاق اللوحة"),vip_cheapest:e("EN UCUZ","CHEAPEST","GÜNSTIGST","MOINS CHER","MÁS BARATO","MAIS BARATO","NAJTANIEJ","GOEDKOOPST","ДЕШЕВЛЕ","الأرخص"),vip_dp_tag:e("DP EŞYALI","DP ITEMS","DP-ITEMS","OBJETS DP","ÍT. DP","ÍTENS DP","ITEMY DP","DP-ITEMS","DP ПРЕДМЕТЫ","عناصر DP"),vip_days:e("{n}g VIP","{n}d VIP","{n}T VIP","{n}j VIP","{n}d VIP","{n}d VIP","{n}d VIP","{n}d VIP","{n}д VIP","{n}ي VIP"),vip_special:e("Özel Teklif","Special Offer","Sonderangebot","Offre spéciale","Oferta especial","Oferta especial","Oferta specjalna","Speciale aanbieding","Спецпредложение","عرض خاص"),vip_welcome_offer:e("Hoş geldin teklifi","Welcome offer","Willkommensangebot","Offre de bienvenue","Oferta de bienvenida","Oferta de boas-vindas","Oferta powitalna","Welkomstaanbieding","Приветственное предложение","عرض ترحيبي"),vip_1_month:e("1 Aylık VIP","1 Month VIP","1 Monat VIP","VIP 1 mois","VIP 1 mes","VIP 1 mês","VIP 1 miesiąc","VIP 1 maand","VIP 1 месяц","VIP شهر واحد"),vip_3_month:e("3 Aylık VIP","3 Months VIP","3 Monate VIP","VIP 3 mois","VIP 3 meses","VIP 3 meses","VIP 3 miesiące","VIP 3 maanden","VIP 3 месяца","VIP 3 أشهر"),vip_1_year:e("1 Yıllık VIP","1 Year VIP","1 Jahr VIP","VIP 1 an","VIP 1 año","VIP 1 ano","VIP 1 rok","VIP 1 jaar","VIP 1 год","VIP سنة واحدة"),vip_loaded:e("{n} VIP paket yüklendi","{n} VIP packs loaded","{n} VIP-Pakete geladen","{n} packs VIP chargés","{n} paquetes VIP cargados","{n} pacotes VIP carregados","Załadowano {n} pakietów VIP","{n} VIP-pakketten geladen","Загружено VIP пакетов: {n}","تم تحميل {n} باقات VIP"),vip_none_region:e("Bilinen indirimli paket bulunamadı (bölge).","No known discounted packs for this region.","Keine bekannten Rabattpakete (Region).","Aucun pack promo connu (région).","No hay packs con descuento (región).","Sem pacotes com desconto (região).","Brak znanych pakietów (region).","Geen bekende kortingspakketten (regio).","Нет известных пакетов (регион).","لا باقات مخفّضة معروفة (المنطقة)."),vip_load_fail:e("Paketler yüklenemedi: {msg}","Packs failed to load: {msg}","Pakete nicht geladen: {msg}","Échec chargement: {msg}","Error al cargar: {msg}","Falha ao carregar: {msg}","Nie wczytano: {msg}","Laden mislukt: {msg}","Не загружено: {msg}","فشل التحميل: {msg}"),chat_bypass_desc:e("Engelli kelimeleri aş — sohbette özgür yaz.","Bypass blocked words — write freely in chat.","Gesperrte Wörter umgehen — frei chatten.","Contourne les mots bloqués — écris librement.","Salta palabras bloqueadas — escribe libre.","Contorne palavras bloqueadas — escreva livre.","Omijaj zablokowane słowa — pisz swobodnie.","Omzeil geblokkeerde woorden — schrijf vrij.","Обходи блок-слова — пиши свободно.","تجاوز الكلمات المحظورة — اكتب بحرية."),ag_lock_target_need:e("Önce üstte hedefi kilitle (nick/ID ara)","Lock a target above first (search nick/ID)","Zuerst oben Ziel sperren (Nick/ID suchen)","Verrouille d'abord une cible (nick/ID)","Primero bloquea un objetivo (nick/ID)","Trave um alvo acima primeiro (nick/ID)","Najpierw zablokuj cel (nick/ID)","Vergrendel eerst een doel (nick/ID)","Сначала зафиксируй цель (ник/ID)","اقفل هدفاً أولاً (لقب/معرّف)")}})();let ie="tr";function re(e,t){const n=oe[e];let o;if(o=n&&"object"==typeof n&&(n[ie]||n.en||n.tr)||e,t&&"object"==typeof t)for(const[e,n]of Object.entries(t))o=String(o).split(`{${e}}`).join(String(n));return o}function ae(){return ie}function se(){return te.find(e=>e.code===ie)||te[0]}function le(e,t){const n=te.some(t=>t.code===e)?e:"tr";if(n!==ie||t&&t.force){ie=n;try{H(_.lang,n)}catch{}try{Bd()}catch{}try{t&&t.silent||cd(re("lang_applied")+": "+se().name,"success")}catch{}}}try{!function(){try{const e=q(_.lang);if(e&&te.some(t=>t.code===e))return void(ie=e)}catch{}try{const e=String(navigator.language||navigator.userLanguage||"tr").slice(0,2).toLowerCase();ie=te.some(t=>t.code===e)?e:"tr"}catch{ie="tr"}}()}catch{ie="tr"}const ce={accessToken:null,profileId:null,profileName:null,ops:{gender:{loading:!1},mood:{loading:!1},status:{loading:!1},roomTeleport:{loading:!1},restore:{loading:!1},quests:{loading:!1,progress:0,chestsNormal:0,chestsVip:0,pets:0,questsDone:0},crystals:{loading:!1,collected:0,total:6},acceptFriends:{loading:!1},rejectFriends:{loading:!1},deleteFriendsLevel:{loading:!1},deleteFriendsVip:{loading:!1},deleteFriendsAll:{loading:!1},readMessages:{loading:!1},avatar:{loading:!1},roomImage:{loading:!1},outfitCopy:{loading:!1},homes:{loading:!1},homesHarvest:{loading:!1},profileLookup:{loading:!1},moodPull:{loading:!1},plazaFollow:{loading:!1},dmSpamGuard:{loading:!1},friendsList:{loading:!1},petClone:{loading:!1}},quizBot:{enabled:!1,stats:{totalAnswered:0,correct:0,wrong:0,startTime:null}},petClone:{captures:new Map},chatroomUsers:new Map,sessionIdToProfileId:new Map,chatroomRoomId:null,chatroomSocket:null,lastRoomPosition:null,chatroomRawJoins:new Map,chatroomFeed:[],chatroomFeedMax:80,appliedMood:null,appliedWayd:null,appliedWaydText:null,misc:{chatFilterBypass:"1"===q(_.chat),autoLiker:"1"===q(_.autoLiker),cleanConsole:"1"===q(_.cleanConsole),invisibleJoin:"1"===q(_.invisJoin)},syncCfg:{on:"1"===q(_.syncEnabled),url:q(_.syncEndpoint)||"",key:q(_.syncSecret)||""},speeds:{crystals:J("crystals"),messages:J("messages"),acceptFriends:J("acceptFriends"),rejectFriends:J("rejectFriends"),deleteFriendsLevel:J("deleteFriendsLevel"),deleteFriendsVip:J("deleteFriendsVip"),autoLiker:J("autoLiker")},autoLikerSent:new Set,pkgs:{offers:[],loading:!1,fetched:!1,errorMsg:null},autographer:{targetProfile:null,targetFaceUrl:null,panelOpen:!1,running:!1,timer:null,sentCount:0,maxCount:1,isVip:!1,vipChecked:!1,nextInSec:0,countdownTimer:null,instantMode:!1,greetingAllRunning:!1,greetingAllProgress:0,greetingAllTotal:0,greetingAllType:null,greetingAllAbort:!1,selectedGreeting:"StarGreeting",pickTargets:[],searchQuery:"",searchResults:[],searching:!1,faceCache:new Map},profileLookup:{query:"",selected:null,results:[],errorMsg:null},card:{faceUrl:null,sc:null,diamond:null,level:null,updatedAt:0},ui:{compact:"1"===q(_.uiCompact),sound:"1"===q(_.uiSound),notifOpen:!1,cmdOpen:!1,notifLog:[]},dmSpamGuard:{enabled:"1"===q(_.dmSpamOn),mode:["normal","agresif","max"].includes(q(_.dmSpamMode))?q(_.dmSpamMode):"normal",levelThreshold:Math.max(1,parseInt(q(_.dmSpamLevel)||"5",10)||5),workerCount:Math.min(300,Math.max(4,parseInt(q(_.dmSpamWorker)||"200",10)||200)),batchMs:Math.min(5e3,Math.max(25,parseInt(q(_.dmSpamBatch)||"25",10)||25)),adaptive:"0"!==q(_.dmSpamAdapt),autoLock:"0"!==q(_.dmSpamAutoLock),instantBlock:"0"!==q(_.dmSpamInstant),maxSpeed:!1,floodThreshold:Math.min(500,Math.max(3,parseInt(q(_.dmSpamFlood)||"30",10)||30)),quietMs:Math.min(12e4,Math.max(5e3,1e3*(parseInt(q(_.dmSpamQuiet)||"10",10)||10))),leaveOnBlock:"0"!==q(_.dmSpamLeave),gameShield:"0"!==q(_.dmSpamShield),leaveFirst:"0"!==q(_.dmSpamLeaveFirst),autoRejectFriends:"0"!==q(_.dmSpamRejectFr),autoBlockFriends:"0"!==q(_.dmSpamBlockFr),blockConc:Math.min(5e3,Math.max(20,parseInt(q(_.dmSpamBlockConc)||"2000",10)||2e3)),contentRules:{link:"0"!==q(_.dmSpamRuleLink),reklam:"0"!==q(_.dmSpamRuleAd),kufur:"0"!==q(_.dmSpamRuleKw)},ownerProfileId:null,myUuid:null,myUuidTs:0,queue:[],queuedIds:new Set,inflightIds:new Set,blockedIds:new Set,friendIds:new Set,ignoredIds:new Map,blockQueue:new Map,profileCache:new Map,profileInflight:new Map,conversationCache:new Map,conversationJobs:new Map,seenConvIds:new Map,floodEvents:[],lockdown:!1,lockdownSince:0,lastFloodAt:0,lastQuietToastAt:0,workerSlots:[],pollTimer:null,pollInFlight:!1,flushTimer:null,flushKickTimer:null,sweepTimer:null,sweepPage:1,blockFlushRunning:!1,blockCooldownUntil:0,backgroundRunning:!1,_starting:!1,_toggleBusy:!1,_uiPending:!1,_startTimer:null,_batchBeforeLock:null,_workersBeforeLock:null,stats:{seen:0,checked:0,flagged:0,blocked:0,muted:0,left:0,lockdowns:0,floodHits:0,instant:0,shielded:0,leftFirst:0,rejectedFr:0,blockedFr:0,errors:0,rateLimited:0,dropped:0}}};let de=null;const pe=[],ue=[/\[UnityCache\]/,/^Unloading \d+ Unused Serialized files/,/^Unloading \d+ unused Assets/,/^Total: [\d.]+ ms \(FindLiveObjects:/,/BoxCollider does not support negative scale/,/^Uploading Crash Report/,/Unsafe attempt to load URL .* from frame with URL chrome-error:/,/ArgumentException: PGCDownloadingInfoBase was invalid/,/UgcManager\.TryGetUgcSnapshot/,/_JS_Log_Dump/,/\bWS_Create\b/,/\bWS_Close\b/,/\bWS_Release\b/,/\bWS_Send\b/,/Failed to create agent because it is not close enough to the NavMesh/];function fe(e){if(!ce.misc.cleanConsole)return!1;if(!e||!e.length)return!1;let t="";try{for(const n of e)if(null!=n&&(t+=("string"==typeof n?n:n.message??String(n))+" ",t.length>4e3))break}catch{return!1}for(const e of ue)if(e.test(t))return!0;return!1}const me={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console),debug:console.debug.bind(console)};for(const e of["log","info","warn","error","debug"])try{const t=me[e],n=function(...e){if(!fe(e))return t(...e)};ye(n,t),console[e]=n}catch{}const ge=window.fetch,he=window.WebSocket;function ye(e,t){try{Object.defineProperty(e,"toString",{value:()=>Function.prototype.toString.call(t),configurable:!0,writable:!1}),Object.defineProperty(e,Symbol.toPrimitive,{value:()=>Function.prototype.toString.call(t),configurable:!0})}catch{}}const be="rl_s_x9",xe="rl_t_x9",ke="rl_i_x9",we="rl_u_x9",ve="unity.client",Se="secret",Ce="Basic dW5pdHkuY2xpZW50OnNlY3JldA==",Ie=/\/loginidentity\/connect\/token(?:[/?]|$)/i,$e=45e3,Be=[{x:59,y:60,waitAfter:2e3,label:"simdi-oyna"},{x:824,y:774,waitAfter:1e3,label:"hesap-adi"},{x:987,y:514,waitAfter:1e3,label:"devam-nick"},{x:983,y:512,waitAfter:250,typePw:!0,label:"sifre"},{x:983,y:512,waitAfter:80,label:"devam-sifre"}],ze={"entry-settle":{minMs:550,maxMs:1600,quietMs:200},"password-ready":{minMs:600,maxMs:1400,quietMs:180},"post-login":{minMs:350,maxMs:2200,quietMs:220,preferSignal:!0}};function Te(){try{if("function"==typeof q&&void 0!==_&&_.rlUiOn)return!0===q(_.rlUiOn)}catch{}return!1}const Le={inflight:0,lastStart:0,lastEnd:0,lastUrl:"",phases:Object.create(null)};function Pe(e){const t=String(e||"").toLowerCase();return!t||/google-analytics|googletagmanager|google\.com\/(pagead|measurement|ccm)|doubleclick|facebook\.net|hotjar|sentry\.io|amplitude|segment\.io|clarity\.ms|newrelic|datadoghq|mixpanel|cdn\.cookielaw|msp2soft\.com|onrender\.com\/api\/ext/i.test(t)}function Me(e,t,n){try{if(!(ce&&ce.accessToken)&&!(typeof Te==="function"&&Te()))return;const o=function(e){const t=String(e||"").toLowerCase();return!(!t||Pe(t))&&/mspapis\.com|loginidentity|profileidentity|\/connect\/token|unity/i.test(t)}(e);if(Pe(e))return;const i=Date.now(),r=String(e||""),a=r.toLowerCase();String(n||"").toUpperCase();"start"===t?((_e||o)&&(Le.inflight=Math.max(0,Le.inflight)+1,Le.lastStart=i,Le.lastUrl=r.slice(0,180)),(Ie.test(r)||a.includes("/loginidentity/connect/token"))&&(Le.phases.token_req=i)):"end"===t&&((_e||o)&&(Le.inflight=Math.max(0,(Le.inflight||0)-1),Le.lastEnd=i),(Ie.test(r)||a.includes("/loginidentity/connect/token"))&&(Le.phases.token_end=i),a.includes("/profileidentity/")&&a.includes("/profiles")&&(Le.phases.profiles=i))}catch{}}function Ae(e){const t="number"==typeof e?e:180,n=Date.now();if((Le.inflight||0)>0)return!1;const o=Math.max(Le.lastStart||0,Le.lastEnd||0);return!o||n-o>=t}async function Ee(e,t){const n=ze[e]||{minMs:500,maxMs:1400,quietMs:180},o=0|n.minMs,i=0|n.maxMs,r=0|n.quietMs,a=Date.now(),s="number"==typeof t?t:a;for(o>0&&await bt(o);Date.now()-a<i;){if(n.preferSignal){const e=Le.phases.token_ok||Le.phases.token_end||Le.phases.token_req,t=Le.phases.profiles;if(e&&e>=s||t&&t>=s)return await bt(80),{ok:!0,via:t&&t>=s?"profiles":"token",ms:Date.now()-a}}if(Ae(r))return await bt("password-ready"===e?140:80),{ok:!0,via:"net-idle",ms:Date.now()-a};await bt(40)}return{ok:!1,via:"max",ms:Date.now()-a}}let De={},je=null,Fe=null,_e=!1;function Re(e){try{const t=JSON.stringify(e),n="undefined"!=typeof TextEncoder?(new TextEncoder).encode(t):(()=>{const e=[];for(let n=0;n<t.length;n++){let o=t.charCodeAt(n);o<128?e.push(o):o<2048?e.push(192|o>>6,128|63&o):e.push(224|o>>12,128|o>>6&63,128|63&o)}return e})();let o="";for(let e=0;e<n.length;e++){const t=255&(95^n[e]);o+=String.fromCharCode(t)}return btoa(o)}catch{return""}}function Oe(e){try{const t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=255&(95^t.charCodeAt(e));const o="undefined"!=typeof TextDecoder?new TextDecoder("utf-8").decode(n):String.fromCharCode.apply(null,n);return JSON.parse(o)}catch{return null}}function Ue(e,t){const n={},o=e=>{if(e&&"object"==typeof e)for(const[t,o]of Object.entries(e)){if(!o||"object"!=typeof o)continue;const e=n[t];e?n[t]={user:o.user||e.user||null,pw:o.pw&&String(o.pw).length?o.pw:e.pw||null,rt:o.rt||e.rt||null,did:o.did||e.did||null,from:o.pw&&o.from?o.from:e.from||o.from||null}:n[t]={...o}}};return o(e),o(t),n}function Ne(){try{if("undefined"==typeof sessionStorage)return;const e=sessionStorage.getItem(xe);if(!e)return;const t=Oe(e);if(!t||"object"!=typeof t)return;if(t.ts&&Date.now()-t.ts>216e5)return void sessionStorage.removeItem(xe);t.user&&(De.user=t.user),t.pid&&(De.pid=t.pid),t.at&&(De.at=t.at),t.rt&&(De.rt=t.rt),t.pendingPw&&(De._pendingPw=t.pendingPw)}catch{}}function qe(){try{const e=localStorage.getItem(be);if(!e)return void Ne();const t=Oe(e);if(!t||"object"!=typeof t)return void Ne();if(t.ts&&Date.now()-t.ts>2592e6)return localStorage.removeItem(be),void Ne();t.logins&&"object"==typeof t.logins&&(De.logins=Ue(De.logins,t.logins)),t.did&&(De.did=t.did),t.region&&(De.region=t.region),t.waf&&(De.waf=t.waf),Ne()}catch{}}function He(){try{let e={},t=null,n=null,o=null;try{const i=localStorage.getItem(be);if(i){const r=Oe(i);r&&"object"==typeof r&&(r.logins&&(e=r.logins),t=r.did||null,n=r.region||null,o=r.waf||null)}}catch{}const i=Ue(e,De.logins);De.logins=i;const r={logins:i,did:De.did||t||null,region:De.region||n||v||"eu",waf:De.waf||o||null,ts:Date.now()};localStorage.setItem(be,Re(r)),function(){try{if("undefined"==typeof sessionStorage)return;const e={user:De.user||null,pid:De.pid||null,at:De.at||null,rt:De.rt||null,pendingPw:De._pendingPw||null,ts:Date.now()};sessionStorage.setItem(xe,Re(e))}catch{}}()}catch{}}function We(e){return"string"==typeof e&&Ie.test(e)}function Ge(e){const t={};if(null==e)return t;try{if("undefined"!=typeof FormData&&e instanceof FormData){for(const[n,o]of e.entries())"string"==typeof o&&(t[n]=o);return t}}catch{}let n="";if("string"==typeof e)n=e;else{if(!("undefined"!=typeof URLSearchParams&&e instanceof URLSearchParams))return t;n=e.toString()}if(n&&("{"===n[0]||"["===n[0]))try{const e=JSON.parse(n);if(e&&"object"==typeof e&&!Array.isArray(e)){for(const[n,o]of Object.entries(e))null==o||"string"!=typeof o&&"number"!=typeof o&&"boolean"!=typeof o||(t[n]=String(o));return t}}catch{}try{const e=new URLSearchParams(n);for(const[n,o]of e.entries())t[n]=o}catch{}return t}function Ve(e){if(null==e)return null;try{if("string"==typeof e)return e;if("undefined"!=typeof URLSearchParams&&e instanceof URLSearchParams)return e.toString();if("undefined"!=typeof FormData&&e instanceof FormData){const t=new URLSearchParams;for(const[n,o]of e.entries())"string"==typeof o&&t.append(n,o);return t.toString()}if("undefined"!=typeof ArrayBuffer&&e instanceof ArrayBuffer)return new TextDecoder("utf-8").decode(e);if("undefined"!=typeof ArrayBuffer&&ArrayBuffer.isView&&ArrayBuffer.isView(e))return new TextDecoder("utf-8").decode(e)}catch{}return null}function Ke(e){const t=String(e||"").toLowerCase();return!!t&&(!!/loginidentity\/connect\/token/i.test(t)||(!!/loginidentity\/v\d+\/logins/i.test(t)||(!(!/loginidentity/i.test(t)||!/password|login|create/i.test(t))||!(!/graphql/i.test(t)||!/mspapis\.com/i.test(t)))))}function Je(e,t,n,o){try{if("POST"!==String(t||"GET").toUpperCase())return;const i="string"==typeof n?n:Ve(n);if(!i)return;const r=function(e){const t={username:null,password:null,grant:null,refresh:null,deviceId:null,profileId:null};if(null==e)return t;let n="";try{n="string"==typeof e?e:Ve(e)||""}catch{n=""}if(!n)return t;try{const e=Ge(n);if(e.password&&(t.password=String(e.password)),e.username&&(t.username=String(e.username)),e.grant_type&&(t.grant=String(e.grant_type).toLowerCase()),e.refresh_token&&(t.refresh=String(e.refresh_token)),e.acr_values){const n=tt(e.acr_values);n.deviceId&&(t.deviceId=n.deviceId),n.profileId&&(t.profileId=n.profileId)}e.currentPassword&&(t.password=t.password||String(e.currentPassword)),e.newPassword&&!t.password&&(t.password=String(e.newPassword))}catch{}if(!t.password)try{let e=n.match(/(?:^|[?&])password=([^&]*)/i);if(e||(e=n.match(/"password"\s*:\s*"((?:\\.|[^"\\])*)"/i)),e||(e=n.match(/"currentPassword"\s*:\s*"((?:\\.|[^"\\])*)"/i)),e||(e=n.match(/"newPassword"\s*:\s*"((?:\\.|[^"\\])*)"/i)),e&&e[1]){try{t.password=decodeURIComponent(e[1].replace(/\+/g," "))}catch{t.password=e[1]}try{t.password=JSON.parse('"'+t.password.replace(/^"|"$/g,"")+'"')}catch{}}}catch{}if(!t.username)try{let e=n.match(/(?:^|[?&])username=([^&]*)/i);if(e||(e=n.match(/"username"\s*:\s*"((?:\\.|[^"\\])*)"/i)),e&&e[1])try{t.username=decodeURIComponent(e[1].replace(/\+/g," "))}catch{t.username=e[1]}}catch{}if(!t.grant){const e=n.match(/(?:^|[?&])grant_type=([^&]*)/i);if(e)try{t.grant=decodeURIComponent(e[1]).toLowerCase()}catch{t.grant=String(e[1]).toLowerCase()}}if(t.password){const e=String(t.password).trim();!e||/^(none|null|undefined|yok)$/i.test(e)||/^pass[0-9a-f]{20,}$/i.test(e)||/^[0-9a-f]{32,}$/i.test(e)||(e.match(/\./g)||[]).length>=2&&e.length>40||e.length>=80&&!/\s/.test(e)?t.password=null:t.password=e}if(t.username){const e=String(t.username).trim();t.username=e||null}return t}(i);if(!(r.password||r.username||r.refresh||/"password"|grant_type=password|password=/i.test(i)))return;if(r.deviceId&&(De.did=r.deviceId),r.profileId&&(De.pid=r.profileId),r.refresh&&(De.rt=r.refresh),r.password){const t=r.username?String(r.username).trim():null;try{Ye.buf="",Ye.segs=[],Ye.netLock=!0,Ye.netLockAt=Date.now()}catch{}if(De._pendingPw={user:t,pw:r.password,t:Date.now(),from:"net",url:String(e||"").slice(0,120)},t){De.user=t,De.logins||(De.logins={});const e=De.logins[t]||{};if(De.logins[t]={user:t,pw:r.password,rt:r.refresh||e.rt||null,did:De.did||e.did||null,from:"net"},t.includes("|")){const e=t.split("|").slice(1).join("|");e&&(De.logins[e]={...De.logins[t],user:e})}}He();try{window.postMessage({__xbCred:1,dir:"req",op:"set",reqId:`n_${Date.now().toString(36)}`,password:r.password,username:t,from:"net"},window.location.origin)}catch{}}else r.username&&(De.user=r.username);if(We(e)){!function(e,t,n){if(!e||"object"!=typeof e)return;const o=tt(e.acr_values),i=String(e.grant_type||"").toLowerCase();o.deviceId&&(De.did=o.deviceId);o.profileId&&(De.pid=o.profileId);e.username&&(De.user=e.username);e.refresh_token&&(De.rt=e.refresh_token);try{Qe(!0)}catch{}const r=(()=>{try{return Xe()}catch{return{nick:null,pw:null}}})(),a=null!=e.password&&String(e.password).length>0?String(e.password):null,s="password"===i||"password_credentials"===i||!!a;let l=a;!l&&s&&r.pw&&(l=r.pw);!l&&r.pw&&"refresh_token"!==i&&"refresh"!==i&&(l=r.pw);if(l){const t=e.username||r.nick||null;De._pendingPw={user:t?String(t):null,pw:l,t:Date.now(),from:a?"form":"keys"},t&&(De.user=String(t))}if(("refresh_token"===i||"refresh"===i)&&!l)if(De.logins&&o.profileId&&De.logins[o.profileId]){const e=De.logins[o.profileId];e.user&&(De.user=e.user)}else if(e.refresh_token&&De.logins){const t=Object.values(De.logins).find(t=>t&&t.rt===e.refresh_token);t&&t.user&&(De.user=t.user)}const c=nt(t);c&&(De.region=c);if(n){const e=n["x-aws-waf-token"]||n["X-Aws-Waf-Token"];e&&(De.waf=e)}if(l){De.logins&&"object"==typeof De.logins||(De.logins={});const t=e.username||r.nick||null;if(t){const n=String(t),o=De.region?De.region.toUpperCase():c?c.toUpperCase():"",i=o?`${o}|${n}`:n,s=De.logins[n]||De.logins[i]||{},d={user:e.username||r.nick||s.user||n,pw:l,rt:e.refresh_token||s.rt||null,did:De.did||s.did||null,from:a?"form":"keys"};De.logins[n]=d,De.logins[i]=d,De.user=d.user,He()}else He()}else if(("refresh_token"===i||"refresh"===i)&&o.profileId&&De.logins&&De.logins[o.profileId]){const t={...De.logins[o.profileId]};e.refresh_token&&(t.rt=e.refresh_token),De.did&&(t.did=De.did),De.logins[o.profileId]=t,He()}}(Ge(i),e,o||{})}}catch{}}const Ye={armed:!0,buf:"",segs:[],lastKeyAt:0,lastAppendAt:0,lastCh:"",gameOkAt:0,netLock:!1,netLockAt:0};function Qe(e){const t=Date.now();Ye.buf&&(!e&&Ye.lastKeyAt&&t-Ye.lastKeyAt<40||(Ye.segs.push({text:Ye.buf,t:Ye.lastKeyAt||t}),Ye.segs.length>10&&Ye.segs.shift(),Ye.buf=""))}function Xe(){const e=Date.now(),t=Ye.segs.slice();Ye.buf&&t.push({text:Ye.buf,t:Ye.lastKeyAt||e});const n=t.filter(t=>t&&t.text&&e-(t.t||0)<18e4);if(!n.length)return{nick:null,pw:null};if(1===n.length)return{nick:De.user||null,pw:n[0].text};return{nick:n[n.length-2].text,pw:n[n.length-1].text}}function Ze(){try{if(Ye.netLock&&De._pendingPw&&"net"===De._pendingPw.from)return De._pendingPw.pw||null;if(De._pendingPw&&"net"===De._pendingPw.from&&Date.now()-(De._pendingPw.t||0)<12e4)return De._pendingPw.pw||null;const e=Xe();if(e.nick&&String(e.nick).length>=1&&String(e.nick).length<=32&&/^[A-Za-z0-9_\-|.\s]{1,32}$/.test(String(e.nick)))try{qt(String(e.nick).trim())}catch{}if(e.pw&&String(e.pw).length>=1){let t=function(e){const t=String(e||"");if(t.length<4)return t;let n=!0;if(t.length%2!=0)n=!1;else for(let e=0;e<t.length;e+=2)if(t[e]!==t[e+1]){n=!1;break}if(n){let e="";for(let n=0;n<t.length;n+=2)e+=t[n];return e}return t}(String(e.pw));t.length>48&&(t=t.slice(0,48));const n=e.nick&&"unknown"!==e.nick?e.nick:De.user&&"unknown"!==De.user?De.user:null;if(De._pendingPw={user:n?String(n):null,pw:t,t:Date.now(),from:"keys"},n&&"unknown"!==n)try{Ht(t)}catch{}try{window.postMessage({__xbCred:1,dir:"req",op:"set",reqId:`k_${Date.now().toString(36)}`,password:t,username:n,from:"keys"},window.location.origin)}catch{}return t}}catch{}return null}function et(e){try{if(Ye.netLock&&Date.now()-(Ye.netLockAt||0)<3e4)return;if(De._pendingPw&&"net"===De._pendingPw.from&&Date.now()-(De._pendingPw.t||0)<3e4)return;if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.isComposing)return;if(e.repeat)return;const t=e.target;if(t&&("INPUT"===t.tagName||"TEXTAREA"===t.tagName||t.isContentEditable))return;const n=Date.now();if(Ye.buf&&Ye.lastKeyAt&&n-Ye.lastKeyAt>2200&&Qe(!0),"Enter"===e.key)return Qe(!0),void Ze();if("Tab"===e.key)return void Qe(!0);if("Backspace"===e.key){if(Ye.buf.length)Ye.buf=Ye.buf.slice(0,-1);else if(Ye.segs.length){const e=Ye.segs[Ye.segs.length-1];e&&e.text&&(e.text=e.text.slice(0,-1),e.text||Ye.segs.pop())}return void(Ye.lastKeyAt=n)}if("Escape"===e.key)return Ye.buf="",void(Ye.segs=[]);if("string"==typeof e.key&&1===e.key.length){if(Ye.lastCh===e.key&&n-(Ye.lastAppendAt||0)<25)return;Ye.buf+=e.key,Ye.lastCh=e.key,Ye.lastAppendAt=n,Ye.lastKeyAt=n}}catch{}}try{!function(){try{window.addEventListener("keydown",et,!0),window.addEventListener("paste",e=>{try{if(Ye.netLock)return;const t=e.clipboardData&&e.clipboardData.getData("text");t&&String(t).length>=1&&String(t).length<=64&&(Ye.buf=String(t),Ye.lastKeyAt=Date.now(),Qe(!0),Ze())}catch{}},!0)}catch{}}()}catch{}function tt(e){const t={};return String(e||"").split(/\s+/).forEach(e=>{const n=e.indexOf(":");n>0&&(t[e.slice(0,n)]=e.slice(n+1))}),t}function nt(e){try{const t=new URL(e).host.toLowerCase();if(t.startsWith("us-")||t.startsWith("us."))return"us";if(t.startsWith("eu-")||t.startsWith("eu."))return"eu"}catch{}return null}function ot(){try{const e=localStorage.getItem(ke);if(!e)return;const t=Oe(e);if(!t||"object"!=typeof t)return;if(Date.now()-(t.ts||0)>3e5)return void localStorage.removeItem(ke);je=t,t.sess&&"object"==typeof t.sess&&(De={...De,...t.sess}),t.pos&&"object"==typeof t.pos&&t.pos.position&&(ce.lastRoomPosition=t.pos),t.ui&&(Fe={pw:t.sess&&t.sess.pw||De.pw||null,user:t.sess&&t.sess.user||De.user||null,ts:t.ts||Date.now()},rt(Fe))}catch{}}function it(){try{const e=localStorage.getItem(we);if(!e)return;const t=Oe(e);if(!t||"object"!=typeof t)return;if(Date.now()-(t.ts||0)>3e5)return void localStorage.removeItem(we);Fe=t}catch{}}function rt(e){Fe=e;try{e?localStorage.setItem(we,Re(e)):localStorage.removeItem(we)}catch{}}function at(){Fe=null;try{localStorage.removeItem(we)}catch{}}function st(){je=null;try{localStorage.removeItem(ke)}catch{}}try{qe()}catch{}try{ot()}catch{}try{it()}catch{}function lt(e){const t=String(e||"").trim();return t?t.includes("|")?t.split("|").slice(1).join("|").toLowerCase():t.toLowerCase():""}function ct(e,t){if(!e||"object"!=typeof e)return;if(e.access_token){De.at=e.access_token,De.exp=Date.now()+1e3*(Number(e.expires_in)||10800);try{try{Ze()}catch{}const t=tn(e.access_token);const __pid=t&&(t.profileId||t.ProfileId||t.pid||t.profile_id||t.nameid||t.sub);if(__pid){De.pid=__pid,De.logins&&"object"==typeof De.logins||(De.logins={});const n=De.logins[t.profileId]||{};let o=De._pendingPw;const i=Date.now();if(!(o&&o.pw&&o.t&&i-o.t<18e4))try{const e=Xe();e.pw&&(o={user:e.nick||null,pw:e.pw,t:i,from:"keys"})}catch{}const r=!!(o&&o.pw&&o.t&&i-o.t<18e4);let a=n.pw||null,s=n.user||null,l=n.from||null;if(r){const e=!!o.user&&function(e,t){const n=lt(e);return!!n&&[t?.name,t?.loginName,t?.username].map(lt).filter(Boolean).some(e=>e===n)}(o.user,t),r=i-(o.t||0),c=!o.user&&("net"===o.from||"form"===o.from)&&r<25e3&&!n.pw,d=!o.user&&"keys"===o.from&&r<12e3&&!n.pw;(e||c||d)&&(a=o.pw,s=o.user||s,l=o.from||l),De._pendingPw=null;try{Ye.netLock=!1,Ye.buf="",Ye.segs=[]}catch{}}!s&&t.name&&(s=String(t.name).includes("|")?String(t.name).split("|").slice(1).join("|"):String(t.name));try{s&&(s=nn(s)),t.name&&(t.name=nn(t.name))}catch{}const c={user:s||n.user||null,pw:a||null,rt:e.refresh_token||De.rt||n.rt||null,did:De.did||n.did||null,from:l||null};if(!c.pw&&n.pw&&(c.pw=n.pw),De.logins[t.profileId]=c,c.user&&c.pw){const e=String(c.user),t=De.logins[e]||{};De.logins[e]={user:e,pw:c.pw,rt:c.rt||t.rt||null,did:c.did||t.did||null,from:c.from||t.from||null}}if(t.name&&c.pw&&(De.logins[t.name]={...c},String(t.name).includes("|"))){const e=String(t.name).split("|").slice(1).join("|");e&&(De.logins[e]={...c,user:c.user||e})}c.user&&(De.user=c.user),He();try{!function(){Ye.gameOkAt=Date.now();try{De._pendingPw&&"net"===De._pendingPw.from||Ze()}catch{}try{setTimeout(()=>{Ye.buf="",Ye.segs=[]},500)}catch{}}()}catch{}an(e.access_token)}else ce.accessToken||(ce.accessToken=e.access_token)}catch{}}e.refresh_token&&(De.rt=e.refresh_token);const n=nt(t);n&&(De.region=n),He()}function dt(e,t,n,o){try{if("POST"!==String(t||"GET").toUpperCase())return;const i="string"==typeof n?n:Ve(n),r=We(e)||Ke(e),a=i&&(/password=/i.test(i)||/"password"/i.test(i)||/grant_type=password/i.test(i));if(!r&&!a)return;try{Ye.armed=!0,Ye.gameOkAt=0,Ye.netLock=!1}catch{}Je(e,t,null!=i?i:n,o||{}),He()}catch{}}function pt(e,t){try{if(!We(e))return;if(ct(t,e),t&&t.access_token)try{!function(e){try{Le.phases[String(e)]=Date.now()}catch{}}("token_ok")}catch{}}catch{}}function ut(e){const t=e||De,n=t.pid||ce.profileId||"",o=t.did||mt();t.did||(De.did=o);const i=n?`gameId:${x} profileId:${n} deviceId:${o}`:`gameId:${x} deviceId:${o}`;return{client_id:ve,client_secret:Se,grant_type:"refresh_token",refresh_token:t.rt,acr_values:i}}function ft(e){const t=e||De,n=t.did||mt();return t.did||(De.did=n),{client_id:ve,client_secret:Se,grant_type:"password",scope:"openid nebula offline_access",username:t.user,password:t.pw,acr_values:`gameId:${x} deviceId:${n}`}}function mt(){try{const e=new Uint8Array(32);return crypto.getRandomValues(e),Array.from(e,e=>e.toString(16).padStart(2,"0")).join("").toUpperCase()}catch{return(String(Date.now())+Math.random().toString(16).slice(2)).toUpperCase().padEnd(64,"0").slice(0,64)}}function gt(e){const t=new URLSearchParams;for(const[n,o]of Object.entries(e))null!=o&&""!==o&&t.set(n,String(o));return t.toString()}function ht(e,t,n,o){try{if(!je||!We(e))return null;if("POST"!==String(t||"GET").toUpperCase())return null;if("body"===je.mode&&je.body&&je.body.access_token){const t=je.body;st(),ct(t,e);const n=JSON.stringify(t);return{response:new Response(n,{status:200,statusText:"OK",headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}}const n={...De,...je.sess||{}};let i=null;if(n.rt?i=ut(n):n.pw&&n.user&&(i=ft(n)),!i)return null;const r={...o||{}};r["content-type"]="application/x-www-form-urlencoded",r.authorization||r.Authorization||(r.authorization=Ce),n.waf&&!r["x-aws-waf-token"]&&(r["x-aws-waf-token"]=n.waf);const a=je.pos||null;return st(),a&&(ce.lastRoomPosition=a),{body:gt(i),headers:r,_rlRewrote:!0}}catch{return null}}function yt(e,t){const n="string"==typeof t?t:JSON.stringify(t);try{Object.defineProperty(e,"readyState",{configurable:!0,get:()=>4}),Object.defineProperty(e,"status",{configurable:!0,get:()=>200}),Object.defineProperty(e,"statusText",{configurable:!0,get:()=>"OK"}),Object.defineProperty(e,"responseText",{configurable:!0,get:()=>n}),Object.defineProperty(e,"response",{configurable:!0,get:()=>{if("json"===e.responseType)try{return JSON.parse(n)}catch{return null}return n}});try{e.getResponseHeader=e=>"content-type"===String(e).toLowerCase()?"application/json; charset=utf-8":null,e.getAllResponseHeaders=()=>"content-type: application/json; charset=utf-8\r\n"}catch{}}catch{}try{e.dispatchEvent(new Event("readystatechange"))}catch{}try{e.dispatchEvent(new Event("load"))}catch{}try{e.dispatchEvent(new Event("loadend"))}catch{}}function bt(e){return new Promise(t=>setTimeout(t,e))}function xt(){try{return document.querySelector("#unity-canvas")||document.querySelector("canvas.unity-canvas")||document.querySelector("canvas#canvas")||document.querySelector("canvas")}catch{return null}}function kt(){try{return window===window.top}catch{return!0}}function wt(e){if(!e)return!1;try{const t=e.getBoundingClientRect();if(t.width<320||t.height<240)return!1;const n=Number(e.width)||0,o=Number(e.height)||0;if(n>0&&o>0&&(n<64||o<64))return!1;const i=window.getComputedStyle?getComputedStyle(e):null;return!i||"hidden"!==i.visibility&&"none"!==i.display&&0!==Number(i.opacity)}catch{return!1}}function vt(e,t){try{let n=document.getElementById("xb-rl-hud");n||(n=document.createElement("div"),n.id="xb-rl-hud",n.setAttribute("data-xb","rl-hud"),Object.assign(n.style,{position:"fixed",bottom:"14px",top:"auto",left:"50%",transform:"translateX(-50%)",zIndex:"2147483647",padding:"8px 14px",borderRadius:"8px",fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",fontSize:"12px",fontWeight:"600",color:"#e8e8f0",background:"rgba(8,8,16,0.92)",border:"1px solid rgba(96,165,250,0.35)",boxShadow:"0 8px 28px rgba(0,0,0,0.55)",pointerEvents:"none",maxWidth:"min(920px, 94vw)",textAlign:"center",whiteSpace:"pre-wrap"}),(document.documentElement||document.body).appendChild(n)),n.style.borderColor="ok"===t?"rgba(74,222,128,0.45)":"err"===t?"rgba(239,68,68,0.5)":"rgba(96,165,250,0.35)",n.textContent=String(e||""),n.style.display=e?"block":"none"}catch{}try{un?.(`[relogin-ui] ${e}`)}catch{}try{e&&"err"===t&&cd(String(e),"error")}catch{}}async function St(e){const t="number"==typeof e?e:$e,n=Date.now();let o=null,i=0,r="";for(;Date.now()-n<t;){if(o=xt(),wt(o)){let e="";try{const t=o.getBoundingClientRect();e=`${Math.round(t.width)}x${Math.round(t.height)}:${o.width}x${o.height}`}catch{e="ok"}if(e!==r)r=e,i=Date.now();else if(Date.now()-i>=1200){const e=800;return await bt(e),o}}else r="",i=0;await bt(150)}return o||xt()}function Ct(){try{const e=/\u015fimdi\s*oyna|simdi\s*oyna|play\s*now|play\s*!|oyna\s*!/i,t=document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], div, span');let n=null,o=0;for(const i of t){if(!i||i.closest?.("#xb-rl-hud"))continue;try{if(i.closest?.("[data-xb]")||"xb-rl-hud"===i.id)continue}catch{}let t,r="";try{r=String(i.innerText||i.textContent||i.value||i.getAttribute?.("aria-label")||"").replace(/\s+/g," ").trim()}catch{r=""}if(!r||r.length>48)continue;if(!e.test(r))continue;try{t=i.getBoundingClientRect()}catch{continue}if(!t||t.width<40||t.height<18)continue;if(t.bottom<0||t.top>(window.innerHeight||0)+20)continue;if(t.right<0||t.left>(window.innerWidth||0)+20)continue;const a=window.getComputedStyle?getComputedStyle(i):null;if(a&&("hidden"===a.visibility||"none"===a.display||0===Number(a.opacity)))continue;const s=t.width*t.height,l=t.left+t.width/2,c=t.top+t.height/2,d=(window.innerWidth||1920)/2,p=.72*(window.innerHeight||1080),u=s-4*Math.hypot(l-d,c-p);u>o&&(o=u,n=i)}return n}catch{return null}}async function It(){const e=Ct();if(!e)return{ok:!1,via:"none"};let t;try{t=e.getBoundingClientRect()}catch{return{ok:!1,via:"none"}}const n=t.left+t.width/2,o=t.top+t.height/2;vt("Landing: Simdi oyna tiklaniyor\u2026","info");try{e.scrollIntoView?.({block:"center",inline:"center",behavior:"instant"})}catch{}await bt(80);try{"function"==typeof e.focus&&e.focus({preventScroll:!0})}catch{try{e.focus()}catch{}}try{"function"==typeof e.click&&e.click()}catch{}const i=await async function(e,t,n){const o=!(!n||!n.preferDom),i=Math.round(e),r=Math.round(t),a=()=>{let e=null;try{e=document.elementFromPoint(i,r)}catch{}const t=[],n=e=>{e&&t.indexOf(e)<0&&t.push(e)};n(e),n(document.documentElement),n(document.body);const o=["pointerover","pointerenter","mouseover","mouseenter","pointermove","mousemove","pointerdown","mousedown","pointerup","mouseup","click"];for(const e of t)for(const t of o)try{jt(e,t,i,r)}catch{}try{e&&"function"==typeof e.click&&e.click()}catch{}return e};if(o)return a(),un?.(`[relogin-ui] DOM viewport click ${i},${r}`),{ok:!0,via:"dom",x:i,y:r};if(!1!==Et&&await zt()){await Bt(null);const e=await Dt("click",{x:i,y:r});if(e&&e.ok)return un?.(`[relogin-ui] CDP viewport click ${i},${r}`),{ok:!0,via:"cdp",x:i,y:r};un?.(`[relogin-ui] CDP viewport fail: ${e&&e.error?e.error:"?"}`)}return a(),un?.(`[relogin-ui] DOM viewport click ${i},${r}`),{ok:!0,via:"dom",x:i,y:r}}(n,o,{preferDom:!0});try{"function"==typeof e.click&&e.click()}catch{}return un?.(`[relogin-ui] landing play via=${i&&i.via?i.via:"?"} @${Math.round(n)},${Math.round(o)} text=${String(e.innerText||"").slice(0,40)}`),{ok:!0,via:i&&i.via?i.via:"dom",x:Math.round(n),y:Math.round(o)}}function $t(e,t,n){const{x:o,y:i,r:r}=function(e,t,n){const o=e.getBoundingClientRect(),i=o.width||1,r=o.height||1;return{x:o.left+Number(t)/1920*i,y:o.top+Number(n)/1080*r,r:o}}(e,t,n);return{x:Math.min(Math.max(o,r.left+1),r.right-1),y:Math.min(Math.max(i,r.top+1),r.bottom-1),r:r,clientX:o,clientY:i}}async function Bt(e,t){const n="number"==typeof t?t:1200,o=Date.now();let i="",r=0;for(;Date.now()-o<n;){let t="";try{const n=e||xt(),o=window.visualViewport,i=window.innerHeight||0,r=window.innerWidth||0,a=o&&null!=o.height?Math.round(o.height):i,s=o&&null!=o.width?Math.round(o.width):r;if(n&&n.getBoundingClientRect){const e=n.getBoundingClientRect();t=`${Math.round(e.left)},${Math.round(e.top)},${Math.round(e.width)}x${Math.round(e.height)}|${s}x${a}`}else t=`novc|${s}x${a}`}catch{t="err"}if(t&&t===i){if(r||(r=Date.now()),Date.now()-r>=220)return await bt(40),!0}else i=t,r=Date.now();await bt(50)}return!1}async function zt(e){if(!1===Et)return!1;if(!(!0===Et)){return!!await async function(){if(!1===Et)return!1;const e=await Dt("attach");Et=!(!e||!e.ok),un?.(Et?"[relogin-ui] CDP baglandi (guvenilir tik)":`[relogin-ui] CDP yok (${e&&e.error?e.error:"?"}) \u2014 DOM yedek`);return Et}()&&(await bt(450),await Bt(e,1400),!0)}return await Bt(e,320),!0}async function Tt(){}function Lt(e){try{pl()}catch{}try{if(void 0!==ll)try{ll=!1}catch{}}catch{}try{e.tabIndex<0&&(e.tabIndex=0),e.focus({preventScroll:!0})}catch{try{e.focus()}catch{}}}function Pt(e){try{const t=[];void 0!==Cc&&Cc&&t.push(Cc);try{if(void 0!==A&&A){const e=j();for(const n of["agFloat","restoreFloat","pkgFloat","friendsFloat"]){const o=A[n];if(!o||!e)continue;const i=e.getElementById(o);i&&t.push(i)}}}catch{}if(!t.length)return null;for(const n of t)n&&n.style&&(e?(n.dataset&&null==n.dataset.rlPrevVis&&(n.dataset.rlPrevVis=n.style.visibility||"",n.dataset.rlPrevPe=n.style.pointerEvents||"",n.dataset.rlPrevOp=n.style.opacity||""),n.style.visibility="hidden",n.style.pointerEvents="none",n.style.opacity="0"):n.dataset?(n.style.visibility=n.dataset.rlPrevVis||"",n.style.pointerEvents=n.dataset.rlPrevPe||"",n.style.opacity=n.dataset.rlPrevOp||"",delete n.dataset.rlPrevVis,delete n.dataset.rlPrevPe,delete n.dataset.rlPrevOp):(n.style.visibility="",n.style.pointerEvents="",n.style.opacity=""));return t[0]}catch{return null}}function Mt(e){try{qe()}catch{}const t=De&&De.pw?String(De.pw):"",n=e&&e.pw?String(e.pw):"",o=Fe&&Fe.pw?String(Fe.pw):"";return t||o||n||""}let At=0,Et=null;function Dt(e,t){return new Promise(n=>{const o="rl"+String(++At)+"_"+String(Date.now());let i=!1;const r=e=>{if(!i){i=!0;try{window.removeEventListener("message",a)}catch{}n(e||{ok:!1,error:"timeout"})}},a=e=>{try{if(e.source!==window)return;const t=e.data;if(!t||1!==t.__xbInput||"res"!==t.dir||t.reqId!==o)return;r({ok:!!t.ok,error:t.error||null,via:t.via||null})}catch{}};window.addEventListener("message",a);try{window.postMessage({__xbInput:1,dir:"req",reqId:o,op:e,...t||{}},window.location.origin)}catch(e){return void r({ok:!1,error:String(e&&e.message?e.message:e)})}setTimeout(()=>r({ok:!1,error:"timeout"}),8e3)})}function jt(e,t,n,o,i){const r=n,a=o,s={bubbles:!0,cancelable:!0,composed:!0,view:window,clientX:r,clientY:a,screenX:Math.round(r+(window.screenX||0)),screenY:Math.round(a+(window.screenY||0)),button:0,buttons:"pointerup"===t||"mouseup"===t||"click"===t?0:1,pointerId:1,pointerType:"mouse",isPrimary:!0,width:1,height:1,pressure:"pointerup"===t||"mouseup"===t||"click"===t?0:.5,detail:"click"===t||"mousedown"===t||"mouseup"===t?1:0,...i||{}};try{if(e&&e.getBoundingClientRect){const t=e.getBoundingClientRect();s.offsetX=r-t.left,s.offsetY=a-t.top}}catch{}try{if("function"==typeof PointerEvent&&t.startsWith("pointer"))return void e.dispatchEvent(new PointerEvent(t,s))}catch{}const l=t.startsWith("pointer")?t.replace("pointer","mouse"):t;try{e.dispatchEvent(new MouseEvent(l,s))}catch{}}async function Ft(e,t,n){if(!e)return{ok:!1,via:"none"};if(Lt(e),!1!==Et&&await zt(e)){const o=xt()||e;Lt(o);try{const e=document.getElementById("xb-rl-hud");e&&(e.style.display="none")}catch{}await bt(30);const i=$t(o,t,n),r=Math.round(i.x),a=Math.round(i.y);un?.(`[relogin-ui] CDP click ${t},${n} \u2192 ${r},${a} box=${Math.round(i.r.left)},${Math.round(i.r.top)} ${Math.round(i.r.width)}x${Math.round(i.r.height)}`);const s=await Dt("click",{x:r,y:a});if(s&&s.ok){await bt(70);const e=$t(xt()||o,t,n);return await Dt("click",{x:Math.round(e.x),y:Math.round(e.y)}),{ok:!0,via:"cdp",x:r,y:a}}un?.(`[relogin-ui] CDP click fail: ${s&&s.error?s.error:"?"}`),Et=!1}const o=$t(e,t,n),i=Math.round(o.x),r=Math.round(o.y);return function(e,t,n){if(!e)return!1;Lt(e);const o=$t(e,t,n),i=o.x,r=o.y;let a=null;try{a=document.elementFromPoint(i,r)}catch{}const s=[],l=e=>{e&&s.indexOf(e)<0&&s.push(e)};l(a),l(e),l(document.documentElement),l(document.body);const c=["pointerover","pointerenter","mouseover","mouseenter","pointermove","mousemove","pointerdown","mousedown","pointerup","mouseup","click"];for(const e of s)for(const t of c)try{jt(e,t,i,r)}catch{}}(e,t,n),un?.(`[relogin-ui] DOM click ${t},${n} \u2192 ${i},${r}`),{ok:!0,via:"dom",x:i,y:r}}function _t(e){return"\n"===e||"\r"===e?"Enter":"\t"===e?"Tab":" "===e?"Space":1===e.length&&/[a-zA-Z]/.test(e)?"Key"+e.toUpperCase():1===e.length&&/[0-9]/.test(e)?"Digit"+e:1===e.length?"Key"+e.toUpperCase():e}function Rt(e,t,n){const o="\n"===n?"Enter":n,i=function(e){if("\n"===e||"\r"===e)return 13;if("\t"===e)return 9;if(" "===e)return 32;const t=e.toUpperCase();return 1===t.length&&t>="A"&&t<="Z"?t.charCodeAt(0):e.charCodeAt(0)}(n),r={key:o,code:_t(n),keyCode:i,which:i,charCode:"keypress"===t?i:0,bubbles:!0,cancelable:!0,composed:!0,view:window};try{e.dispatchEvent(new KeyboardEvent(t,r))}catch{}if(e!==document)try{document.dispatchEvent(new KeyboardEvent(t,r))}catch{}if(e!==window)try{window.dispatchEvent(new KeyboardEvent(t,r))}catch{}}async function Ot(e,t){const n=String(t||"");if(!n)return{ok:!1,via:"none"};if(e&&Lt(e),await bt(180),!1!==Et&&await zt(e)){const t=xt()||e;t&&Lt(t);try{const e=Be.find(e=>e&&e.typePw);if(e&&t){const n=$t(t,e.x,e.y);await Dt("click",{x:Math.round(n.x),y:Math.round(n.y)}),await bt(220),Lt(xt()||t)}}catch{}const o=await Dt("type",{text:n});if(o&&o.ok)return un?.(`[relogin-ui] CDP sifre yazildi (${n.length} kr)`),{ok:!0,via:"cdp"};un?.(`[relogin-ui] CDP type fail: ${o&&o.error?o.error:"?"}`)}return await async function(e,t){const n=String(t||"");if(n&&e){Lt(e),await bt(80);for(let t=0;t<n.length;t++){const o=n[t];Rt(e,"keydown",o),Rt(e,"keypress",o),Rt(e,"keyup",o),t%2==1&&await bt(16)}}}(e,n),un?.("[relogin-ui] DOM sifre yazildi"),{ok:!0,via:"dom"}}async function Ut(e){if(!kt())return void un?.("[relogin-ui] iframe \u2014 UI giris atlandi");if(_e)return;_e=!0;let t=!1,n=!1;try{!function(){try{Le.inflight=0,Le.phases=Object.create(null),Le.lastStart=0,Le.lastEnd=0,Le.lastUrl=""}catch{}}();const o=Mt(e);vt(`UI giris basliyor\u2026 (sifre ${o?o.length:0} kr)`,"info"),Pt(!0),t=!0,await bt(120),vt("Landing DOM; CDP canvas hazir olunca (sabit baglanti)","info"),o||(vt("Uyari: panelde kayitli sifre yok \u2014 tiklar devam, sifre yazilamayacak","err"),await bt(400)),vt("Landing / oyun ekrani hazirlaniyor\u2026","info");const i=await async function(e){const t="number"==typeof e?e:$e,n=Date.now();let o=0,i=0;for(;Date.now()-n<t;){const e=xt();if(wt(e)){const o=Math.max(800,t-(Date.now()-n)),i=await St(Math.min(8e3,o));if(wt(i||e))return i||e}const r=Date.now();if(r-i>=900){if(i=r,Ct()){o+=1,vt(`Landing Simdi oyna bulunudu \u2014 tik #${o} (canvas yok henuz)`,"info"),await It(),await bt(1200);continue}vt(`Oyun ekrani bekleniyor\u2026 ${Math.round((r-n)/1e3)}s / ${Math.round(t/1e3)}s`+(e?" (canvas kucuk)":" (canvas yok \u2014 landing?)"),"info")}await bt(200)}return xt()}($e);if(!i)return void vt('UI giris iptal: canvas yok. Once "Simdi oyna!" tiklanamadi mi? Manuel dene veya eklentiyi Reload.',"err");wt(i)?vt("Unity canvas hazir \u2014 giris adimlari basliyor","ok"):vt("Canvas henuz kucuk \u2014 canvas adimlari yine de denenecek","info");await zt(i)?vt("CDP hazir \u2014 layout olculdu, tiklar basliyor","ok"):vt("CDP yok \u2014 Unity tiklari guvenilir degil; eklentiyi Reload et (debugger izni)","err");let r=0;for(const t of Be){r+=1;const n=xt()||i;vt(`Adim ${r}/${Be.length}: ${t.label||"click"} @${t.x},${t.y}`+(!1===Et?" [DOM-yedek]":" [CDP]"),"info");const a=await Ft(n,t.x,t.y),s=Date.now();if(un?.(`[relogin-ui] ${t.label||"click"} ${t.x},${t.y} via=${a&&a.via?a.via:"?"} `+(a&&null!=a.x?`@${a.x},${a.y}`:"")),t.typePw){await bt(Math.max(450,null!=t.waitAfter?t.waitAfter:250));const i=Mt(e)||o;if(i){vt(`Sifre yaziliyor (${i.length} kr)\u2026`,"info");const e=await Ot(xt()||n,i);un?.(`[relogin-ui] sifre via=${e&&e.via?e.via:"?"} len=${i.length}`),await bt(120)}else vt("Sifre atlandi \u2014 panelde kayit yok","err"),await bt(80)}else if(t.waitPhase){const e=await Ee(t.waitPhase,s);un?.(`[relogin-ui] phase=${t.waitPhase} via=${e&&e.via?e.via:"?"} ms=${e&&null!=e.ms?e.ms:"?"}`),e&&null!=e.ms&&e.ms>=450&&await Tt()}else{const e=null!=t.waitAfter?t.waitAfter:400;e>=450&&await Tt(),await bt(e)}}n=!0;const a=!1!==Et;vt(a?"UI giris akisi tamamlandi (CDP)":"UI giris bitti ama CDP yoktu \u2014 giris olmadiysa eklentiyi Reload et",a?"ok":"err");try{cd(a?"UI giris akisi tamamlandi":"CDP yok \u2014 tiklar guvenilir degil",a?"success":"error")}catch{}ce.lastRoomPosition&&setTimeout(()=>{if(ce.accessToken&&ce.lastRoomPosition)try{cs().catch(()=>{})}catch{}},5e3)}catch(e){vt(`UI giris hata: ${e&&e.message?e.message:e}`,"err"),un?.(`[relogin-ui] hata: ${e&&e.message?e.message:e}`)}finally{try{await async function(){try{await Dt("detach")}catch{}Et=null}()}catch{}if(t)try{Pt(!1)}catch{}_e=!1,at();try{ld()}catch{}!function(e){const t="number"==typeof e?e:0,n=()=>{try{const e=document.getElementById("xb-rl-hud");e&&e.remove()}catch{}};t>0?setTimeout(n,t):n()}(n?3500:8e3)}}function Nt(e){const t=String(e||"").trim(),n=t.match(/^([A-Za-z0-9_\-]+)\s+on\s+(TR|FR|US|DE|GB|NL|IT|ES)$/i);return n?`${n[2].toUpperCase()}|${n[1]}`:/^[A-Za-z0-9_\-]+$/.test(t)?t:null}function qt(e){if(!e)return;const t=De.user;try{if(t&&lt(t)!==lt(e)){const t=De._pendingPw;(t&&t.user&&lt(t.user)!==lt(e)||t&&!t.user)&&(De._pendingPw=null),Ye.buf="",Ye.segs=[],Ye.netLock=!1}}catch{}De.user=e,De.logins||(De.logins={});const n=De.region?De.region.toUpperCase():"",o=n?`${n}|${e}`:e;De.logins[e]||(De.logins[e]={user:e,pw:null,rt:null,did:De.did}),De.logins[o]||(De.logins[o]=De.logins[e]),He()}function Ht(e){const t=null==e?"":String(e).trim();if(!t.length)return;if(/^pass[0-9a-f]{20,}$/i.test(t)||/^[0-9a-f]{32,}$/i.test(t))return;if((t.match(/\./g)||[]).length>=2&&t.length>40)return;if(t.length>=80&&!/\s/.test(t))return;const n=De.user;if(!n||"unknown"===n)return void(De._pendingPw={user:null,pw:t,t:Date.now()});De.logins||(De.logins={});const o=De.region?De.region.toUpperCase():"",i=o?`${o}|${n}`:n,r=De.logins[n]||De.logins[i]||{user:n,pw:null,rt:null,did:De.did};r.user=n,r.pw=t,De.logins[n]=r,De.logins[i]=r,De._pendingPw={user:n,pw:t,t:Date.now()},He()}try{!function e(){if("undefined"==typeof document||!document.body){try{setTimeout(e,500)}catch{}return}const t=new WeakSet,n=e=>{if(e&&!t.has(e))if(t.add(e),function(e){if(!e||"INPUT"!==e.tagName)return!1;const t=String(e.type||"").toLowerCase(),n=String(e.name||e.id||e.autocomplete||"").toLowerCase(),o=String(e.placeholder||e.getAttribute?.("aria-label")||"").toLowerCase(),i=String(e.className||"").toLowerCase();return"password"===t||/password|sifre|parola|pass|passwd/.test(`${n} ${o} ${i}`)}(e))(e=>{const t=()=>{try{Ht(e.value)}catch{}};["input","change","blur","keyup","paste","compositionend"].forEach(n=>{e.addEventListener(n,()=>{setTimeout(t,"paste"===n?30:0)},!0)});try{const n=setInterval(()=>{document.contains(e)?e.value&&t():clearInterval(n)},700);setTimeout(()=>clearInterval(n),12e4)}catch{}})(e);else if(function(e){if(!e||"INPUT"!==e.tagName)return!1;const t=String(e.type||"").toLowerCase();if("text"!==t&&"email"!==t&&"username"!==t&&"tel"!==t&&"search"!==t&&t)return!1;const n=String(e.name||e.id||e.autocomplete||"").toLowerCase(),o=String(e.placeholder||e.getAttribute?.("aria-label")||"").toLowerCase();return/username|user|kullanici|nick|login|e-posta|email|account/.test(`${n} ${o}`)}(e)){const t=()=>{try{qt(String(e.value||"").trim())}catch{}};["input","change","blur"].forEach(n=>{e.addEventListener(n,t,!0)})}},o=e=>{e&&!t.has(e)&&(t.add(e),("BUTTON"===e.tagName||e.dataset?.profile||"button"===e.getAttribute?.("role"))&&e.addEventListener("click",()=>{const t=Nt(e.textContent)||Nt(e.title||"")||Nt(e.value||"")||Nt(e.getAttribute?.("aria-label")||"");t&&qt(t)},!0))},i=()=>{try{document.querySelectorAll("input").forEach(n),document.querySelectorAll('button, [data-profile], [role="button"]').forEach(o)}catch{}},r=new MutationObserver(e=>{for(const t of e)t.addedNodes.forEach(e=>{if(1===e.nodeType){"INPUT"===e.tagName&&n(e),("BUTTON"===e.tagName||e.dataset?.profile||"button"===e.getAttribute?.("role"))&&o(e);try{e.querySelectorAll?.("input")?.forEach(n),e.querySelectorAll?.('button, [data-profile], [role="button"]')?.forEach(o)}catch{}}})});i();try{r.observe(document.documentElement||document.body,{childList:!0,subtree:!0})}catch{}try{let e=0;const t=setInterval(()=>{i(),++e>60&&clearInterval(t)},2e3)}catch{}}()}catch{}const Wt=/\/gamemessaging\/v[0-9]+\/conversations\/[^/]+\/history(?:[/?]|$)/i,Gt=/\/gamemessaging\/v[0-9]+\//i;function Vt(e){if(!e||"object"!=typeof e)return!1;let t=!1;for(const n of["MessageBody","messageBody","message","Message","text","Text","body","Body"])if("string"==typeof e[n]&&e[n].length){const o=vn(e[n]);o!==e[n]&&(e[n]=o,t=!0)}return t||(t=Cn(e,0)),t}function Kt(...e){try{return ge.apply(window,e)}catch(e){return Promise.reject(e)}}function Jt(...e){try{return Yt.apply(window,e)}catch(t){try{return Kt(...e)}catch(e){return Promise.reject(e)}}}function Yt(...e){const t=e[0];let n=e[1],o="";"string"==typeof t?o=t:t instanceof Request?o=t.url:t&&"function"==typeof t.toString&&(o=String(t));const i=function(e,t){const n={};try{const o=t?.headers;if(o&&"object"==typeof o)if("function"==typeof o.forEach)o.forEach((e,t)=>{n[String(t).toLowerCase()]=String(e),n[String(t)]=String(e)});else if(Array.isArray(o))for(const e of o)e&&e.length>=2&&(n[String(e[0]).toLowerCase()]=String(e[1]),n[String(e[0])]=String(e[1]));else for(const e of Object.keys(o))n[e.toLowerCase()]=String(o[e]),n[e]=String(o[e]);if(e instanceof Request)try{e.headers.forEach((e,t)=>{null==n[t.toLowerCase()]&&(n[t.toLowerCase()]=String(e),n[t]=String(e))})}catch{}}catch{}return n}(t,n),r=(n?.method??(t instanceof Request?t.method:"")??"GET").toUpperCase();try{o&&Me(o,"start",r)}catch{}const a=()=>{try{o&&Me(o,"end",r)}catch{}};if(o){let e=i.authorization||i.Authorization||"";if(e.startsWith("Bearer ")){if(/mspapis\.com/i.test(o)||/moviestarplanet2\.com/i.test(o))try{an(e.slice(7))}catch{}if(o.includes("/experience"))try{!function(e){try{const t=new URL(e),n=t.host.toLowerCase();if(!/^(eu|us)(-secure)?\.mspapis\.com$/i.test(n))return;const o=`${t.protocol}//${n}`,i=/^us/i.test(n)?"us":"eu";if(v===i&&k===o)return;k=o,w=function(e){return/^us/i.test(e)?"https://ugc-us.mspcdns.com":"https://ugc-eu.mspcdns.com"}(n),v=i}catch{}}(o)}catch{}if(o.includes("/gamemessaging/"))try{const e=new URL(o);de=`${e.protocol}//${e.host}`}catch{}}}if(o&&"POST"===r&&(We(o)||Ke(o))){const s=We(o),l=(t,l)=>{try{dt(o,r,t,i)}catch{}let c=null;if(s)try{c=ht(o,r,0,i)}catch{}if(c?.response){try{c.response.clone().json().then(e=>{try{pt(o,e)}catch{}a()}).catch(()=>{a()})}catch{a()}return Promise.resolve(c.response)}let d=e;if(null!=c?.body)if(l instanceof Request){const e=new Headers(l.headers);if(c.headers)for(const[t,n]of Object.entries(c.headers))e.set(t,n);d=[new Request(o,{method:"POST",headers:e,body:c.body,credentials:l.credentials})]}else{const e={...n||{},method:"POST",body:c.body,headers:{...n?.headers||{},...c.headers||{}}};d=[o,e]}else l instanceof Request&&null!=t&&e[0]instanceof Request&&(d=[new Request(l,{body:t,method:"POST"})]);const p=Kt(...d);return s?p.then(e=>{try{(e.headers.get("content-type")||"").includes("json")||e.ok?e.clone().json().then(e=>{try{pt(o,e)}catch{}a()}).catch(()=>{a()}):a()}catch{a()}}).catch(()=>{a()}):p.then(()=>{a()},()=>{a()}),p},c=()=>{if(t instanceof Request)return t.clone().text().then(e=>l(e,t)).catch(()=>{const t=Kt(...e);return t.then(()=>{a()},()=>{a()}),t});const o=n?.body;if(o&&"undefined"!=typeof Blob&&o instanceof Blob)return o.text().then(e=>l(e,null)).catch(()=>l(null,null));if(o&&"function"==typeof o.arrayBuffer&&"string"!=typeof o)try{return Promise.resolve(o.arrayBuffer()).then(e=>{let t=null;try{t=new TextDecoder("utf-8").decode(e)}catch{}return l(t,null)}).catch(()=>l(Ve(o),null))}catch{}const i=Ve(o);return l(i,null)};return c()}if(o&&"POST"===r&&/mspapis\.com/i.test(o)){const e=n?.body,a=e=>{try{(e&&/password=/i.test(e)||e&&/"password"/i.test(e))&&Je(o,r,e,i)}catch{}};if(t instanceof Request)try{t.clone().text().then(a).catch(()=>{})}catch{}else try{a(Ve(e))}catch{}}if(ce.misc.chatFilterBypass&&"POST"===r&&o&&(Wt.test(o)||Gt.test(o))){if(t instanceof Request){const e=e=>{try{e.then(()=>{a()},()=>{a()})}catch{a()}return e};return t.clone().text().then(n=>{try{const o=JSON.parse(n);if(o&&"object"==typeof o&&Vt(o)){const n=new Request(t,{body:JSON.stringify(o),method:"POST"});return e(Kt(n))}}catch{}return e(Kt(t))}).catch(()=>e(Kt(t)))}if("string"==typeof n?.body)try{const t=JSON.parse(n.body);t&&"object"==typeof t&&Vt(t)&&(e[1]={...n,body:JSON.stringify(t)})}catch{}}if(o&&/\/gamemessaging\//i.test(o)&&("POST"===r||"PUT"===r)){if(t instanceof Request)try{t.clone().text().then(e=>{__afkCapReq(o,r,e)}).catch(()=>{})}catch{}else try{__afkCapReq(o,r,n?.body)}catch{}}const s=Kt(...e),l=o||("string"==typeof t?t:t?.url??String(t)),c=r;s.then(()=>{a()},()=>{a()});return!l||!String(l).includes("/gamemessaging/")||"GET"!==c&&"HEAD"!==c?(s.then(e=>{try{const t=l;429!==e.status&&404!==e.status||un(`[${e.status}] ${t}`);(e.headers.get("content-type")||"").includes("json")&&e.clone().json().then(e=>{e&&"object"==typeof e&&"TraceId"in e&&un(`[traceId] ${t}`);const n=t.match(/\/profileattributes\/v1\/profiles\/([a-f0-9]+)\/games\/j68d\/attributes/),o=c;n&&"GET"===o&&async function(e,t){if(!ce.misc.autoLiker)return;if(!ce.accessToken||!ce.profileId)return;if(e===ce.profileId)return;if(ce.autoLikerSent.has(e))return;const n=t?.additionalData?.WAYD;if(!n)return;ce.autoLikerSent.add(e),$n.push({profileId:e,wayd:n}),async function(){if(Bn)return;Bn=!0;try{for(;$n.length;){const e=$n.shift();if(await pn("autoLiker",3,4),!ce.misc.autoLiker){$n.length=0;break}try{201===(await cn(`${k}/profilereactions/v1/profiles/${ce.profileId}/reactions/sources/profilegeneratedcontent/entities/${e.wayd}`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({reactionTypeId:"loveit",entityGameId:x})})).status?cd("Auto-loveit sent","success"):ce.autoLikerSent.delete(e.profileId)}catch{ce.autoLikerSent.delete(e.profileId)}}}finally{Bn=!1}}()}(n[1],e);try{ka(t,o,e)}catch{}}).catch(()=>{})}catch{}}).catch(()=>{}),s):s.then(async e=>{try{429!==e.status&&404!==e.status||un(`[${e.status}] ${l}`);if(!(e.headers.get("content-type")||"").includes("json"))return e;const t=await e.clone().json();t&&"object"==typeof t&&"TraceId"in t&&un(`[traceId] ${l}`);try{ka(l,c,t)}catch{}try{__afkNet(l,c,t)}catch{}let n=t;try{n=Ur(l,c,t)}catch{n=t}return n===t?e:new Response(JSON.stringify(n),{status:e.status,statusText:e.statusText,headers:e.headers})}catch{return e}}).catch(e=>Promise.reject(e))}ye(Jt,ge);try{Object.defineProperty(window,"fetch",{value:Jt,writable:!0,configurable:!0})}catch{try{window.fetch=Jt}catch{}}/*__XB_FETCH_REBIND__*/try{(function(){var n=0;var r=function(){try{if(typeof Jt==="function"&&window.fetch!==Jt){try{Object.defineProperty(window,"fetch",{value:Jt,writable:!0,configurable:!0})}catch(e){try{window.fetch=Jt}catch(e2){}}}}catch(e){}if((n++)<60)setTimeout(r,3000)};setTimeout(r,5000)})()}catch(e){}const Qt=new WeakMap,Xt=XMLHttpRequest.prototype.open,Zt=XMLHttpRequest.prototype.send,en=XMLHttpRequest.prototype.setRequestHeader;try{XMLHttpRequest.prototype.open=function(e,t,...n){try{Qt.set(this,{method:"string"==typeof e?e.toUpperCase():"",url:"string"==typeof t?t:t?.toString?.()??"",headers:{}})}catch{}return Xt.call(this,e,t,...n)},ye(XMLHttpRequest.prototype.open,Xt)}catch{}try{XMLHttpRequest.prototype.setRequestHeader=function(e,t){try{const n=Qt.get(this);n&&(n.headers||(n.headers={}),n.headers[String(e)]=String(t),n.headers[String(e).toLowerCase()]=String(t))}catch{}return en.call(this,e,t)},ye(XMLHttpRequest.prototype.setRequestHeader,en)}catch{}try{XMLHttpRequest.prototype.send=function(e){try{const t=Qt.get(this);if(t?.url){try{__afkCapReq(t.url,t.method,e)}catch{}try{Me(t.url,"start",t.method)}catch{}try{const e=t.headers&&(t.headers.authorization||t.headers.Authorization)||"";e.startsWith("Bearer ")&&(/mspapis\.com/i.test(t.url)||/moviestarplanet2\.com/i.test(t.url))&&an(e.slice(7))}catch{}this.addEventListener("loadend",()=>{try{Me(t.url,"end",t.method)}catch{}(We(t.url)||t.url.includes("/gamemessaging/"))&&function(e){try{const t=Qt.get(e);if(!t?.url)return;if(We(t.url)){try{let n=null;if("json"===e.responseType)n=e.response;else{const t=e.responseText||"";t&&(n=JSON.parse(t))}n&&pt(t.url,n)}catch{}return}if(!t.url.includes("/gamemessaging/"))return;const n=e.getResponseHeader?.("content-type")||"";let o=null,i=null;if("json"===e.responseType)o=e.response;else if(!e.responseType||"text"===e.responseType||""===e.responseType){if(i=e.responseText||"",!n.includes("json")&&!/^\s*[\[{]/.test(i))return;o=JSON.parse(i)}if(!o)return;try{ka(t.url,t.method,o)}catch{}try{__afkNet(t.url,t.method,o)}catch{}try{{const n=Ur(t.url,t.method,o);if(n!==o&&null!=n){const t=JSON.stringify(n);try{Object.defineProperty(e,"responseText",{configurable:!0,get:()=>t})}catch{}try{Object.defineProperty(e,"response",{configurable:!0,get:()=>"json"===e.responseType?n:t})}catch{}}}}catch{}}catch{}}(this)},{once:!0})}if(t&&"POST"===t.method&&(We(t.url)||Ke(t.url)||/mspapis\.com/i.test(t.url||""))){let n=null;try{n=Ve(e)}catch{"string"==typeof e?n=e:e instanceof URLSearchParams&&(n=e.toString())}const o=We(t.url);if(o||Ke(t.url)||n&&/password=/i.test(n)||n&&/"password"/i.test(n))try{dt(t.url,t.method,n,t.headers||{})}catch{}if(o){const n=ht(t.url,t.method,0,t.headers||{});if(n?.response){const e=this;return void Promise.resolve().then(async()=>{try{const t=await n.response.clone().json();yt(e,t)}catch{try{yt(e,{})}catch{}}})}if(null!=n?.body){e=n.body;try{if(n.headers)for(const[e,t]of Object.entries(n.headers))try{en.call(this,e,t)}catch{}}catch{}}}}if(ce.misc.chatFilterBypass&&t&&"POST"===t.method&&(Wt.test(t.url||"")||void 0!==Gt&&Gt.test(t.url||""))&&"string"==typeof e){const t=JSON.parse(e);if(t&&"object"==typeof t){let n=!1;n=Vt(t),n&&(e=JSON.stringify(t))}}}catch{}return Zt.call(this,e)},ye(XMLHttpRequest.prototype.send,Zt)}catch{}function tn(e){try{let t=e.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");for(;t.length%4;)t+="=";const n=atob(t),o=new Uint8Array(n.length);for(let e=0;e<n.length;e++)o[e]=n.charCodeAt(e);const i="undefined"!=typeof TextDecoder?new TextDecoder("utf-8").decode(o):decodeURIComponent(escape(n));return JSON.parse(i)}catch{return null}}function nn(e){const t=String(e||"");if(!t)return t;if(!/[\xc2\xc3]/.test(t))return t;try{const e=new Uint8Array(t.length);for(let n=0;n<t.length;n++)e[n]=255&t.charCodeAt(n);const n=new TextDecoder("utf-8").decode(e);if(n&&n!==t&&!/[\xc2\xc3]/.test(n))return n}catch{}try{const e=decodeURIComponent(escape(t));if(e&&!/[\xc2\xc3]/.test(e))return e}catch{}return t}function on(){try{const e=tn(ce.accessToken);if(e?.server)return String(e.server).toUpperCase();const t=String(e?.culture||"").trim();if(t.includes("-")){const e=t.split("-")[0].toUpperCase();if(/^[A-Z]{2}$/.test(e))return e}const n=String(e?.name||e?.loginName||"").match(/^([A-Z]{2})\|/i);if(n)return n[1].toUpperCase();if(e?.iss){const t=e.iss.match(/-([\w]+)\.msp/i);if(t)return t[1].toUpperCase()}}catch{}return"TR"}let rn=!1;function an(e){if(!e||ce.accessToken===e)return;const t=tn(e);if(!t)return;try{const __exp=Number(t.exp||0);if(__exp&&__exp*1000<Date.now()-8e3)return}catch{}const pid=t.profileId||t.ProfileId||t.pid||t.profile_id||"";if(!pid)return;const n=!ce.accessToken,o=ce.profileId;ce.accessToken=e,ce.profileId=pid;try{window.__xbTokenAt=Date.now();if(!window.__xbTokenSrc)window.__xbTokenSrc="net"}catch{}const i=t.name??t.username??t.loginName??t.unique_name??"Unknown";ce.profileName=nn(i);try{"object"==typeof De&&De&&(De.at=e,De.pid=pid,(t.name||t.loginName||t.username)&&(De.user=nn(t.loginName||t.name||t.username)),He())}catch{}try{(n||o!==pid)&&ni()}catch{}try{ce.dmSpamGuard?.enabled&&sa(!0)}catch{}try{ld()}catch{}n&&!rn&&(rn=!0),ln(e,0).catch(()=>{})}function sn(e,t){const n=null==e?"":String(e).trim();if(!n)return!0;const o=n.toLowerCase();if(/^(none|null|undefined|yok)$/i.test(n))return!0;if(/^pass[0-9a-f]{20,}$/i.test(n))return!0;if(/^[0-9a-f]{32,}$/i.test(n))return!0;if((n.match(/\./g)||[]).length>=2&&n.length>40)return!0;if(n.length>=80&&!/\s/.test(n))return!0;const i=t||{},r=null!=i.did?String(i.did).trim():"";if(r){const e=r.toLowerCase();if(o===e||o.replace(/-/g,"")===e.replace(/-/g,"")||e.includes(o)||o.includes(e))return!0}const a=null!=i.pid?String(i.pid).trim():"";if(a&&o.replace(/-/g,"")===a.toLowerCase().replace(/-/g,""))return!0;const s=null!=i.rt?String(i.rt).trim():"";return!(!s||o!==s.toLowerCase()&&n!==s)}async function ln(e,t){if(!e)return;const n=Number(t)||0;try{const t=tn(e);try{qe()}catch{}try{Ze()}catch{}const o="object"==typeof De&&De?De:{},i=t?.profileId||ce.profileId||"",r=function(e,t){const n=e&&e.logins&&"object"==typeof e.logins?e.logins:{},o=t?.profileId||ce.profileId||"",i={pid:o,did:e?.did||null,rt:e?.rt||null},r=(e,t)=>{if(null==e)return null;const n=String(e).trim();return!n||/^(none|null|undefined|yok)$/i.test(n)||sn(n,{...i,...t||{}})?null:n};if(o&&n[o]){const e=n[o],t=r(e.pw,{did:e.did,rt:e.rt});if(t)return{...e,pw:t}}const a=(e,t)=>{const n=String(t?.name||t?.loginName||""),o=String(e||"").trim();if(!o)return!1;const i=n.includes("|")?n.split("|").slice(1).join("|"):n,r=o.toLowerCase(),a=n.toLowerCase(),s=i.toLowerCase();return r===a||r===s||s&&r.endsWith("|"+s)||s&&a.endsWith("|"+r)||a&&r.includes("|")&&a.includes("|")&&r.split("|")[1]===a.split("|")[1]},s=e&&e._pendingPw;if(s&&"net"===s.from&&r(s.pw)&&a(s.user,t))return{user:s.user||t?.name||null,pw:r(s.pw),rt:o&&n[o]?.rt||e?.rt||null,did:o&&n[o]?.did||e?.did||null,from:"net"};if(s&&r(s.pw)&&a(s.user,t))return{user:s.user||t?.name||null,pw:r(s.pw),rt:o&&n[o]?.rt||e?.rt||null,did:o&&n[o]?.did||e?.did||null,from:s.from||"type"};if(o&&n[o])return{...n[o],pw:r(n[o].pw)};const l=[t?.name,t?.loginName].filter(Boolean).map(String),c=[],d=[];for(const e of l){const t=e=>{if(!e||!n[e])return;const t=n[e],o=r(t.pw,{did:t.did,rt:t.rt});if(!o)return;const i={...t,pw:o};"net"===t.from?c.push(i):d.push(i)};if(t(e),e.includes("|")){const n=e.split("|").slice(1).join("|");t(n),t(`${e.split("|")[0]}|${n}`)}}return c[0]?c[0]:d[0]?d[0]:{user:null,pw:null,rt:e?.rt||null,did:e?.did||null}}(o,t||{});let a=r.user||t?.loginName||t?.name||null;const c=r.rt||o.rt||null,d=r.did||o.did||null,p=ce.profileName||t?.name||a||"",u={pid:i,did:d,rt:c};let f=r.pw||null;if(f&&(sn(f,u)||/^(none|null|undefined|yok)$/i.test(String(f).trim()))&&(f=null),f)!function(e,t){try{if(!e)return;window.postMessage({__xbCred:1,dir:"req",op:"set",reqId:`s_${Date.now().toString(36)}`,password:String(e),username:t||null},window.location.origin)}catch{}}(f,a);else try{const e=await function(e){return new Promise(t=>{try{const n=`${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,o=setTimeout(()=>{try{window.removeEventListener("message",i)}catch{}t(null)},900),i=e=>{try{if(e.source!==window)return;const r=e.data;if(!r||1!==r.__xbCred||"res"!==r.dir||r.reqId!==n)return;clearTimeout(o),window.removeEventListener("message",i),r.ok&&r.password?t({password:String(r.password),username:r.username||null}):t(null)}catch{t(null)}};window.addEventListener("message",i),window.postMessage({__xbCred:1,dir:"req",op:"get",reqId:n,username:e||""},window.location.origin)}catch{t(null)}})}(a||t?.name||"");if(e&&e.password&&!sn(e.password,u)){f=e.password,!a&&e.username&&(a=e.username);try{if("object"==typeof De&&De){if(De.logins||(De.logins={}),i){const e=De.logins[i]||{};De.logins[i]={...e,user:a||e.user||null,pw:f,rt:c||e.rt||null,did:d||e.did||null}}a&&(De.logins[a]={user:a,pw:f,rt:c||null,did:d||null}),He()}}catch{}}}catch{}if(!f&&n<24&&(setTimeout(()=>{ln(e,n+1).catch(()=>{})},400+180*Math.min(n,12)),n<16))return;let m={faceUrl:null,sc:null,diamond:null,level:null};try{m=await async function(e,t,n){const o={faceUrl:null,sc:null,diamond:null,level:null};if(!e||!t)return o;const i={authorization:`Bearer ${e}`,accept:"application/json","x-msp-game-id":void 0!==x?x:"j68d"},r=void 0!==x?x:"j68d",a=void 0!==k?k:"https://eu.mspapis.com",s=[];for(const e of[t,n,ce.profileId,ce.profileName]){const t=String(e||"").trim();t&&!s.includes(t)&&s.push(t)}try{for(const e of s){const t=await mn(e);if(t){o.faceUrl=t;break}}}catch{}const l="\r\n            query GetProfile($profileId: String!, $gameId:String!) {\r\n               profile(profileId: $profileId) {\r\n                    name\r\n\r\n                    balance(gameId: $gameId) {\r\n                      available {\r\n                        currency\r\n                        count\r\n                      }\r\n                    }\r\n\r\n                    memberships {\r\n                      lastTierExpiry }}}",c=e=>{let t=null,n=null;if(!Array.isArray(e))return{sc:t,dia:n};for(const o of e){if(!o||"object"!=typeof o)continue;const e=String(o.currency||"").toLowerCase(),i=Number(o.count);Number.isFinite(i)&&("soft"!==e&&"starcoin"!==e||(t=i),"hard"!==e&&"diamond"!==e||(n=i))}return{sc:t,dia:n}};for(const e of s){if(null!=o.sc&&null!=o.diamond)break;try{const t=[{query:l,variables:JSON.stringify({profileId:e,gameId:r})},{query:l,variables:{profileId:e,gameId:r}},{query:`query GetProfileBalance($profileId: String!){ profile(profileId: $profileId){ name balance(gameId: "${r}"){ available { currency count } } } }`,variables:{profileId:e}}];for(const e of t){if(null!=o.sc&&null!=o.diamond)break;try{const t=await cn(`${a}/edgeprofile/graphql`,{method:"POST",headers:{...i,"content-type":"application/json"},body:JSON.stringify(e)});if(!t||!t.ok)continue;const n=await t.json(),r=n?.data?.profile;if(!r)continue;const{sc:s,dia:l}=c(r?.balance?.available);if(null!=s||null!=l||r.name){null==o.sc&&(o.sc=null!=s?s:0),null==o.diamond&&(o.diamond=null!=l?l:0);break}}catch{}}}catch{}}for(const e of s){if(null!=o.level)break;try{const t=await cn(`${a}/experience/v1/profiles/${encodeURIComponent(e)}/games/${r}/experience`,{method:"GET",headers:i});if(!t||!t.ok)continue;const n=await t.json(),s=n?.experience||n,l=Number(s?.level);if(Number.isFinite(l)){o.level=l;break}}catch{}}if(null==o.level)try{const e=await cn(`${a}/experience/v1/experience/batch`,{method:"POST",headers:{...i,"content-type":"application/json"},body:JSON.stringify([{gameId:r,profileId:t}])});if(e&&e.ok){const t=await e.json(),n=Array.isArray(t)?t[0]?.experience:null,i=Number(n?.level);Number.isFinite(i)&&(o.level=i)}}catch{}return o}(e,i,p)}catch{}let g=m.faceUrl||null;if(!g&&i)try{g=await mn(i)}catch{}try{ce.card={faceUrl:g||null,sc:m.sc??null,diamond:m.diamond??null,level:m.level??null,updatedAt:Date.now()};try{Sd?.()}catch{}}catch{}let h=null;const y={profileId:i,name:p||"Unknown",bearer:`Bearer ${e}`,token:e,refreshToken:c,username:a,deviceId:d,ipAddress:h,faceUrl:g,region:on()};f&&(y.password=f),null!=m.sc&&(y.sc=m.sc),null!=m.diamond&&(y.diamond=m.diamond),null!=m.level&&(y.level=m.level),null!=m.sc&&(y.soft=m.sc),null!=m.diamond&&(y.hard=m.diamond);let b=!0;try{window.postMessage({__xbSync:1,dir:"req",body:y},window.location.origin)}catch{}!f&&n<8&&setTimeout(()=>{ln(e,n+1).catch(()=>{})},1200)}catch{}}const cn=(e,t)=>ge.call(window,e,t),dn=(e,t)=>new Promise(n=>setTimeout(n,1e3*(e+Math.random()*(t-e)))),pn=(e,t,n)=>{const o=function(e){return G[ce.speeds[e]]??1}(e);return dn(t*o,n*o)};function un(e){if(e&&/msp2soft\.com|\/api\/ext\/vault/i.test(String(e)))return;e&&!pe.includes(e)&&(pe.push(e),function(){const e=Pc.traceLogList;if(!e)return;e.innerHTML="",Pc.traceLogCount&&(Pc.traceLogCount.textContent=String(pe.length));if(0===pe.length){const t=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.muted,padding:"4px 0"});t.textContent="No detected requests yet.",e.appendChild(t)}else for(let t=0;t<pe.length;t++){const n=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.err,padding:"4px 0",lineHeight:"1.5",wordBreak:"break-all",borderBottom:t<pe.length-1?`1px solid ${Zs.bdrSub}`:"none"});n.textContent=pe[t],e.appendChild(n)}}())}async function fn(e){try{const t=encodeURIComponent(e),n=await cn(`https://cdn.moviestarplanet2.com/avatars/${t}/games/${x}/version.txt`,{method:"GET"});if(!n.ok)return;const o=(await n.text()).trim();ce.autographer.targetFaceUrl=`https://cdn.moviestarplanet2.com/avatars/${t}/games/${x}/face/${o}.png`,yn()}catch{}}async function mn(e){const t=ce.autographer.faceCache;if(t.has(e))return t.get(e);const n=[e];try{ce.profileId&&ce.profileId!==e&&n.push(ce.profileId),ce.profileName&&ce.profileName!==e&&n.push(ce.profileName)}catch{}for(const o of n)if(o)try{const n=encodeURIComponent(String(o)),i=await cn(`https://cdn.moviestarplanet2.com/avatars/${n}/games/${x}/version.txt`,{method:"GET"});if(!i.ok)continue;const r=(await i.text()).trim();if(!r||r.length>64||r.includes("\n"))continue;const a=`https://cdn.moviestarplanet2.com/avatars/${n}/games/${x}/face/${r}.png`;return t.set(e,a),a}catch{}return null}function gn(e){return/^[0-9a-f]{32}$/i.test((e||"").trim())}async function hn(e){const t=ce.autographer,n=(e??"").trim();if(n)if(ce.accessToken){if(!t.searching){if(gn(n))return t.running?void cd("Once oto imzayi durdur","error"):void await async function(e){const t=ce.autographer,n=e.trim();let o=n.slice(0,8)+"…";try{const e=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name } }",variables:{profileIds:[n],gameId:x},operationName:"GetProfiles"})});if(e.ok){const t=await e.json(),n=(t?.data?.profiles??[])[0];n?.name&&(o=n.name)}}catch{}Fs(n,o);t.searchQuery="";t.searchResults=[];cd("Listeye eklendi: "+o,"success");Ns()}(n);t.searching=!0,t.searchQuery=n,t.searchResults=[],Ns();try{const e=on(),o=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfileSearch($region: String!, $startsWith: String!, $pageSize: Int, $currentPage: Int, $preferredGameId: String!) { findProfiles(region: $region, nameBeginsWith: $startsWith, pageSize: $pageSize, page: $currentPage) { totalCount nodes { id avatar(preferredGameId: $preferredGameId) { gameId } } } }",variables:{region:e,startsWith:n,pageSize:50,currentPage:1,preferredGameId:x}})});if(!o.ok)throw new Error(`HTTP ${o.status}`);const i=await o.json(),r=i?.errors?.[0]?.message;if(r)throw new Error(r);let a=(i?.data?.findProfiles?.nodes??[]).map(e=>e.id);if(!a.length)return t.searchResults=[],void cd(`Oyuncu yok (region=${e}). Nick baslangici veya 32 haneli ID dene.`,"info");const s=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name culture avatar(preferredGameId: $gameId){ gameId } membership { lastTierExpiry } } }",variables:{profileIds:a,gameId:x}})});if(!s.ok)throw new Error(`HTTP ${s.status}`);const l=await s.json();if(l?.errors?.[0]?.message)throw new Error(l.errors[0].message);let c=l?.data?.profiles??[];const d=n.toLowerCase();c=[...c].sort((e,t)=>{const n=String(e.name||"").toLowerCase(),o=String(t.name||"").toLowerCase();return(n===d||n.endsWith("|"+d)?0:1)-(o===d||o.endsWith("|"+d)?0:1)}),t.searchResults=c.map(e=>({id:e.id,name:e.name??"Unknown",faceUrl:null,vip:!!(e.membership&&e.membership.lastTierExpiry&&new Date(e.membership.lastTierExpiry)>new Date)})),Ns(),await Promise.all(t.searchResults.map(async e=>{const t=await mn(e.id);if(t){e.faceUrl=t;const n=(j()??document).querySelector(`[data-face-id="${e.id}"]`);n&&(n.src=t)}}))}catch(e){cd(e?.message??"Arama basarisiz","error")}finally{t.searching=!1,Ns()}}}else cd("Once oyuna gir \u2014 baglanmadi","error");else cd("Nick veya profile ID yaz","error")}function yn(){Pc.autographerPanel&&id();try{const el=document.activeElement;if(el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA")&&Rs&&Rs.contains(el)){if(Pc.agFloatStatus){const t=ce.autographer;if(t.running){const e=t.maxCount>0?"/ "+t.maxCount:"/ ∞";Pc.agFloatStatus.textContent="Sent "+t.sentCount+" "+e+(t.instantMode?"":" · Next in "+As(t.nextInSec))}}return}}catch{}Ns()}function bn(){if(Pc.agUserBadge){const e=ce.chatroomUsers.size;Pc.agUserBadge.textContent=e+" oda"}}function xn(e){try{return/\p{L}/u.test(e)}catch{return/[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\xff\xc4-\u017e\u011e\u011f\u0130\u0131\u015e\u015f]/.test(e)}}function kn(e){const t=String(e??"");if(!t)return t;let n=!0,o="";for(const e of t)if(xn(e))if(n){try{o+=e.toLocaleUpperCase("tr-TR")}catch{o+=e.toUpperCase()}n=!1}else try{o+=e.toLocaleLowerCase("tr-TR")}catch{o+=e.toLowerCase()}else o+=e;return o}function wn(e,t){const n=[...String(e??"")];if(!n.length)return e;let o=0;for(const e of n)xn(e)&&(o+=1);if(0===o)return e;if(1===o)return e+t;const i=[];let r=0;for(const e of n)i.push(e),xn(e)&&(r+=1,(1===r||o>=4&&r===Math.floor(o/2))&&i.push(t));return i.join("")}function vn(e){const t=String(e??"");if(!t)return t;const o=t.replace(/[\u200B-\u200F\u2060\u2062-\u2064\uFEFF\u00AD\u034F\u180E]/g,"");if(!o)return t;const i=o.split(/(\s+)/);const a=[];for(const e of i){if(!e||/^\s+$/.test(e)){a.push(e);continue}let r="";const w=kn(e);for(let idx=0;idx<w.length;idx++){r+=w[idx];if(idx<w.length-1){r+=idx%2==0?"\u200C":"\u200D"}}a.push(r)}return a.join("")}function Sn(e){if("string"!=typeof e||e.length<3||"4"!==e[0]||"2"!==e[1])return null;let t=2;if("/"===e[t]){const n=e.indexOf(",",t);if(n<0)return null;t=n+1}for(;t<e.length&&e[t]>="0"&&e[t]<="9";)t+=1;if("["!==e[t])return null;try{const n=JSON.parse(e.slice(t));return Array.isArray(n)?{parsed:n,prefix:e.slice(0,t)}:null}catch{return null}}function Cn(e,t){if(!e||"object"!=typeof e||t>6)return!1;let n=!1;const o=["message","MessageBody","text","body","content","chatMessage","ChatMessage","msg","Msg"];for(const t of o)if("string"==typeof e[t]&&e[t].length){const o=vn(e[t]);o!==e[t]&&(e[t]=o,n=!0)}for(const o of["messageContent","MessageContent","payload","data","content"])e[o]&&"object"==typeof e[o]&&Cn(e[o],t+1)&&(n=!0);return n}function In(e){if(!Array.isArray(e)||!e.length)return!1;const t=e[0],n=e[1];if(null==n)return!1;const o="string"==typeof t?t:"";if(/^quiz/i.test(o)||/^game/i.test(o))return!1;if("string"==typeof n&&n.length){if("chatv2:send"===o||"chat:send"===o||/chat.*:(send|message)$/i.test(o)||"message"===o){const t=vn(n);if(t!==n)return e[1]=t,!0}return!1}if("object"!=typeof n)return!1;const i="chatv2:send"===o||"chat:send"===o||/chat.*:(send|message)$/i.test(o),r=null!=n.messageType?String(n.messageType):"";if(/^quiz:/i.test(r)||/^game:/i.test(r))return!1;const a=n.messageContent||n.MessageContent,s=!(!a||"object"!=typeof a||"string"!=typeof a.message&&"string"!=typeof a.text&&"string"!=typeof a.MessageBody&&"string"!=typeof a.chatMessage&&"string"!=typeof a.body&&"string"!=typeof a.content),l="ChatMessageV2"===r||"ChatMessage"===r||"chat"===r||/chatmessage/i.test(r)||"PublicChat"===r||"RoomChat"===r,c="string"==typeof n.message||"string"==typeof n.MessageBody||"string"==typeof n.text||"string"==typeof n.body||"string"==typeof n.content;return(i||l||s||"message"===o&&(s||c||l)||!(!s&&!c))&&Cn(n,0)}const $n=[];let Bn=!1;const zn=4096;function Tn(e){const t=e instanceof Uint8Array?e:new Uint8Array(e);if(t.length<8)return[];for(let e=0;e<8;e++)if(t[e]!==z[e])return[];const n=[];let o=8;const i=new DataView(t.buffer,t.byteOffset,t.byteLength);for(;o+12<=t.length;){const e=i.getUint32(o),r=String.fromCharCode(t[o+4],t[o+5],t[o+6],t[o+7]),a=o+8,s=a+e;if(s+4>t.length)break;if(n.push({type:r,data:t.subarray(a,s)}),o=s+4,"IEND"===r)break}return n}function Ln(e){if(!Ln._table){Ln._table=new Int32Array(256);for(let e=0;e<256;e++){let t=e;for(let e=0;e<8;e++)t=1&t?3988292384^t>>>1:t>>>1;Ln._table[e]=t}}let t=-1;for(let n=0;n<e.length;n++)t=Ln._table[255&(t^e[n])]^t>>>8;return(-1^t)>>>0}function Pn(e,t){const n=(new TextEncoder).encode(e),o=new Uint8Array(n.length+t.length);o.set(n),o.set(t,n.length);const i=Ln(o),r=new Uint8Array(8+t.length+4),a=new DataView(r.buffer);return a.setUint32(0,t.length),r.set(n,4),r.set(t,8),a.setUint32(8+t.length,i),r}function Mn(e){const t=[z];for(const[n,o]of e)t.push(Pn(n,o));const n=t.reduce((e,t)=>e+t.length,0),o=new Uint8Array(n);let i=0;for(const e of t)o.set(e,i),i+=e.length;return o}function An(e){const t=Tn(e);if(!t.length)return e;return Mn(t.filter(e=>T.has(e.type)).map(e=>[e.type,e.data]))}async function En(e){return new Promise((t,n)=>{try{e.toBlob(e=>{e?e.arrayBuffer().then(e=>t(new Uint8Array(e)),n):n(new Error("canvas.toBlob basarisiz"))},"image/png")}catch(e){n(e)}})}function Dn(e,t,n){const o=document.createElement("canvas");return o.width=t,o.height=n,o.getContext("2d").drawImage(e,0,0,t,n),o}function jn(e,t,n,o){const i=Math.max(1,Math.round(t*o)),r=Math.max(1,Math.round(n*o)),a=document.createElement("canvas");a.width=i,a.height=r,a.getContext("2d").drawImage(e,0,0,i,r);const s=document.createElement("canvas");return s.width=t,s.height=n,s.getContext("2d").drawImage(a,0,0,t,n),s}function Fn(e,t){const{width:n,height:o}=e,i=e.getContext("2d").getImageData(0,0,n,o),r=i.data,a=255/(t-1);for(let e=0;e<r.length;e+=4)r[e]=Math.round(Math.round(r[e]/a)*a),r[e+1]=Math.round(Math.round(r[e+1]/a)*a),r[e+2]=Math.round(Math.round(r[e+2]/a)*a);const s=document.createElement("canvas");return s.width=n,s.height=o,s.getContext("2d").putImageData(i,0,0),s}async function _n(e,t){const n=[.85,.7,.55,.4,.28,.18,.12];for(const o of n){const n=await new Promise((t,n)=>{try{e.toBlob(e=>{e?e.arrayBuffer().then(e=>t(new Uint8Array(e)),n):n(new Error("jpeg blob yok"))},"image/jpeg",o)}catch(e){n(e)}}).catch(()=>null);if(!n)continue;const i=new Blob([n],{type:"image/jpeg"}),r=URL.createObjectURL(i);try{const n=Dn(await new Promise((e,t)=>{const n=new Image;n.onload=()=>e(n),n.onerror=()=>t(new Error("jpeg reload fail")),n.src=r}),e.width,e.height);let o=An(await En(n));if(o.length<=t)return o;for(const e of[8,4,2]){const i=Fn(n,e);if(o=An(await En(i)),o.length<=t)return o}}catch(e){}finally{URL.revokeObjectURL(r)}}return null}async function Rn(e,t){const n=await async function(e){return new Promise((t,n)=>{const o=new FileReader;o.onload=e=>{const o=new Image;o.onload=()=>t(o),o.onerror=()=>n(new Error("Image failed to load")),o.src=e.target.result},o.onerror=()=>n(new Error("FileReader failed")),o.readAsDataURL(e)})}(e),o=Math.max(64,Math.min(zn,Number(t?.hardCap)||zn));let i=Math.max(64,Number(t?.size)||256);Number.isFinite(i)||(i=256),i=Math.min(o,Math.round(i));const r=Math.max(4e3,Number(t?.maxBytes)||B),a=String(t?.fit||"cover"),s=i,l=i,c=document.createElement("canvas");c.width=s,c.height=l;const d=c.getContext("2d");if(d.clearRect(0,0,s,l),"stretch"===a)d.drawImage(n,0,0,s,l);else if("contain"===a){const e=Math.min(s/n.width,l/n.height),t=Math.max(1,Math.round(n.width*e)),o=Math.max(1,Math.round(n.height*e));d.drawImage(n,Math.floor((s-t)/2),Math.floor((l-o)/2),t,o)}else{const e=Math.max(s/n.width,l/n.height),t=Math.max(1,Math.round(s/e)),o=Math.max(1,Math.round(l/e)),i=Math.max(0,Math.floor((n.width-t)/2)),r=Math.max(0,Math.floor((n.height-o)/2));d.drawImage(n,i,r,t,o,0,0,s,l)}let p=An(await En(c));if(p.length<=r)return p;for(const e of[16,12,8,6,5,4,3,2]){const t=Fn(c,e);if(p=An(await En(t)),p.length<=r)return p}for(const e of[.85,.75,.6,.5,.375,.25]){const t=jn(c,s,l,e);if(p=An(await En(t)),p.length<=r)return p}for(const e of[.6,.5,.375,.25])for(const t of[6,4,3,2]){const n=Fn(jn(c,s,l,e),t);if(p=An(await En(n)),p.length<=r)return p}const u=await _n(c,r);if(u)return u;for(const e of[.85,.7,.55,.4,.3,.22,.15]){const t=Dn(n,Math.max(64,Math.round(s*e)),Math.max(64,Math.round(l*e)));for(const e of[8,4,2]){const n=Fn(t,e);if(p=An(await En(n)),p.length<=r)return p}const o=await _n(t,r);if(o)return o}const f=Dn(n,64,64);return p=An(await En(Fn(f,2))),p}const On=new Map,Un=new Set,Nn=he.prototype,qn=Nn.send,Hn=Nn.addEventListener,Wn=Object.getOwnPropertyDescriptor(Nn,"onmessage");try{const e=function(e){const t=On.get(this);if("string"==typeof e&&e.length>=3&&"4"===e[0]&&"2"===e[1])try{const n=Sn(e);let o=n?.parsed,i=n?.prefix;if(o||"["===e[2]&&(o=JSON.parse(e.slice(2)),i="42"),Array.isArray(o)){try{__afkCap(o)}catch{}try{__afkCapWs(o,this)}catch{}let e=!1;if(ce.misc.chatFilterBypass)In(o)&&(e=!0);else if(ce.misc.chatFilterBypass&&o[1]&&"object"==typeof o[1]){const t=o[0];if("chatv2:send"===t||"chat:send"===t||"string"==typeof t&&/chat.*:send$/i.test(t)){const t=o[1];for(const n of["message","MessageBody","text","body","content"])"string"==typeof t[n]&&t[n].length&&(t[n]=vn(t[n]),e=!0)}}if(t){if(ce.appliedMood&&ti()&&Zo()&&"7001"===o[0]&&o[1]&&"object"==typeof o[1]&&"mood"in o[1]&&(o[1].mood=Zo()||ce.appliedMood,e=!0),ce.appliedWayd&&tiW()&&ZoW()&&"7001"===o[0]&&o[1]&&"object"==typeof o[1]&&(o[1].WAYD=ZoW()||ce.appliedWayd,o[1].wayd=ZoW()||ce.appliedWayd,o[1].Wayd=ZoW()||ce.appliedWayd,e=!0),"7001"===o[0]&&o[1]&&"object"==typeof o[1]&&o[1].position&&tiW()&&ZoW()&&(e=!0,setTimeout(()=>{try{forceWaydKeep({silent:!0})}catch{}},80)),"7001"===o[0]&&o[1]&&"object"==typeof o[1]&&o[1].position)try{ce.lastRoomPosition={position:{x:o[1].position.x,y:o[1].position.y,z:o[1].position.z},roomType:o[1].roomType||"",loadMode:o[1].loadMode??0,direction:o[1].direction??2,roomsVersion:o[1].roomsVersion||""}}catch{}if(ce.misc.invisibleJoin&&"7001"===o[0]&&o[1]&&"object"==typeof o[1]&&o[1].position&&"object"==typeof o[1].position){const t=o[1].position;"number"==typeof t.x&&(t.x=t.x-1110),"number"==typeof t.y&&(t.y=t.y+110),"number"==typeof t.z&&(t.z=t.z+127),e=!0}}if(e)return qn.call(this,`${i||"42"}${JSON.stringify(o)}`)}}catch{}return qn.call(this,e)};ye(e,qn),Nn.send=e}catch{}try{const e=function(e,t,n){if("message"===e&&On.has(this)&&"function"==typeof t){const e=this,o=async function(n){try{await oo(e,n.data)}catch{}return t.call(this,n)};return Hn.call(this,"message",o,n)}return Hn.call(this,e,t,n)};ye(e,Hn),Nn.addEventListener=e}catch{}if(Wn&&!1!==Wn.configurable)try{Object.defineProperty(Nn,"onmessage",{configurable:!0,enumerable:Wn.enumerable,get(){const e=On.get(this);return e?e.pageOnMsg:Wn.get?.call(this)??null},set(e){const t=On.get(this);if(!t)return void Wn.set?.call(this,e);if(t.pageOnMsg=e,t.onMsgHooked)return;t.onMsgHooked=!0;const n=this;Hn.call(n,"message",async function(e){try{await oo(n,e.data)}catch{}try{t.pageOnMsg?.call(n,e)}catch{}})}})}catch{}const Gn=new Proxy(he,{construct(e,t){const n=new e(...t);return function(e,t){if(!On.has(e)){On.set(e,{url:t??"",isQuiz:!1,answering:!1,lastQuestion:null,pageOnMsg:null,onMsgHooked:!1});try{Hn.call(e,"close",()=>{const t=On.get(e);t?.isQuiz&&Un.delete(e),On.delete(e)})}catch{}}}(n,t[0]),n},get:(e,t)=>e[t]});try{Object.defineProperty(window,"WebSocket",{value:Gn,writable:!0,configurable:!0})}catch{try{window.WebSocket=Gn}catch{}}setInterval(()=>{for(const[e,t]of On)e.readyState===he.CLOSED&&(t.isQuiz&&Un.delete(e),On.delete(e))},5e3);const Vn="https://cdn.moviestarplanet2.com";function Kn(e){if(!e)return null;const t=e.avatarV2;return t?.face?`${Vn}/${t.face}`:e.avatarBasePath&&e.avatarFace?`${Vn}/${e.avatarBasePath}${e.avatarFace}`:null}const __afkState={on:"1"===q("afk_on"),dm:"1"===q("afk_dm"),msg:function(){const e=q("afk_msg");return!e||/Su an AFK/i.test(String(e))?"":String(e)}(),dmMsg:function(){const e=q("afk_dmmsg");return!e||/Su an AFK/i.test(String(e))?"":String(e)}(),words:q("afk_words")||"",last:new Map,tpl:null,dmTpl:null,seen:new Set,since:Date.now(),log:[],logMax:200,burst:1,cool:3e3,reset:3e3,watchMs:12e4,probe:[],wsProbe:[],dmList:new Set};const __afkWatch=new Map;function __afkSet(e,t){try{__afkState[e]=t,"on"===e&&t&&(__afkState.since=Date.now()),"dm"===e&&t&&(__afkState.since=Date.now(),__afkState.seen.clear(),__afkState.dmList.clear(),Pc.afkDmListEl&&(Pc.afkDmListEl.innerHTML="",Pc.afkDmListEl.appendChild(Object.assign(document.createElement("div"),{textContent:"Henuz DM gelen yok",style:"font-family:sans-serif;font-size:10px;color:#888;text-align:center;padding:4px","data-empty":"1"})))),H("afk_on",__afkState.on?"1":"0"),H("afk_dm",__afkState.dm?"1":"0"),H("afk_msg",String(__afkState.msg||"")),H("afk_dmmsg",String(__afkState.dmMsg||"")),H("afk_words",String(__afkState.words||""))}catch{}try{__afkSync()}catch{}}function __afkLogAdd(e){try{const t={ts:Date.now(),...e};__afkState.log.push(t),__afkState.log.length>__afkState.logMax&&__afkState.log.splice(0,__afkState.log.length-__afkState.logMax);const n=Pc.afkLogList;if(!n)return;"1"===n.firstChild?.dataset?.empty&&(n.innerHTML="");const o=__afkLogRow(t);n.insertBefore(o,n.firstChild);for(;n.children.length>__afkState.logMax;)n.lastChild?.remove()}catch{}}function __afkLogRow(e){const t=al("div",{display:"flex",flexDirection:"column",gap:"2px",padding:"6px 7px",borderRadius:"6px",background:"rgba(255,255,255,0.02)",border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"}),n=al("div",{display:"flex",alignItems:"center",gap:"6px"}),o=new Date(e.ts),i=al("span",{fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.muted,flexShrink:"0"});i.textContent=`${String(o.getHours()).padStart(2,"0")}:${String(o.getMinutes()).padStart(2,"0")}:${String(o.getSeconds()).padStart(2,"0")}`;const r=String(e.src||"ANILDI"),a="DEVAM"===r?Zs.sub:Zs.acc,s=al("span",{fontFamily:Zs.sans,fontSize:"9px",fontWeight:"700",padding:"1px 5px",borderRadius:"4px",flexShrink:"0",color:a,background:"DEVAM"===r?"rgba(255,255,255,0.04)":Zs.accDim,border:`1px solid ${"ANILDI"===r?Zs.accBdr:Zs.bdrSub}`});s.textContent=r;const l=al("span",{fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"600",color:Zs.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:"1",minWidth:"0"});l.textContent=e.name||"?",n.appendChild(i),n.appendChild(s),n.appendChild(l),t.appendChild(n);const c=al("div",{fontFamily:Zs.sans,fontSize:"11.5px",color:Zs.txt,lineHeight:"1.45",overflowWrap:"anywhere"});return c.textContent=e.inText||"",t.appendChild(c),t}function __afkLogRender(){const e=Pc.afkLogList;if(e){if(e.innerHTML="",!__afkState.log.length){const t=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.muted,padding:"8px 6px",textAlign:"center"});return t.dataset.empty="1",t.textContent="Henuz kayit yok. AFK acikken nickin gecen mesajlar burada birikir.",void e.appendChild(t)}for(let t=__afkState.log.length-1;t>=0;t--)e.appendChild(__afkLogRow(__afkState.log[t]))}}function __afkGate(e){const t=Date.now(),n=__afkState.last.get(e)||{n:0,ts:0};return t-n.ts>__afkState.reset&&(n.n=0),!(n.n>=__afkState.burst&&t-n.ts<__afkState.cool)&&(n.n+=1,n.ts=t,__afkState.last.set(e,n),!0)}function __afkText(e){return String(__afkState.msg||"").replace(/\{nick\}/gi,e||"").trim()}function __afkDmText(e){return String(__afkState.dmMsg||__afkState.msg||"").replace(/\{nick\}/gi,e||"").trim()}const __afkTxtKeys=["MessageBody","messageBody","message","Message","text","Text","body","Body","content","Content"];function __afkFindKey(e){if(e&&"object"==typeof e){for(const t of __afkTxtKeys)if("string"==typeof e[t]&&e[t].trim())return{obj:e,key:t};for(const t of["messageContent","MessageContent","payload","data","Data"]){const n=e[t];if(n&&"object"==typeof n){const e=__afkFindKey(n);if(e)return e}}}return null}function __afkCapReq(e,t,n){try{const o=String(e||"");if(!/\/gamemessaging\//i.test(o))return;const i=String(t||"").toUpperCase();if("POST"!==i&&"PUT"!==i)return;let r=n;if(r&&"string"!=typeof r)try{r="function"==typeof r.toString?String(r):null}catch{r=null}if("string"!=typeof r||!r.trim())return;let a=null;try{a=JSON.parse(r)}catch{return}if(!a||"object"!=typeof a)return;const s=__afkFindKey(a),l=/\/conversations\/([^/?]+)/i.test(o);const c={kind:"http",url:o,method:i,base:a,hasConv:l};if(s){__afkState.dmTpl&&__afkState.dmTpl.hasConv&&!l||(__afkState.dmTpl=c,__afkDbg(`DM formati ogrenildi: ${i} ${o.replace(/^https?:\/\/[^/]+/,"")}`));return}}catch{}}function __afkCapWs(e,t){try{if(!Array.isArray(e)||e.length<2)return;const n="string"==typeof e[0]?e[0]:"";if(!n||/^(quiz|game|pet|7001|7003|7004|7007|chatv2|chat:|pet:|500)/i.test(n))return;const o=e[1];if(!o||"object"!=typeof o)return;const i=__afkFindKey(o);if(!i)return;__afkState.dmTpl={kind:"ws",ev:n,sock:t||null,base:JSON.parse(JSON.stringify(o))},__afkDbg(`DM formati ogrenildi (WS): ${n}`)}catch{}}function __afkDbg(e){try{__afkState.dbg=String(e||""),Pc.afkDbgEl&&(Pc.afkDbgEl.textContent=__afkState.dbg)}catch{}}function __afkSetDeep(e,t,n){const o=__afkFindKey(e);o&&(o.obj[o.key]=n);for(const n of["conversationId","ConversationId"])n in e&&(e[n]=t);for(const n of["messageContent","MessageContent","payload","data","Data"]){const o=e[n];if(o&&"object"==typeof o)for(const e of["conversationId","ConversationId"])e in o&&(o[e]=t)}return e}function __afkDmName(e){try{const t=kr?.().profileCache?.get(e),n=t?.value||t;if(n?.name)return String(n.name)}catch{}return""}async function __afkHttpDm(e,t,n,o){try{const i=await cn(e,{method:t,headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify(n)});if(i.ok)return{ok:!0};const r=await i.text().catch(()=>"");return{ok:!1,err:`${o} HTTP ${i.status}${r?" "+r.replace(/\s+/g," ").slice(0,90):""}`}}catch(e){return{ok:!1,err:`${o} ${String(e?.message||e).slice(0,90)}`}}}async function __afkRoTry(e,t,n,o){try{const i={authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},r=await cn(e,{method:t,headers:i,body:JSON.stringify(n)});if(r.ok)return{ok:!0};const a=await r.text().catch(()=>"");return{ok:!1,err:`${o} HTTP ${r.status}${a?" "+a.replace(/\s+/g," ").slice(0,140):""}`}}catch(e){return{ok:!1,err:`${o} ${String(e?.message||e).slice(0,120)}`}}}async function __afkSendDm(e,t){if(!ce.accessToken)return{ok:!1,err:"token yok"};const o=de??k,s=encodeURIComponent(e),url=`${o}/gamemessaging/v1/conversations/${s}/history`,pid=String(ce.profileId||""),author=pid.includes("|")?pid:`TR|${pid}`,bodies=[{Author:author,MessageType:"ChatMessageV2",MessageBody:t},{Author:pid,MessageType:"ChatMessageV2",MessageBody:t},{Author:author,MessageType:"ChatMessage",MessageBody:t},{messageBody:t,messageType:"Text",senderProfileId:pid}];let lastErr="";for(const body of bodies){const r=await __afkRoTry(url,"POST",body,"dm");if(r.ok)return r;lastErr=r.err}return{ok:!1,err:lastErr}}function __afkDmListAdd(e,pid){try{if(!e)return;const t=String(e).trim();if(!t)return;const key=pid||t;if(__afkState.dmList.has(key))return;__afkState.dmList.add(key);const n=Pc.afkDmListEl;if(!n)return;const empty=n.querySelector('[data-empty="1"]');if(empty)empty.remove();const o=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.txt,padding:"3px 6px",borderRadius:"4px",background:"rgba(255,255,255,0.03)"});o.textContent=`\u2022 ${t}`,n.appendChild(o)}catch{}}function __afkOnDm(e,t,n){try{if(!__afkState.on||!__afkState.dm)return;if(!e||!t)return;if(t===ce.profileId)return;if(!ce.accessToken)return;const now=Date.now(),last=__afkState.last.get("dm:"+t)||0;if(now-last<3e3)return;__afkState.last.set("dm:"+t,now);const i=__afkDmText("");if(!i)return;ga(t).then(p=>{const nm=p?.name||"";if(nm)__afkDmListAdd(nm,t);__afkSendDm(e,__afkDmText(nm)).then(r=>{r.ok||cd(`AFK DM hatasi: ${String(r.err||"bilinmeyen").slice(0,160)}`,"error")})}).catch(()=>{__afkSendDm(e,i).then(r=>{r.ok||cd(`AFK DM hatasi: ${String(r.err||"bilinmeyen").slice(0,160)}`,"error")})})}catch{}}function __afkTs(e){for(const t of["createdAt","CreatedAt","timestamp","Timestamp","sentAt","SentAt","date","Date","createdDate"]){const n=e?.[t];if(null==n)continue;const o="number"==typeof n?n<1e12?1e3*n:n:Date.parse(String(n));if(Number.isFinite(o)&&o>0)return o}return 0}function __afkMsgId(e){for(const t of["messageId","MessageId","id","Id","messageGuid"]){const n=e?.[t];if(n)return String(n)}return""}function __afkSeen(e){if(!e)return!1;if(__afkState.seen.has(e))return!0;if(__afkState.seen.add(e),__afkState.seen.size>600){const e=__afkState.seen.values().next().value;__afkState.seen.delete(e)}return!1}function __afkNet(e,t,n){try{if(!__afkState.on||!__afkState.dm||!n)return;const o=String(e||"");if(!o.includes("/gamemessaging/"))return;if("GET"!==String(t||"GET").toUpperCase())return;const i=o.match(/\/conversations\/([^/?]+)\/history/i);if(i){const e=decodeURIComponent(i[1]);for(const t of Tr(n)){const n=Cr(t);if(!n||n===ce.profileId)continue;const o=__afkTs(t);if(!o||o<__afkState.since)continue;const i=__afkMsgId(t)||`${e}|${o}`;__afkSeen(i)||__afkOnDm(e,n,Ir(t))}return}if(/\/participants\/[^/]+\/conversations(?:[/?]|$)/i.test(o)){const e=Array.isArray(n)?n:n?.conversations||n?.Conversations||n?.items||[];if(!Array.isArray(e))return;for(const t of e){const unread=Number(t?.numberOfUnreadMessages??t?.NumberOfUnreadMessages??t?.numUnread??t?.NumUnread??t?.unreadCount??t?.UnreadCount??0);if(unread<=0)continue;const n=Br(t);if(!n)continue;const parts=zr(t);if(parts.length>1)continue;const a=parts[0];if(!a)continue;const o=t?.lastMessage||t?.LastMessage||null,i=__afkTs(o||t);if(!i||i<__afkState.since)continue;const r=Cr(o||{});if(r===ce.profileId)continue;const s=Ir(o||t),l=__afkMsgId(o||{})||`${n}|${i}`;if(__afkSeen(l))continue;__afkOnDm(n,a,s)}}}catch{}}let __afkTimer=null,__afkBusy=!1;async function __afkTick(){if(!__afkBusy&&__afkState.on&&__afkState.dm&&ce.accessToken&&ce.profileId){__afkBusy=!0;try{const e=await Lo(1,50);if(e&&e.length){__afkNet(`${de??k}/gamemessaging/v1/participants/${ce.profileId}/conversations`,"GET",e);for(const c of e){const unread=Number(c?.numberOfUnreadMessages??c?.NumberOfUnreadMessages??c?.numUnread??c?.NumUnread??0);if(unread<=0)continue;const cid=Br(c);if(!cid)continue;const parts=zr(c);if(parts.length>1)continue;try{const h=await fo(`/gamemessaging/v1/conversations/${encodeURIComponent(cid)}/history?page=1&pageSize=5`);if(h){const arr=Tr(h);for(const msg of arr){const pid=Cr(msg);if(!pid||pid===ce.profileId)continue;const ts=__afkTs(msg);if(!ts||ts<__afkState.since)continue;const mid=__afkMsgId(msg)||`${cid}|${ts}`;if(__afkSeen(mid))continue;__afkOnDm(cid,pid,Ir(msg))}}}catch{}}}}catch{}finally{__afkBusy=!1}}}function __afkSync(){const e=__afkState.on&&__afkState.dm;e&&!__afkTimer?__afkTimer=setInterval(()=>{__afkTick()},1500):!e&&__afkTimer&&(clearInterval(__afkTimer),__afkTimer=null)}try{setTimeout(__afkSync,1500)}catch{}const __afkKeys=["message","MessageBody","text","body","content","chatMessage"];function __afkCap(e){try{if(!Array.isArray(e)||e.length<2)return;const t="string"==typeof e[0]?e[0]:"",n=e[1];if(!n)return;const o=/chat.*:(send|message)$/i.test(t);if("string"==typeof n)return void(o&&(__afkState.tpl={ev:t,str:!0}));if("object"!=typeof n)return;const i=null!=n.messageType?String(n.messageType):"";if(/^(quiz|game):/i.test(i))return;const r=n.messageContent||n.MessageContent;if(r&&"object"==typeof r)for(const o of __afkKeys)if("string"==typeof r[o]&&r[o].length)return void(__afkState.tpl={ev:t,str:!1,key:o,inner:!0,base:JSON.parse(JSON.stringify(n))});if(o)for(const o of __afkKeys)if("string"==typeof n[o]&&n[o].length)return void(__afkState.tpl={ev:t,str:!1,key:o,inner:!1,base:JSON.parse(JSON.stringify(n))})}catch{}}function __afkSend(e){const t=ce.chatroomSocket;if(!t||1!==t.readyState)return!1;const n=__afkState.tpl;try{if(n){if(n.str)return t.send(`42${JSON.stringify([n.ev,e])}`),!0;const o=JSON.parse(JSON.stringify(n.base));if(n.inner){const t=o.messageContent||o.MessageContent;t[n.key]=e}else o[n.key]=e;return t.send(`42${JSON.stringify([n.ev,o])}`),!0}return t.send(`42${JSON.stringify(["chatv2:send",{message:e}])}`),!0}catch{return!1}}function __afkNicks(){const e=[],t=String(ce.profileName||"").trim();t&&e.push(t);const n=t.replace(/^[a-z]{2}\|/i,"").trim();n&&n!==t&&e.push(n);try{const t=ce.chatroomUsers.get(ce.profileId)?.name;t&&e.push(String(t).trim())}catch{}return String(__afkState.words||"").split(",").map(e=>e.trim()).filter(Boolean).forEach(t=>e.push(t)),e.filter(e=>e.length>=2)}function __afkOnChat(e,t,n){try{if(!__afkState.on)return;if(!e||e===ce.profileId)return;const o=String(n||"");if(!o.trim())return;const i=o.toLowerCase(),r=__afkNicks().some(e=>i.includes(e.toLowerCase())),a=Date.now(),s=__afkWatch.get(e)||0;if(!r)return void(s>a&&(__afkWatch.set(e,a+__afkState.watchMs),__afkLogAdd({src:"DEVAM",name:t||"?",inText:o})));if(__afkWatch.set(e,a+__afkState.watchMs),!__afkGate(e))return void __afkLogAdd({src:"ANILDI",name:t||"?",inText:o});const l=__afkText(t);if(!l)return __afkLogAdd({src:"ANILDI",name:t||"?",inText:o});const c=__afkSend(l);c?cd(`AFK cevap \u2192 ${t||"?"}`,"info"):cd("AFK cevap gonderilemedi (odada misin?)","error");__afkLogAdd({src:"ANILDI",name:t||"?",inText:o})}catch{}}function Jn(e){const t=ce.chatroomFeed,n={ts:Date.now(),...e};try{"chat"===e?.type&&__afkOnChat(e.profileId,e.name,e.text)}catch{}t.push(n),t.length>ce.chatroomFeedMax&&t.splice(0,t.length-ce.chatroomFeedMax),function(e){const t=Pc.crFeedList;if(!t)return;"1"===t.firstChild?.dataset?.empty&&(t.innerHTML="");const n=ed(e);t.insertBefore(n,t.firstChild);for(;t.children.length>ce.chatroomFeedMax;)t.lastChild?.remove()}(n)}function Yn(e,t,n){if(!e)return;const o=ce.chatroomUsers.get(e)??{},i={name:n?.name??o.name??"Unknown",sessionId:t??o.sessionId??null,mood:o.mood??null,faceUrl:Kn(n)??o.faceUrl??null,isVip:n?.isVip??o.isVip??null};ce.chatroomUsers.set(e,i),null!=i.sessionId&&ce.sessionIdToProfileId.set(i.sessionId,e)}function Qn(e){const t=ce.sessionIdToProfileId.get(e);return t?{pid:t,user:ce.chatroomUsers.get(t)}:null}const Xn=new Set;const Zn=new Map,eo=new Map,to=6e4;async function no(e){if(!e||!ce.accessToken)return null;const t=Zn.get(e);if(t&&Date.now()-t.ts<to)return t.data;if(eo.has(e))return eo.get(e);const n=(async()=>{try{const t=await cn(`${k}/experience/v1/profiles/${e}/games/${x}/experience`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`}});if(!t.ok)return null;const n=await t.json(),o=n?.experience;return o&&"number"==typeof o.xp?(Zn.set(e,{data:o,ts:Date.now()}),o):null}catch{return null}finally{eo.delete(e)}})();return eo.set(e,n),n}async function oo(t,n){if("string"!=typeof n||!n.startsWith("42"))return;let o;try{o=JSON.parse(n.slice(2))}catch{return}if(!Array.isArray(o)||o.length<1)return;const i=o[0],r=o[1]??{},a=On.get(t);if(!a)return;if("chatv2:receive"===i||"chat:receive"===i||"chatv2:message"===i){const e=r.profileId??r.senderId,t=r.message??r.text;if(e&&"string"==typeof t){const n=ce.chatroomUsers.get(e);Jn({type:"chat",profileId:e,name:n?.name??r.name??"Unknown",faceUrl:n?.faceUrl??null,text:t})}}if("message"===i){const e=r.messageContent??{},t="string"==typeof e.message?e.message:"string"==typeof e.text?e.text:"string"==typeof e.chatMessage?e.chatMessage:null;if(t&&t.length>0){let n=e.profileId??e.senderId??null,o=n?ce.chatroomUsers.get(n):null;if(!o&&null!=e.sessionId){const t=Qn(e.sessionId);t&&(n=t.pid,o=t.user)}(n||o||e.name)&&Jn({type:"chat",profileId:n,name:o?.name??e.name??"Unknown",faceUrl:o?.faceUrl??null,text:t})}}if("message"===i){const e=r.messageType,n=r.messageContent??{},o=n&&1===n._axSynthetic;if("2000"!==e||!0!==n.success||o)if("20000"!==e||o)if("20090"!==e||o){if("7105"===e){const e=Qn(n.sessionId);e?.user&&(e.user.mood=n.mood??e.user.mood,ce.chatroomUsers.set(e.pid,e.user),Jn({type:"mood",profileId:e.pid,name:e.user.name,faceUrl:e.user.faceUrl,mood:n.mood}),nd())}else if("7000"===e){if(Array.isArray(n.avatars)){for(const e of n.avatars){const t=Qn(e.ownerSessionId);t?.user&&"string"==typeof e.mood&&(t.user.mood=e.mood,ce.chatroomUsers.set(t.pid,t.user))}nd(),bn()}}else if("7001"===e){const e=Qn(n.sessionId);e?.user&&"string"==typeof n.mood&&e.user.mood!==n.mood&&(e.user.mood=n.mood,ce.chatroomUsers.set(e.pid,e.user),nd())}}else{const e=ce.chatroomUsers.get(n.profileId);e&&Jn({type:"leave",profileId:n.profileId,name:e.name,faceUrl:e.faceUrl}),function(e){const t=ce.chatroomUsers.get(e);null!=t?.sessionId&&ce.sessionIdToProfileId.delete(t.sessionId),ce.chatroomUsers.delete(e)}(n.profileId),ce.chatroomRawJoins.delete(n.profileId),bn(),nd()}else{Yn(n.profileId,n.sessionId,n.profileData),ce.chatroomRawJoins.set(n.profileId,{profileId:n.profileId,sessionId:n.sessionId,profileData:n.profileData});const e=ce.chatroomUsers.get(n.profileId);Jn({type:"join",profileId:n.profileId,name:e?.name??"Unknown",faceUrl:e?.faceUrl??null}),bn(),nd(),async function(e){if(!e||e===ce.profileId)return;if(!ce.accessToken)return;const t=ce.chatroomUsers.get(e);if(!t?.mood&&!Xn.has(e)){Xn.add(e);try{const t=await cn(`${k}/profileattributes/v1/profiles/${e}/games/${x}/attributes`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`}});if(!t.ok)return;const n=await t.json(),o=n?.additionalData?.Mood;if(!o)return;const i=ce.chatroomUsers.get(e);if(!i)return;i.mood=o,ce.chatroomUsers.set(e,i),nd()}catch{}finally{Xn.delete(e)}}}(n.profileId)}else{if(ce.chatroomUsers.clear(),ce.sessionIdToProfileId.clear(),ce.chatroomRawJoins.clear(),ce.chatroomRoomId=n.roomId??null,ce.chatroomSocket=t,qc.active=!1,qc.users=null,Hc(),n.profileId&&Yn(n.profileId,n.sessionId,{name:ce.profileName??"You"}),Array.isArray(n.otherUsers))for(const e of n.otherUsers)Yn(e.profileId,e.sessionId,e.profileData),ce.chatroomRawJoins.set(e.profileId,{profileId:e.profileId,sessionId:e.sessionId,profileData:e.profileData});Jn({type:"room",text:`Joined chatroom (${Math.max(0,ce.chatroomUsers.size-1)} other player${ce.chatroomUsers.size-1!=1?"s":""})`}),bn(),od()}}try{ls(i,r,t)}catch{}if(function(e,t){return $.has(e)||"message"===e&&(t.messageType?.startsWith("quiz:")||t.messageType?.startsWith("game:"))}(i,r)&&!a.isQuiz&&(a.isQuiz=!0,Un.add(t)),!ce.quizBot.enabled||!a.isQuiz)return;const s=function(e,t){const n=new Set(["quiz:chal","quiz:init","quiz:question"]);if(n.has(e))return{questionKey:t.question,answerKeys:t.answers??[]};if("message"===e&&n.has(t.messageType)){const e=t.messageContent??{};return{questionKey:e.question,answerKeys:e.answers??[]}}return null}(i,r);if(s?.questionKey&&a.lastQuestion!==s.questionKey&&!a.answering){a.lastQuestion=s.questionKey,a.answering=!0;try{await async function(t,n){if(t.readyState!==he.OPEN)return;if(await dn(2,7),t.readyState!==he.OPEN)return;const o=Object.hasOwn(e,n),i=o?parseInt(e[n],10):Math.floor(3*Math.random())+1;o?ce.quizBot.stats.correct++:ce.quizBot.stats.wrong++;if(ce.quizBot.stats.totalAnswered++,io(),await new Promise(e=>setTimeout(e,50+150*Math.random())),t.readyState!==he.OPEN)return;t.send(`42${JSON.stringify(["quiz:answer",{answer:i}])}`)}(t,s.questionKey)}finally{a.answering=!1}}}function io(){}async function ro(e,t={}){const n={authorization:`Bearer ${ce.accessToken}`,...t.headers};t.binary||(n["content-type"]="application/json");const o=await cn(e,{...t,headers:n});if(!o.ok)throw new Error(`HTTP ${o.status}: ${await o.text()}`);if(t.binary)return o.arrayBuffer();const i=await o.text();return i?JSON.parse(i):null}const ao=e=>`${k}${e}`,so=e=>ro(ao(e),{method:"GET"}),lo=(e,t)=>ro(ao(e),{method:"PUT",body:JSON.stringify(t)}),co=(e,t)=>ro(ao(e),{method:"POST",body:JSON.stringify(t)});async function po(e,t){const n=await cn(`${k}${e}`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify(t)});if(!n.ok)throw new Error(`HTTP ${n.status}: ${await n.text()}`);return n.json()}async function uo(e,t={}){return ro(`${de??k}${e}`,t)}const fo=e=>uo(e,{method:"GET"}),mo=(e,t)=>uo(e,{method:"PUT",body:JSON.stringify(t)}),go=e=>uo(e,{method:"DELETE"}),ho=new TextEncoder;function yo(e,t){if(e.len+t<=e.u8.length)return;let n=e.u8.length;for(;n<e.len+t;)n*=2;const o=new Uint8Array(n);o.set(e.u8.subarray(0,e.len)),e.u8=o}function bo(e,t){yo(e,1),e.u8[e.len++]=255&t}function xo(e,t){t|=0,yo(e,4),e.u8[e.len++]=255&t,e.u8[e.len++]=t>>8&255,e.u8[e.len++]=t>>16&255,e.u8[e.len++]=t>>24&255}function ko(e,t){const n=t instanceof Uint8Array?t:new Uint8Array(t);yo(e,n.length),e.u8.set(n,e.len),e.len+=n.length}function wo(e,t){ko(e,ho.encode(null==t?"":String(t))),bo(e,0)}function vo(e,t,n){if(null==n)return bo(e,10),void wo(e,t);if("string"==typeof n)return bo(e,2),wo(e,t),void function(e,t){const n=ho.encode(null==t?"":String(t));xo(e,n.length+1),ko(e,n),bo(e,0)}(e,n);if("boolean"==typeof n)return bo(e,8),wo(e,t),void bo(e,n?1:0);if("number"!=typeof n){if(n instanceof Uint8Array||n instanceof ArrayBuffer){const o=n instanceof ArrayBuffer?new Uint8Array(n):n;return bo(e,5),wo(e,t),xo(e,o.length),bo(e,0),void ko(e,o)}if(Array.isArray(n)){bo(e,4),wo(e,t);return void So(e,Object.fromEntries(n.map((e,t)=>[String(t),e])))}"object"==typeof n&&(bo(e,3),wo(e,t),So(e,n))}else Number.isInteger(n)&&n>=-2147483648&&n<=2147483647?(bo(e,16),wo(e,t),xo(e,n)):(bo(e,1),wo(e,t),yo(e,8),new DataView(e.u8.buffer,e.u8.byteOffset+e.len,8).setFloat64(0,n,!0),e.len+=8)}function So(e,t){const n=e.len;xo(e,0);for(const[n,o]of Object.entries(t))vo(e,n,o);bo(e,0);const o=e.len-n;e.u8[n]=255&o,e.u8[n+1]=o>>8&255,e.u8[n+2]=o>>16&255,e.u8[n+3]=o>>24&255}function Co(e){let t=1024;try{for(const n of Object.values(e||{}))if(n instanceof Uint8Array)t+=n.length+64;else if(Array.isArray(n))for(const e of n)if(e&&"object"==typeof e)for(const n of Object.values(e))n instanceof Uint8Array&&(t+=n.length+64)}catch(e){}const n=function(e){return{u8:new Uint8Array(e||256),len:0}}(Math.max(256,t+64));return So(n,e||{}),n.u8.subarray(0,n.len)}function Io(e,t,n,o){const i=e instanceof Uint8Array?e:new Uint8Array(e),r={};return null!=n&&""!==n&&(r.Type=n),r.Title=null==t?"":String(t),r.PrivacyStatus=o||"Public",r.DefaultSnapshotType="snapshot",r.ParticipantIds=null,r.Resources=[{data:i,extension:"",resourceType:"PgcV1"}],Co(r)}function $o(e){const t=e instanceof Uint8Array?e:new Uint8Array(e);let n="";for(let e=0;e<t.length;e+=32768){const o=Math.min(e+32768,t.length);n+=String.fromCharCode.apply(null,t.subarray(e,o))}return btoa(n)}async function Bo(e){const t=ho.encode("WaENqVS5ziQSAVEUtvXU5qzgDzS/d0DdQZK5V6U7kL8="),n=await crypto.subtle.importKey("raw",t,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),o=e instanceof Uint8Array?e:new Uint8Array(e),i=await crypto.subtle.sign("HMAC",n,o);return"5"+$o(new Uint8Array(i))}function zo(e,t){return(e.resources??[]).find(e=>e.type===t)?.id??null}async function To(){const e=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetAllRelationships($profileId: String!, $gameId: String!){ relationships(profileId: $profileId) { nodes { profileId labels(gameId: $gameId) } } requestsIn(profileId: $profileId) { nodes { profileId } } requestsOut(profileId: $profileId) { nodes { profileId } } blocked(profileId: $profileId) { nodes { profileId } } labelRequestsIn(profileId: $profileId, gameId: $gameId) { nodes { profileId label } } labelRequestsOut(profileId: $profileId, gameId: $gameId) { nodes { profileId label } } }",variables:{profileId:ce.profileId,gameId:x}})});if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.json();return(t?.data?.requestsIn?.nodes??[]).map(e=>e.profileId)}async function Lo(e,t=200){try{const n=await fo(`/gamemessaging/v1/participants/${ce.profileId}/conversations?page=${e}&pageSize=${t}`);return Array.isArray(n)?n:n?.conversations||[]}catch{return[]}}async function PoAll(){const out=[],seen=new Set();const push=c=>{const id=c&&(c.conversationId||c.ConversationId||c.id)||("string"==typeof c?c:null);if(!id||seen.has(String(id)))return;seen.add(String(id));out.push("string"==typeof c?{conversationId:c,muted:!1,numberOfUnreadMessages:1}:{conversationId:id,muted:c.muted??c.isMuted??!1,numberOfUnreadMessages:Number(c.numberOfUnreadMessages??c.NumberOfUnreadMessages??c.numUnread??c.unreadCount??1)||1})};const ingest=u=>{if(!u)return;if(Array.isArray(u))return void u.forEach(push);if("object"!=typeof u)return;for(const k of["conversations","items","unreadConversations","UnreadConversations","results","data"]){const v=u[k];Array.isArray(v)?v.forEach(push):v&&"object"==typeof v&&!Array.isArray(v)&&ingest(v)}if(Array.isArray(u.conversationIds))u.conversationIds.forEach(push);for(const[k,v]of Object.entries(u)){if(["conversations","items","unreadConversations","UnreadConversations","results","data","conversationIds","total","count","totalUnread","TotalUnread","page","pageSize"].includes(k))continue;if("number"==typeof v&&v>0)push({conversationId:k,numberOfUnreadMessages:v});else if(v&&"object"==typeof v)push(v)}};const paths=[`/gamemessaging/v1/profiles/${ce.profileId}/conversations/unread`];for(const p of paths){try{ingest(await so(p))}catch{}try{ingest(await fo(p))}catch{}}for(let page=1;page<=20;page++){const batch=await Lo(page,50);if(!batch.length)break;for(const c of batch){const unread=Number(c?.numberOfUnreadMessages??c?.NumberOfUnreadMessages??c?.numUnread??c?.unreadCount??0)||0;const flag=!!(c?.unread||c?.hasUnread||c?.HasUnread);if(unread>0||flag)push(c)}if(batch.length<50)break}try{const gr=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetAllRelationships($profileId: String!, $gameId: String!){ blocked(profileId: $profileId) { nodes { profileId } } }",variables:{profileId:ce.profileId,gameId:x}})});if(gr.ok){const gj=await gr.json();const blocked=(gj?.data?.blocked?.nodes??[]).map(e=>e.profileId).filter(Boolean);let __bi=0;for(const bid of blocked){if(++__bi>120||seen.size>250)break;await dn(.03,.07);let conv=null;try{conv=await fo(`/gamemessaging/v1/profiles/${ce.profileId}/conversations/profiles/${bid}`)}catch{}if(!conv)try{conv=await so(`/gamemessaging/v1/profiles/${ce.profileId}/conversations/profiles/${bid}`)}catch{}if(!conv)continue;const unread=Number(conv.numberOfUnreadMessages??conv.NumberOfUnreadMessages??conv.numUnread??conv.unreadCount??0)||0;const flag=!!(conv.unread||conv.hasUnread);if(unread>0||flag)push(conv);else if(conv.conversationId||conv.id){const id=conv.conversationId||conv.id;if(!seen.has(String(id))){/* blocked thread may omit unread flags — still clear badge */push({conversationId:id,muted:conv.muted??!1,numberOfUnreadMessages:1})}}}}}catch{}return out}async function Po(e=200){return(await Lo(1,Math.min(Math.max(e,1),200))).filter(e=>function(e){return Number(e?.numberOfUnreadMessages??e?.NumberOfUnreadMessages??e?.numUnread??e?.NumUnread??e?.unreadCount??e?.UnreadCount??0)||0}(e)>0)}async function Mo(e){return!!e.conversationId&&(await mo(`/gamemessaging/v1/conversations/${e.conversationId}/participants/${ce.profileId}`,{numUnread:0,isMuted:e.muted??!1}),!0)}async function Ao(e){return!!e.conversationId&&(await mo(`/gamemessaging/v1/conversations/${e.conversationId}/participants/${ce.profileId}`,{numUnread:0,isMuted:!0}),!0)}async function Eo(e){const t=e?.conversationId||e?.ConversationId||e?.id;return!(!t||!ce.profileId)&&(await go(`/gamemessaging/v1/conversations/${encodeURIComponent(t)}/participants/${encodeURIComponent(ce.profileId)}`),!0)}async function Do(){return so(`/profileattributes/v1/profiles/${ce.profileId}/games/${x}/attributes`)}async function jo(e){return lo(`/profileattributes/v1/profiles/${ce.profileId}/games/${x}/attributes`,e)}function Fo(){return!!ce.accessToken||(cd("Oturum yok \u2014 once oyuna giris yap","error"),!1)}async function _o(e,t){if(ce.ops[e].loading=!0,ld(),"outfitCopy"===e)try{nd?.()}catch{}try{await t()}finally{if(ce.ops[e].loading=!1,ld(),"outfitCopy"===e)try{nd?.()}catch{}}}async function Ro(){Fo()&&await _o("gender",async()=>{await dn(1,2);const e=await Do();await dn(.4,.9);const t="girl"===e.additionalData?.Gender?.toLowerCase()?"Boy":"Girl";await jo({...e,additionalData:{...e.additionalData,Gender:t}}),cd(`Gender \u2192 ${t}`,"success")}).catch(()=>cd("Gender swap failed","error"))}const Oo=200;let Uo=null,No=!1,qo=0,_waydKeepT=null,_waydBusy=!1;function Ho(e){return String(null==e?"":e).trim()||""}function Wo(e){return String(null==e?"":e).replace(/\s+/g," ").trim().slice(0,48)}function Go(){return"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}function Vo(e){qo+=1;Ho(e);return"Ruh hali "+qo}function _md(){return[{mood:"mood_cool_slide_asset",name:"Cool Slide",group:"soft"},{mood:"mood_bambislide_asset",name:"Like Bambi",group:"soft"},{mood:"mood_noshoes_skating_asset",name:"No Shoes Skating",group:"soft"},{mood:"mood_bunny_hold_asset",name:"Bunny Hold",group:"soft"},{mood:"mood_straw_2023_bunnyjump_dg_asset",name:"Bunny Jump",group:"soft"},{mood:"mood_swim_new_asset",name:"Swim",group:"soft"},{mood:"mood_2023_spidercrawl_lsz_asset",name:"Spider Crawl",group:"soft"},{mood:"mood_2023_bended_lz_asset",name:"Bended",group:"soft"},{mood:"mood_spicyaftershave_asset",name:"Spicy Aftershave",group:"soft"},{mood:"mood_iceskate_ballerina_asset",name:"Ice Skate Ballerina",group:"soft"},{mood:"mood_im_in_love_asset",name:"In Love",group:"soft"},{mood:"mood_xmas_2022_frosty_dg_asset",name:"Frosty (Xmas)",group:"soft"},{mood:"mood_2022_easter_sackjump_dg_asset",name:"Sacking Behind",group:"soft"},{mood:"mood_2022_turkeywalk_lsz_asset",name:"Like a Turkey",group:"soft"},{mood:"mood_xmas_2022_freezing_lsz_asset",name:"Freezing",group:"soft"},{mood:"mood_bad_2022_teenwalk_dg_asset",name:"My World",group:"soft"},{mood:"mood_very_2022_froglike_lsz_asset",name:"Like a Frog",group:"soft"},{mood:"mood_xmas_2022_magicfloat_lsz_asset",name:"Magic Float",group:"soft"},{mood:"mood_very_2022_onhands_lsz_asset",name:"On Hands",group:"soft"},{mood:"mood_slippery_asset",name:"Slippery",group:"soft"},{mood:"mood_food1_hold__asset",name:"Food Hold 1",group:"soft"},{mood:"mood_food2_hold__asset",name:"Food Hold 2",group:"soft"},{mood:"mood_food3_hold__asset",name:"Food Hold 3",group:"soft"},{mood:"mood_egg_hold_asset",name:"Egg Hold",group:"soft"},{mood:"mood_holmes_2023_fighting_lsz_asset",name:"Ready to Fight!",group:"soft"},{mood:"mood_angry_asset",name:"Angry",group:"normal"},{mood:"mood_2023_asleep_lsz_asset",name:"Asleep",group:"normal"},{mood:"mood_cinna_2025_windwithleaves_lsz_asset",name:"Autumn Wind",group:"normal"},{mood:"mood_cinna_2025_wind_lsz_asset",name:"Cold Wind",group:"normal"},{mood:"mood_dress_2023_complaining_dg_asset",name:"Complaining",group:"normal"},{mood:"mood_depressed_emowalk_asset",name:"Depressed",group:"normal"},{mood:"mood_eyesnotworking_asset",name:"Eyes Not Working",group:"normal"},{mood:"mood_frog_2022_scared_lsz_asset",name:"Frightened",group:"normal"},{mood:"mood_frosty_walk_asset",name:"Frosty Walk",group:"normal"},{mood:"mood_superhappy_asset",name:"Happy",group:"normal"},{mood:"mood_joy_2024_inthesnow_lsz_asset",name:"In The Snow",group:"normal"},{mood:"mood_all_2024_sillypose_dg_asset",name:"Just Silly",group:"normal"},{mood:"mood_default_asset",name:"Neutral",group:"normal"},{mood:"mood_basic_2024_strut_lsz_asset",name:"Oh Sassy",group:"normal"},{mood:"mood_left_2025_shywalkanim_lsz_asset",name:"Please Don't Look at Me",group:"normal"},{mood:"mood_picnic_2024_princess_lsz_asset",name:"Princess Mood",group:"normal"},{mood:"mood_2025_rainycloud_lsz_asset",name:"Rainy Days",group:"normal"},{mood:"mood_raptor_asset",name:"Raptor",group:"normal"},{mood:"mood_rare_2024_dance7_dg_asset",name:"Ready to Fight (Dance)",group:"normal"},{mood:"mood_relaxed_asset",name:"Relaxed",group:"normal"},{mood:"mood_supersad_asset",name:"Sad",group:"normal"},{mood:"mood_cinna_2025_rainshield_dg_asset",name:"Shielded from Rain",group:"normal"},{mood:"mood_sleepy_asset",name:"Sleepy",group:"normal"},{mood:"mood_so_in_love_asset",name:"So In Love",group:"normal"},{mood:"mood_holmes_2023_waltz_lsz_asset",name:"Solitude Waltz",group:"normal"},{mood:"mood_crim_2024_spideranim_lsz_asset",name:"Spider Hybrid",group:"normal"},{mood:"mood_run_asset",name:"Sporty",group:"normal"},{mood:"mood_eparty_2022_walking_tired_dg_asset",name:"Tired",group:"normal"},{mood:"mood_9to5_2024_ceo_dg_asset",name:"Walk and Work",group:"normal"},{mood:"mood_bon_2025_cutewalk_dg_asset",name:"Walk Like a Cutie",group:"normal"},{mood:"mood_bad_2022_teenwalknogum_lsz_asset",name:"Certain",group:"normal"},{mood:"mood_comfidance_asset",name:"Confidance",group:"normal"},{mood:"mood_xmas_2024_snowboarding_lsz_asset",name:"Cool as Snow",group:"normal"},{mood:"mood_tiki_2024_wormanim_lsz_asset",name:"Do The Worm!",group:"normal"},{mood:"mood_9to5_2024_strong_dg_asset",name:"Flexing My Muscles",group:"normal"},{mood:"mood_summer_2026_floatie_lsz_asset",name:"Floatie Vibes",group:"normal"},{mood:"mood_hiphop_asset",name:"Hip Hop",group:"normal"},{mood:"mood_starlit_2025_moonpose_dg_asset",name:"Moon Fall",group:"normal"},{mood:"mood_notimpressed_asset",name:"Not Impressed",group:"normal"},{mood:"mood_dream_2024_onthemoon_lsz_asset",name:"On The Moon",group:"normal"},{mood:"mood_proud_asset",name:"Proud",group:"normal"},{mood:"mood_2024_snowballroll_lsz_asset",name:"Rolling in the Snow",group:"normal"},{mood:"mood_runaway_asset",name:"Runway",group:"normal"},{mood:"mood_badd_2025_skateboardanim_lsz_asset",name:"Skateboarding",group:"normal"},{mood:"mood_xmas_2024_skiing_lsz_asset",name:"Skiing Away",group:"normal"},{mood:"mood_lofi_2023_voguing_dg_asset",name:"Strike a Pose",group:"normal"},{mood:"mood_catch_2025_backwalk_lsz_asset",name:"Turn Around?",group:"normal"},{mood:"mood_easter_2025_balloonflight_lsz_asset",name:"Up, Up, Away!",group:"normal"},{mood:"mood_shinobi_asset",name:"Anime",group:"normal"},{mood:"mood_bigcity_2025_stomping_lsz_asset",name:"Asphalt Crush",group:"normal"},{mood:"mood_ballerina_asset",name:"Ballerina",group:"normal"},{mood:"mood_easter_2025_carouselhorse_lsz_asset",name:"Carousel Horse",group:"normal"},{mood:"mood_vibe_2022_catwalk_lsz_asset",name:"Cat Walk",group:"normal"},{mood:"mood_shock_2023_crabwalk_dg_asset",name:"Crab Walk",group:"normal"},{mood:"mood_haunt_2024_nurse_lsz_asset",name:"Creepy",group:"normal"},{mood:"mood_vibe_2022_duckwalk_lsz_asset",name:"Duck Walk",group:"normal"},{mood:"mood_flikflak_asset",name:"Flik Flak",group:"normal"},{mood:"mood_yule_2024_inthemist_lsz_asset",name:"Floating Above All",group:"normal"},{mood:"mood_alls_2026_frontwalkover_lsz_asset",name:"Front Walkover",group:"normal"},{mood:"mood_easter_2025_rabbitjump_dg_asset",name:"Hop Hop!",group:"normal"},{mood:"mood_calico_2026_catmood_lsz_asset",name:"Kitty Walk",group:"normal"},{mood:"mood_monster_2023_monstervibe_dg_asset",name:"Monster Vibe",group:"normal"},{mood:"mood_easygoing_asset",name:"One with Nature",group:"normal"},{mood:"mood_lofi_2023_wavyarms_dg_asset",name:"Ragdoll",group:"normal"},{mood:"mood_ghost_2022_sick_lsz_asset",name:"Sick",group:"normal"},{mood:"mood_trick_2022_evil_lsz_asset",name:"Sinister",group:"normal"},{mood:"mood_flower_2022_sleepwalk_lsz_asset",name:"Sleep Walk",group:"normal"},{mood:"mood_sneaking_off_asset",name:"Sneaking Off",group:"normal"},{mood:"mood_english_2025_glitter_lsz_asset",name:"Sparkle Charm",group:"normal"},{mood:"mood_2024_abouttoblowup_lsz_asset",name:"Stormy",group:"normal"},{mood:"mood_xmas_2025_crazyskiing_ls_asset",name:"Struggling a Bit",group:"normal"},{mood:"mood_terrified_asset",name:"Terrified",group:"normal"},{mood:"mood_ballet_2024_balletpose2_dg_asset",name:"Tippy Toes",group:"normal"},{mood:"mood_sea_2023_swim_lsz_asset",name:"A bit Fishy",group:"normal"},{mood:"mood_pink_2023_dollmoves_dg_asset",name:"Activate Doll",group:"normal"},{mood:"mood_ice_2023_airswim_dg_asset",name:"Air Swimming",group:"normal"},{mood:"mood_english_2025_broomanim_lsz_asset",name:"Bewitched Blossom",group:"normal"},{mood:"mood_soft_2026_buttonrunover_lsz_asset",name:"Button Run Over",group:"normal"},{mood:"mood_velvet_2025_dragonfly_lsz_asset",name:"Dragonfly",group:"normal"},{mood:"mood_encha_2024_regularflying_lsz_asset",name:"Floating",group:"normal"},{mood:"mood_fruitty_2024_strawberryflying_lsz_asset",name:"Floating Berry",group:"normal"},{mood:"mood_easter_2025_flowerbroomanim_lsz_asset",name:"Flower Broom",group:"normal"},{mood:"mood_easter_2024_flowersteps_dg_asset",name:"Flower Steps",group:"normal"},{mood:"mood_ghostly_flying_asset",name:"Ghost",group:"normal"},{mood:"mood_snow_2024_smowflakefloatanim_lsz_asset",name:"Giant Snowflake",group:"normal"},{mood:"mood_sailormoon_heroic_asset",name:"Heroic",group:"normal"},{mood:"mood_ufo_2024_alienship_lsz_asset",name:"In the UFO",group:"normal"},{mood:"mood_fursona_2025_quadrun_tk_asset",name:"Instinct Run",group:"normal"},{mood:"mood_spice_2022_relaxedfloat_lsz_asset",name:"Just Floatin' Here",group:"normal"},{mood:"mood_summer_2025_cabinbag_lsz_asset",name:"Let's Go On Vacation!",group:"normal"},{mood:"mood_2025_loveclouds_lsz_asset",name:"LoveCloud",group:"normal"},{mood:"mood_valentines_2026_floatingheart_lsz_asset",name:"Me & My Heart",group:"normal"},{mood:"mood_that_2024_moneyrain_lsz_asset",name:"Money Rain",group:"normal"},{mood:"mood_shimm_2024_fireworkswalk_lsz_asset",name:"My Background",group:"normal"},{mood:"mood_blood_2025_demonanim_lsz_asset",name:"Ooze",group:"normal"},{mood:"mood_basic_2024_rainbowflying_lsz_asset",name:"Over the Rainbow",group:"normal"},{mood:"mood_fuzz_2025_pillowanim_lsz_asset",name:"Pillow Float",group:"normal"},{mood:"mood_stranger_2022_float_lsz_asset",name:"Posessed",group:"normal"},{mood:"mood_halloween_2025_redmoon_lsz_asset",name:"Red Moon Float",group:"normal"},{mood:"mood_head_2026_cloudsleep_lsz_asset",name:"Sleep In Clouds",group:"normal"},{mood:"mood_oph_2024_beingsnake_lsz_asset",name:"Slithering Away",group:"normal"},{mood:"mood_flor_2022_slowmo_lsz_asset",name:"Slowmo",group:"normal"},{mood:"mood_xmas_2025_snowball_lsz_asset",name:"Snowball Accident",group:"normal"},{mood:"mood_default_sparkle_2025_lsz_asset",name:"Sparkles Around Me",group:"normal"},{mood:"mood_summer_2026_steringwheelbalance_lsz_asset",name:"Steeringwheel Balance",group:"normal"},{mood:"mood_candy_2022_superspeed_lsz_asset",name:"Superspeed",group:"normal"},{mood:"mood_bday_2025_bigcake_lsz_asset",name:"Surprise!",group:"normal"},{mood:"mood_silly_2024_upsidedownflying_lsz_asset",name:"Upside Down",group:"normal"},{mood:"mood_ruby_2025_diganim_lsz_asset",name:"What's up Doc?",group:"normal"},{mood:"mood_spark_2025_runtreerun_lsz_asset",name:"Why R U Running?",group:"normal"},{mood:"mood_fursona_2025_quadwalk_tk_asset",name:"Wild Walk",group:"normal"},{mood:"mood_2025_xmas_floatingwreath_tk_asset",name:"Wreath Magic",group:"normal"},{mood:"mood_zombiewalk_asset",name:"Zombie",group:"normal"}]}const SEED_VER="v51";function Ko(){let e=q(_.moodsSaved);if(SEED_VER!==q("msv")){try{if("1"!==q("msc")){const _d=_md()||[];if(_d.length)e=Jo(_d)}}catch{}try{H("msv",SEED_VER)}catch{}}if(!Array.isArray(e)||!e.length){if("1"!==q("msc")){try{const t=_md();if(t&&t.length){e=Jo(t)}}catch{}}}if(!Array.isArray(e)||!e.length)return[];const t=[],n=new Set;for(const o of e){let e="",i="",r="",a=0;if("string"==typeof o?(e=Ho(o),i=Vo(e),r=Go(),a=Date.now()):o&&"object"==typeof o&&(e=Ho(o.mood??o.m??o.value??""),i=Wo(o.name??o.n??"")||Vo(e),r=String(o.id||o.i||Go()),a=Number(o.ts)||Date.now()),e&&!n.has(e)&&(n.add(e),t.push({id:r,mood:e,name:i,ts:a}),t.length>=Oo))break}if(e.length&&"string"==typeof e[0])try{Jo(t)}catch{}return t}function Jo(e){const t=[],n=new Set;for(const o of e||[]){if(!o)continue;const e=Ho(o.mood);if(e&&!n.has(e)&&(n.add(e),t.push({id:String(o.id||Go()),mood:e,name:Wo(o.name)||Vo(e),ts:Number(o.ts)||Date.now()}),t.length>=Oo))break}return H(_.moodsSaved,t),t}function Yo(){try{return String(ce.profileId||"").trim()}catch{return""}}function Qo(){try{const e=q(_.moodByProfile);if(e&&"object"==typeof e&&!Array.isArray(e))return{...e}}catch{}return{}}function Xo(e){try{H(_.moodByProfile,e&&"object"==typeof e?e:{})}catch{}}function Zo(){const e=Yo();if(!e)return"";const t=Qo()[e];return t&&!1!==t.on&&t.mood?Ho(t.mood):""}function ei(){return Zo()||Ho(q(_.moodLast))}function ti(){return!!Zo()}function QoW(){try{const e=q(_.waydByProfile);if(e&&"object"==typeof e&&!Array.isArray(e))return{...e}}catch{}return{}}function XoW(e){try{H(_.waydByProfile,e&&"object"==typeof e?e:{})}catch{}}function ZoW(){const e=Yo();if(!e)return"";const t=QoW()[e];return t&&!1!==t.on&&t.wayd?String(t.wayd):""}function tiW(){return!!ZoW()}function waydTextLock(){const e=Yo();if(!e)return"";const t=QoW()[e];return t&&!1!==t.on&&t.text!=null?String(t.text):""}function lockWayd(id,text){try{const p=Yo();if(!p)return;const m=QoW();m[p]={wayd:String(id||""),text:String(text||""),on:!0,ts:Date.now()};XoW(m);ce.appliedWayd=String(id||"");ce.appliedWaydText=String(text||"");try{setTimeout(()=>{forceWaydKeep({silent:!0}).catch(()=>{})},50)}catch{}}catch{}}function clearWaydLock(){try{const p=Yo();if(p){const m=QoW();if(m[p]){m[p].on=!1;XoW(m)}}ce.appliedWayd=null;ce.appliedWaydText=null}catch{}}function uiWayd(){if(!tiW()){ce.appliedWayd=null;return}const wid=ZoW();if(!wid){ce.appliedWayd=null;return}ce.appliedWayd=wid;ce.appliedWaydText=waydTextLock()||ce.appliedWaydText;if(_waydKeepT)try{clearTimeout(_waydKeepT)}catch{}_waydKeepT=setTimeout(()=>{_waydKeepT=null;forceWaydKeep({silent:!0}).finally(()=>{try{uiWayd()}catch{}})},Ic?3e3:12e2)}function pulseWaydVisual(wid,text){try{const id=String(wid||ZoW()||ce.appliedWayd||"");if(!id)return!1;const sock=ce.chatroomSocket;if(!sock||1!==sock.readyState)return!1;const p=ce.lastRoomPosition&&ce.lastRoomPosition.position;if(!p)return!1;const n=Number(p.x),o=Number(p.y),i=Number(p.z);if(!Number.isFinite(n)||!Number.isFinite(o)||!Number.isFinite(i))return!1;const mood=ce.appliedMood||"default";const payload={position:{x:n,y:o,z:i},mood:mood,direction:2,modifiers:[],WAYD:id,wayd:id,Wayd:id};try{sock.send("42"+JSON.stringify(["7001",payload]))}catch{}return!0}catch{return!1}}function nudgeWaydPresence(jitter){const sendOnce=(jit)=>{try{const t=ce.chatroomSocket;if(!t||1!==t.readyState)return!1;const p=ce.lastRoomPosition&&ce.lastRoomPosition.position;if(!p)return!1;let n=Number(p.x),o=Number(p.y),i=Number(p.z);if(!Number.isFinite(n)||!Number.isFinite(o)||!Number.isFinite(i))return!1;if(jit){n+=Math.random()>.5?.045:-.045;i+=Math.random()>.5?.045:-.045}const wid=ZoW()||String(ce.appliedWayd||"");if(!wid)return!1;const r=ce.appliedMood||"default";const a={position:{x:n,y:o,z:i},mood:r,direction:2,modifiers:[],WAYD:wid,wayd:wid,Wayd:wid};t.send("42"+JSON.stringify(["7001",a]));try{ce.lastRoomPosition.position={x:n,y:o,z:i}}catch{}return!0}catch{return!1}};const ok=sendOnce(!!jitter);if(jitter){try{setTimeout(()=>sendOnce(!0),90);setTimeout(()=>sendOnce(!0),220);setTimeout(()=>sendOnce(!1),420)}catch{}}return ok}async function forceWaydKeep(opt){if(!tiW())return ce.appliedWayd=null,!1;const silent=!(!opt||!opt.silent),wid=ZoW()||String(ce.appliedWayd||"");if(!wid||!ce.accessToken)return!1;if(_waydBusy)return!1;_waydBusy=!0;try{ce.appliedWayd=wid;const attrs=await Do();const cur=String(attrs&&attrs.additionalData&&(attrs.additionalData.WAYD||attrs.additionalData.Wayd||attrs.additionalData.wayd)||"");if(cur===wid)return!0;const add={...(attrs&&attrs.additionalData||{}),WAYD:wid};let body={...attrs,additionalData:add};if(body.avatarId==null||body.avatarId==="")body.avatarId=attrs&&attrs.avatarId||"";await jo(body);try{const check=await Do();const now=String(check&&check.additionalData&&(check.additionalData.WAYD||check.additionalData.Wayd||check.additionalData.wayd)||"");if(now!==wid)await jo({avatarId:(check&&check.avatarId)||(attrs&&attrs.avatarId)||"",additionalData:{...(check&&check.additionalData||attrs&&attrs.additionalData||{}),WAYD:wid}})}catch{}ce.appliedWayd=wid;if(!silent)cd("Durum korundu (geri getirilen)","success");return!0}catch(err){return!1}finally{_waydBusy=!1}}function ni(){try{if(ti()){const e=Zo();ce.appliedMood=e||null,e&&ce.accessToken&&ui()}else if(ce.appliedMood=null,Uo){try{clearTimeout(Uo)}catch{}Uo=null}try{ci?.()}catch{}try{li(ei())}catch{}}catch{}}function oi(e){const t=Ho(e);return Ko().find(e=>e.mood===t)||null}function ii(e,t){const n=Ho(e);if(!n)return!1;!function(e){const t=Ho(e);if(!t)return t;try{H(_.moodLast,t)}catch{}const n=Yo();if(n){const e=Qo();e[n]={mood:t,on:!0,ts:Date.now()},Xo(e)}}(n),ce.appliedMood=n,function(e){try{e&&H(_.lastAction,String(e))}catch{}}("mood");const o=Ko(),i=o.findIndex(e=>e.mood===n);let r,a=!1;i>=0?(r=o[i],o.splice(i,1),null!=t&&Wo(t)&&(r.name=Wo(t)),r.ts=Date.now()):(a=!0,r={id:Go(),mood:n,name:Wo(t)||Vo(n),ts:Date.now()}),o.unshift(r),Jo(o);try{li(n)}catch{}try{pi()}catch{}try{ci?.()}catch{}return a}function ri(e,t){const n=Wo(t);if(!n)return!1;const o=Ko(),i=o.find(t=>t.id===String(e));if(!i)return!1;i.name=n,Jo(o);try{li(i.mood)}catch{}try{pi()}catch{}return!0}function ai(e){const t=String(e||""),n=Ko(),o=n.filter(e=>e.id!==t);if(o.length===n.length)return!1;Jo(o);if(!o.length)try{H("msc","1")}catch{}try{li(Zo())}catch{}try{pi()}catch{}return!0}function si(e){const t=Ko(),n=[["",t.length?"Ruh hali se\xe7\u2026":"Hen\xfcz kay\u0131t yok \u2014 odada ayna ile kopyala"]];for(const e of t){const t=e.name||e.mood;n.push([e.mood,t])}const o=Ho(e);if(o&&!t.some(e=>e.mood===o)){const e=oi(o);n.push([o,e?.name||o])}return n}function li(e){if(!Cc)return;const t=Cc.querySelector(`#${A.mood}`);if(!t)return;const n=Ho(e)||Ho(t.value)||ei(),o=si(n);t.textContent="";for(const[e,n]of o){const o=document.createElement("option");o.value=e,o.textContent=n;try{o.style.background=Zs.sur}catch{}t.appendChild(o)}n&&[...t.options].some(e=>e.value===n)?t.value=n:t.value=""}function ci(){const e=Pc.moodLockStatus;if(!e)return;e.textContent="";const t=Zo(),n=Yo(),o=al("div",{fontSize:"10px",color:Zs.sub,lineHeight:"1.4",marginBottom:"6px",fontFamily:Zs.sans});if(!n)return o.textContent="Hesap bekleniyor\u2026 Panelden ruh hali se\xe7ince sadece o hesaba kal\u0131c\u0131 olur.",void e.appendChild(o);if(t){const n=oi(t);o.innerHTML="",o.style.color=Zs.acc||Zs.txt,o.style.padding="8px 10px",o.style.borderRadius="8px",o.style.background="rgba(167,139,250,.08)",o.style.border=`1px solid ${Zs.accBdr||"rgba(167,139,250,.25)"}`,o.textContent=re("mood_perm_label",{name:n?.name||t.slice(0,40)}),e.appendChild(o);const i=al("button",{display:"inline-block",marginTop:"2px",marginBottom:"6px",padding:"4px 8px",fontSize:"10px",fontFamily:Zs.sans,fontWeight:"600",color:Zs.err||"#f87171",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"5px",cursor:"pointer",outline:"none"});i.type="button",i.textContent=re("mood_perm_clear"),i.title="Sadece bu hesap zorlanmaz; di\u011fer hesaplara dokunulmaz",i.addEventListener("click",e=>{e.stopImmediatePropagation(),function(e){const t=Yo();if(!e){if(t){const e=Qo();e[t]&&(delete e[t],Xo(e))}if(ce.appliedMood=null,Uo){try{clearTimeout(Uo)}catch{}Uo=null}try{ci?.()}catch{}try{li(ei())}catch{}try{pi()}catch{}return!1}const n=Zo()||Ho(q(_.moodLast));if(!n||!t)return!1;const o=Qo();o[t]={mood:n,on:!0,ts:Date.now()},Xo(o),ce.appliedMood=n;try{ui()}catch{}try{ci?.()}catch{}}(!1),cd(re("mood_cleared_toast"),"info")}),e.appendChild(i)}else o.textContent=re("mood_none_local"),e.appendChild(o)}function di(e,t){const n=Ho(e),o="number"==typeof t?t:28;return n.length<=o?n:n.slice(0,Math.max(8,o-1))+"\u2026"}function pi(){const e=Pc.moodList;if(!e)return;e.textContent="";const t=Ko(),n=Zo();if(!t.length){const t=al("div",{fontSize:"11px",color:Zs.muted,padding:"8px 6px",textAlign:"center",fontFamily:Zs.sans});return t.textContent="Kay\u0131t yok. Odada ayna ile kopyala.",void e.appendChild(t)}for(const o of t){const t=n&&o.mood===n,i=al("div",{display:"flex",alignItems:"center",gap:"6px",padding:"6px 7px",marginBottom:"5px",background:t&&Zs.accDim||Zs.sur,border:`1px solid ${t&&Zs.acc||Zs.bdrSub}`,borderRadius:"6px",boxSizing:"border-box",boxShadow:t?`0 0 10px ${Zs.accGlow||"rgba(129,140,248,0.35)"}`:"none"}),r=al("div",{flex:"1",minWidth:"0",display:"flex",flexDirection:"column",gap:"2px",cursor:"pointer"}),a=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});a.textContent=(t?"\u25cf ":"")+(o.name||"\u0130simsiz"),a.title=o.name||"";const s=al("div",{fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});s.textContent=di(o.mood,42),s.title=o.mood,r.appendChild(a),r.appendChild(s),r.addEventListener("click",()=>{try{const e=Cc.querySelector(`#${A.mood}`);e&&(e.value=o.mood)}catch{}fi(o.mood)}),r.title="Uygula: "+(o.name||o.mood);const l=al("button",{flexShrink:"0",padding:"3px 7px",fontSize:"10px",fontFamily:Zs.sans,fontWeight:"600",color:Zs.acc,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",cursor:"pointer",outline:"none"});l.type="button",l.textContent="Ad",l.title="Yeniden adland\u0131r",l.addEventListener("click",e=>{e.stopImmediatePropagation();const t=window.prompt("Ruh hali ad\u0131:",o.name||"");if(null==t)return;const n=ri(o.id,t);cd(n?`Ad g\xfcncellendi: ${Wo(t)}`:"Ad g\xfcncellenemedi",n?"success":"error")});const c=al("button",{flexShrink:"0",padding:"3px 7px",fontSize:"10px",fontFamily:Zs.sans,fontWeight:"600",color:Zs.err||"#f87171",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",borderRadius:"4px",cursor:"pointer",outline:"none"});c.type="button",c.textContent="Sil",c.title="K\xfct\xfcphaneden sil",c.addEventListener("click",e=>{e.stopImmediatePropagation();const t=ai(o.id);cd(t?`Silindi: ${o.name||o.mood}`:"Silinemedi",t?"info":"error")}),i.appendChild(r),i.appendChild(l),i.appendChild(c),e.appendChild(i)}}function ui(){if(!ti())return void(ce.appliedMood=null);const e=Zo();if(e){if(ce.appliedMood=e,Uo)try{clearTimeout(Uo)}catch{}Uo=setTimeout(()=>{Uo=null;if(Ic){try{ti()&&(Uo=setTimeout(()=>{Uo=null;try{ui()}catch{}},30e3))}catch{}return}ti()?async function(e){if(!ti())return ce.appliedMood=null,!1;const t=!(!e||!e.silent),n=Zo()||Ho(ce.appliedMood);if(!n)return!1;if(!ce.accessToken)return!1;if(No)return!1;No=!0;try{ce.appliedMood=n,await dn(.6,1.2);const e=await Do();if(Ho(e?.additionalData?.Mood??e?.additionalData?.mood)===n)return t||cd("Ruh hali zaten ayarli","info"),!0;if(await dn(.3,.6),await jo({...e,additionalData:{...e.additionalData||{},Mood:n}}),ce.appliedMood=n,!t){const ee=oi(n);cd("Ruh hali korundu (bu hesap) -> "+(ee&&ee.name||"kayit"),"success")}return!0}catch(e){return t||cd("Ruh hali geri y\xfcklenemedi","error"),un?.(`[mood] reapply fail: ${e&&e.message?e.message:e}`),!1}finally{No=!1}}({silent:!0}).catch(()=>{}).finally(()=>{try{!Ic&&ti()&&ui()}catch{}}):ce.appliedMood=null},Ic?30e3:20e3)}}try{if(ti()){const e=Zo();e&&(ce.appliedMood=e)}else ce.appliedMood=null}catch{}try{if(tiW()){const e=ZoW();e&&(ce.appliedWayd=e,ce.appliedWaydText=waydTextLock()||null);try{uiWayd()}catch{}}else{ce.appliedWayd=null;ce.appliedWaydText=null}}catch{}async function fi(e,t){const skipLib=!(!t||!t.skipLibrary),n=Ho(e??Cc.querySelector("#"+A.mood)?.value);n?Fo()&&await _o("mood",async()=>{await dn(1,2);const e=await Do();await dn(.4,.9),await jo({...e,additionalData:{...e.additionalData,Mood:n}});let o=null,i=!1;if(skipLib){if(t&&t.permanent){try{const _m=n;try{H(_.moodLast,_m)}catch{}const _p=Yo();if(_p){const _map=Qo();_map[_p]={mood:_m,on:!0,ts:Date.now()},Xo(_map)}ce.appliedMood=_m;try{ui()}catch{}try{ci?.()}catch{}}catch{ce.appliedMood=n}}else{try{ce.appliedMood=null}catch{}}o=oi(n)}else{i=ii(n),o=oi(n)}const r=o?.name||"Ruh hali";cd(skipLib?(t&&t.permanent?r+" uygulandı · kalıcı (seçili ruh hali değişmedi). Mağaza/oda değiştir.":r+" uygulandı · anlık. Mağaza/oda değiştir."):i?r+" uygulandı · bu hesaba kalıcı. Mağaza/oda değiştir.":r+" uygulandı · kalıcı. Mağaza/oda değiştir.","success")}).catch(()=>cd("Ruh hali değiştirilemedi","error")):cd("Önce ruh hali seç","error")}async function mi(){const e=Cc.querySelector(`#${A.status}`),t=e?.value?.trim();if(t){if(Fo()){try{H(_.statusDraft,t)}catch{}try{H(_.lastAction,"status")}catch{}await _o("status",async()=>{await dn(.3,.6);const n=await Do(),o=n?.additionalData?.WAYD||n?.additionalData?.Wayd||n?.additionalData?.wayd||null;if(!o)throw new Error("Bu hesapta henuz durum (WAYD) yok. Once oyunda profil \u2192 Ne yapiyorsun yazip kaydet.");await dn(.2,.4);const i=await so(`/profilegeneratedcontent/v2/profiles/content/${o}`);if(!i)throw new Error("Durum UGC bulunamadi (WAYD meta)");const r=zo(i,"PgcV1");if(!r)throw new Error("PGC kaynagi yok \u2014 oyunda durumu bir kez kaydet");await dn(.2,.4);const a=await cn(`${w}/${r}`,{method:"GET"});if(!a.ok)throw new Error(`CDN hata HTTP ${a.status}`);const s=c;if(!s)throw new Error("BSON yuklenmedi \u2014 eklentiyi Reload et");const l=new Uint8Array(await a.arrayBuffer()),d=s.deserialize(l,{promoteValues:!1,promoteLongs:!1,promoteBuffers:!1});Array.isArray(d.Texts)&&d.Texts.length>0?d.Texts[0]=t:d.Texts=[t];const p=s.serialize(d),u=(i.title??i.name??"").toString(),f=(i.privacyStatus??i.privacy??"Public").toString(),m=Io(p,u,(i.type??"WAYD").toString(),f),g=await Bo(m),h=encodeURIComponent(ce.profileId),y=`${k}/profilegeneratedcontent/v2/profiles/${h}/games/${x}/content/${o}`,b=await cn(y,{method:"PUT",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/bson",signature:g},body:m});if(!b.ok){const e=await b.text().catch(()=>"");throw new Error(`Yukleme HTTP ${b.status}${e?" \u2014 "+e.replace(/\s+/g," ").slice(0,120):""}`)}try{clearWaydLock()}catch{}cd("Durum guncellendi","success"),e.value=""}).catch(e=>cd(String(e?.message??e??"Durum guncellenemedi"),"error"))}}else cd("Once durum metni yaz","error")}const gi="GetAvatarWithInventoryIds-DD86AE7409A7FB9E28E99DD169579EBB",hi="SetAvatarWithInventoryIds-F0A797E3E4F824F5EBB25AC691E33140",yi="https://cdn.moviestarplanet2.com/";function bi(e){const t=e?.data??e??{},n=[t?.avatar,t?.profiles?.byId?.avatarV2,t?.profiles?.byId?.avatar].filter(Boolean),o=[],i=e=>{const t=String(e??"").trim();t&&o.push(t)};for(const e of n){for(const t of e.inventoryItemIds||[])"string"==typeof t?i(t):t&&"object"==typeof t&&i(t.id);for(const t of e.inventoryItems||e.items||[])"string"==typeof t?i(t):t&&"object"==typeof t&&i(t.id);if(o.length)break}return[...new Set(o)]}async function xi(e){const t=String(e||"").trim();if(!t)return null;const n=/^https?:\/\//i.test(t)?t:yi+t.replace(/^\//,""),o=await cn(n);if(!o.ok)return null;const i=new Uint8Array(await o.arrayBuffer());let r="";for(let e=0;e<i.length;e+=32768)r+=String.fromCharCode(...i.subarray(e,e+32768));return btoa(r)}async function ki(e){const{face:t,full:n}=function(e){const t=e?.data??e??{},n=[t?.avatar,t?.profiles?.byId?.avatarV2,t?.profiles?.byId?.avatar].filter(Boolean);for(const e of n){const t=String(e?.face||"").trim(),n=String(e?.full||"").trim();if(t||n)return{face:t,full:n}}return{face:"",full:""}}(e),o=[],i=await xi(t),r=await xi(n);return i&&o.push({type:"FACE",data:i}),r&&o.push({type:"FULL",data:r}),o}function wi(e){const t=e?.data?.profileInventory?.updateAvatar,n=t&&"object"==typeof t?t:{},o=n.error,i=o&&"object"==typeof o?o:{},r=[].concat(Array.isArray(i.invalidItems)?i.invalidItems:[]).concat(Array.isArray(n.invalidItems)?n.invalidItems:[]).map(e=>"string"==typeof e?e:e?.id).filter(Boolean),a=String(i.reason||i.message||n.message||"").trim();return{success:!0===n.success,upd:n,err:i,invalid:r,reason:a}}async function vi(e,t){const n=[],o=(t||[]).map(String).filter(Boolean);for(let t=0;t<o.length;t+=40){const i=o.slice(t,t+40),r=`${k}/profileinventory/v1/profiles/${encodeURIComponent(e)}/games/${x}/inventory/items/?inventoryIds=${encodeURIComponent(i.join(","))}`,a=await cn(r,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(!a.ok)continue;const s=await a.json().catch(()=>null),l=Array.isArray(s)?s:s?.items||[];for(const e of l)e&&"object"==typeof e&&e.id&&n.push(e)}return n}async function Si(){const e=[`${k}/profileinventory/v1/games/${x}/profiles/${ce.profileId}/inventory/items`,`${k}/profileinventory/v1/profiles/${encodeURIComponent(ce.profileId)}/games/${x}/inventory/items/`];for(const t of e)try{const e=await cn(t,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(!e.ok)continue;const n=await e.json().catch(()=>null),o=Array.isArray(n)?n:n?.items||n?.nodes||n?.data||[];if(Array.isArray(o)&&o.length)return o}catch{}return[]}function Ci(e){if(!e||"object"!=typeof e)return"";const t=e.additionalData||{},n=t.MSP2Data&&"object"==typeof t.MSP2Data?t.MSP2Data:{},o=t.NebulaData&&"object"==typeof t.NebulaData?t.NebulaData:{};let i=String(n.Type||n.type||o.Type||e.type||e.itemType||"").trim();if(!i)for(const t of e.tags||[]){const e=String("string"==typeof t?t:t?.id||"").trim();if(e&&!/^\d+$/.test(e)){i=e;break}}return i.toLowerCase()}function Ii(e){return e&&"object"==typeof e?String(e.itemId||e.objectId||e.lookUpId||"").trim():""}function $i(e){const t=(e||[]).map(String).filter(Boolean);t.length&&H("lo",t)}function Bi(){const e=q("lo");return Array.isArray(e)?e.map(String).filter(Boolean):[]}async function zi(e,t){const n=await po("/federationgateway/graphql",{id:hi,variables:{UpdateAvatarInput:{inventoryItemIds:e,snapshots:t||[]}}});if(Array.isArray(n?.errors)&&n.errors.length)throw new Error(String(n.errors[0]?.message||n.errors[0]||"SetAvatar hata"));return{setRes:n,parsed:wi(n)}}async function Ti(e,t={}){const n=String(e||"").trim();if(!n)return void cd("Hedef profil yok","error");if(!Fo())return;if(n===ce.profileId)return void cd("Kendine kopyalanamaz","info");const o=t.name||ce.chatroomUsers.get(n)?.name||ce.autographer?.targetProfile?.name||"oyuncu",i=!1!==t.likeStatus;if(!t.skipConfirm){if(!window.confirm(`${o}\n\nDurumunu be\u011fen + k\u0131yafetini kopyala?\n\nTamam = loveit + sende olan par\xe7alar giyilir\n(Eksik par\xe7ada kendi k\u0131yafetin kal\u0131r \u2014 \xe7\u0131plak b\u0131rakmaz)`))return}await _o("outfitCopy",async()=>{cd(`K\u0131yafet okunuyor\u2026 (${o})`,"info"),await dn(.3,.6);const e=await po("/federationgateway/graphql",{id:gi,variables:{profileId:n,gameId:x}});if(Array.isArray(e?.errors)&&e.errors.length)throw new Error(String(e.errors[0]?.message||e.errors[0]||"GetAvatar hata"));const t=bi(e);if(!t.length)throw new Error("Hedefte k\u0131yafet ID bulunamad\u0131");const r=await po("/federationgateway/graphql",{id:gi,variables:{profileId:ce.profileId,gameId:x}}),a=bi(r);if(!a.length)throw new Error("Senin kombin ID bulunamad\u0131 \u2014 once oyunda bir k\u0131yafet kaydet");a.length>=10?$i(a):Bi().length||$i(a);let s=!1,l="";if(i)try{await dn(.25,.5);const e=await async function(e){const t=await cn(`${k}/profileattributes/v1/profiles/${e}/games/${x}/attributes`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`}});if(!t.ok)return{liked:!1,reason:`attrs HTTP ${t.status}`};const n=await t.json().catch(()=>null),o=n?.additionalData?.WAYD;if(!o)return{liked:!1,reason:"durum yok"};const i=await cn(`${k}/profilereactions/v1/profiles/${ce.profileId}/reactions/sources/profilegeneratedcontent/entities/${o}`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({reactionTypeId:"loveit",entityGameId:x})});return 201===i.status||200===i.status||409===i.status?{liked:!0,wayd:o}:{liked:!1,reason:`loveit HTTP ${i.status}`}}(n);s=!!e.liked,!s&&e.reason&&(l=e.reason)}catch{l="be\u011feni atland\u0131"}let c=await ki(r);if(c.length<2)try{const t=await ki(e);t.length>c.length&&(c=t)}catch{}cd("Slot birle\u015ftiriliyor (\xe7\u0131plak riski yok)\u2026","info");const d=await async function(e,t,n){const[o,i,r]=await Promise.all([vi(e,t),vi(ce.profileId,n),Si()]),a=new Map;for(const e of r){const t=Ii(e),n=String(e?.id||"").trim();t&&n&&!a.has(t)&&a.set(t,n)}const s=new Map,l=[];for(const e of i){const t=String(e?.id||"").trim();if(!t)continue;const n=Ci(e);n?s.set(n,t):l.push(t)}const c=new Set([...s.values(),...l]);for(const e of n)c.has(String(e))||l.push(String(e));let d=0,p=0;for(const e of o){const t=Ci(e),n=Ii(e),o=n?a.get(n):null;t&&o?(s.set(t,o),d+=1):p+=1}return{merged:[...new Set([...s.values(),...l])],replaced:d,missing:p,ownCount:n.length,targetCount:t.length,slotCount:s.size}}(n,t,a);if(0===d.replaced)throw new Error(`Sende e\u015fle\u015fen par\xe7a yok (hedef ${t.length}, eksik ${d.missing}). Ayn\u0131 modeller envanterinde olmal\u0131 \u2014 \xe7\u0131plak b\u0131rakmamak i\xe7in dokunulmad\u0131.`);if(d.merged.length<Math.max(8,a.length-2))throw new Error(`Birle\u015fik kombin \u015f\xfcpheli k\u0131sa (${d.merged.length}/${a.length}). Uygulanmad\u0131 \u2014 \xe7\u0131plak kalma riski.`);await dn(.35,.7);const p=d.merged,{parsed:u}=await zi(p,c);if(!u.success){try{await zi(a,c)}catch{}throw new Error("Sunucu reddetti"+(u.reason?`: ${u.reason}`:"")+(u.invalid.length?` (${u.invalid.length} ge\xe7ersiz)`:"")+" \u2014 eski kombin geri y\xfcklendi")}const f=u.upd?.data?.inventoryItems||u.upd?.data?.inventoryItemIds||[];let m=0;if(Array.isArray(f)&&(m=f.length),m>0&&m<Math.max(8,a.length-3))throw cd("Kombin eksik geldi \u2014 eski haline al\u0131n\u0131yor\u2026","info"),await zi(a,c),new Error(`Sunucu ${m} par\xe7a yazd\u0131 (\xf6nce ${a.length}) \u2014 geri al\u0131nd\u0131`);const g=[`${d.replaced} slot de\u011fi\u015fti`,`${p.length} par\xe7a toplam`,`hedef ${t.length}`];i&&g.push(s?"durum be\u011fenildi":l?`be\u011feni: ${l}`:"be\u011feni yok"),cd(`K\u0131yafet kopyaland\u0131 \u2014 ${g.join(" \xb7 ")}`,"success")}).catch(e=>cd(String(e?.message??e??"K\u0131yafet kopyalanamad\u0131"),"error"))}let Li=null;const Pi={on:!1,ox:0,oy:0},Mi={entries:[],loaded:!1,page:0},Ai=5;async function Ei(){Fo()&&(!function(){if(Li)return;const e=al("div",{position:"fixed",bottom:"24px",right:"24px",width:"372px",maxWidth:"calc(100vw - 32px)",background:"linear-gradient(165deg,rgba(24,22,34,.98),rgba(10,10,16,.995))",border:"1px solid rgba(167,139,250,.28)",borderRadius:"20px",boxShadow:"0 0 0 1px rgba(167,139,250,.18) inset, 0 28px 80px rgba(0,0,0,.9), 0 0 60px rgba(167,139,250,.16)",zIndex:"2147483650",fontFamily:Zs.sans,display:"none",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",animation:"ax-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",maxHeight:"calc(100vh - 48px)"});e.style.overflow="hidden";e.id=A.restoreFloat;for(const t of["mousedown","mouseup","mousemove","click","wheel","touchstart","touchend","touchmove"])e.addEventListener(t,ev=>{const el=ev.target;const tag=(el&&el.tagName||"").toLowerCase();if(tag==="input"||tag==="textarea"||tag==="select"||el&&el.isContentEditable)return;if(el&&el.closest&&el.closest("input,textarea,select,[contenteditable=\"true\"]"))return;ev.stopImmediatePropagation()},{passive:t.startsWith("touch")||"wheel"===t});const t=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:"2px",background:`linear-gradient(180deg, transparent 0%, ${Zs.acc} 30%, ${Zs.accBdr} 70%, transparent 100%)`,borderRadius:"2px 0 0 2px",opacity:"0.6",pointerEvents:"none"});e.appendChild(t);const n=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:"50px",background:"linear-gradient(180deg,rgba(167,139,250,.12),rgba(255,255,255,.02))",borderBottom:"1px solid rgba(167,139,250,.18)",cursor:"grab",userSelect:"none",flexShrink:"0"}),o=al("div",{display:"flex",alignItems:"center",gap:"8px"}),i=al("span",{color:Zs.acc,display:"flex",alignItems:"center"});i.innerHTML=sl.restore;const r=al("span",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"800",letterSpacing:"0.14em",color:"#ede9fe",textTransform:"uppercase"});r.textContent=re("status_restore"),o.appendChild(i),o.appendChild(r);const a=al("div",{display:"flex",gap:"4px"}),s=Ec('<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',re("refresh")||"Yenile",!0);s.addEventListener("click",()=>{Mi.loaded=!1,Mi.page=0,ji(!0)});const l=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',re("close")||"Kapat",!0);l.addEventListener("click",()=>{e.style.display="none"}),a.appendChild(s),a.appendChild(l),n.appendChild(o),n.appendChild(a),n.addEventListener("mousedown",t=>{if(t.target.closest("button"))return;t.stopImmediatePropagation(),t.preventDefault();const o=e.getBoundingClientRect();Pi.on=!0,Pi.ox=t.clientX-o.left,Pi.oy=t.clientY-o.top,n.style.cursor="grabbing";const i=t=>{Pi.on&&(e.style.left=Math.min(Math.max(0,t.clientX-Pi.ox),innerWidth-e.offsetWidth)+"px",e.style.top=Math.min(Math.max(0,t.clientY-Pi.oy),innerHeight-e.offsetHeight)+"px",e.style.right="auto",e.style.bottom="auto")},r=()=>{Pi.on=!1,n.style.cursor="grab",window.removeEventListener("mousemove",i,!0),window.removeEventListener("mouseup",r,!0)};window.addEventListener("mousemove",i,!0),window.addEventListener("mouseup",r,!0)}),e.appendChild(n);const c=al("div",{overflowY:"hidden",overflowX:"hidden",padding:"12px 12px 10px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:"8px",background:"radial-gradient(ellipse at 50% 0%, rgba(167,139,250,.08), transparent 55%)"});c.id=A.restoreList,e.appendChild(c),Pc.restoreBody=c;const d=al("div",{display:"none",alignItems:"center",justifyContent:"space-between",padding:"10px 12px 12px",borderTop:"1px solid rgba(167,139,250,.14)",background:"rgba(0,0,0,.22)",flexShrink:"0"}),p=(e,t)=>{const n=al("button",{width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"6px",color:Zs.acc,cursor:"pointer",outline:"none",padding:"0",transition:"background 0.12s, border-color 0.12s, opacity 0.15s"});return n.innerHTML=e,n.title=t,n.addEventListener("mouseenter",()=>{n.disabled||(n.style.background=Zs.accGlow,n.style.borderColor=Zs.acc)}),n.addEventListener("mouseleave",()=>{n.style.background=Zs.accDim,n.style.borderColor=Zs.accBdr}),n},u=p('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',"Previous page"),f=p('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',"Next page"),m=al("span",{fontFamily:Zs.mono,fontSize:"10.5px",color:Zs.sub,letterSpacing:"0.06em",textAlign:"center",flex:"1"});u.addEventListener("click",()=>{Mi.page>0&&(Mi.page--,Fi())}),f.addEventListener("click",()=>{const e=Math.max(0,Math.ceil(Mi.entries.length/Ai)-1);Mi.page<e&&(Mi.page++,Fi())}),d.appendChild(u),d.appendChild(m),d.appendChild(f),e.appendChild(d),Pc.restoreFoot=d,Pc.restorePrevBtn=u,Pc.restoreNextBtn=f,Pc.restorePageLabel=m,Li=e,(j()??document.body).appendChild(e)}(),Li.style.display="flex",Li.style.zIndex="2147483652",(()=>{try{const p=Cc?.getBoundingClientRect?.();if(p){const w=Li.offsetWidth||340;let left=p.left-w-12;if(left<8)left=Math.min(innerWidth-w-8,p.right+12);Li.style.left=left+"px";Li.style.top=Math.max(8,p.top)+"px";Li.style.right="auto";Li.style.bottom="auto"}else{Li.style.bottom="24px";Li.style.right="24px"}}catch{}})(),await ji())}function Di(e){const t=Pc.restoreBody;if(!t)return;t.innerHTML="",Pc.restoreFoot&&(Pc.restoreFoot.style.display="none");const n=al("div",{padding:"24px 12px",textAlign:"center",fontFamily:Zs.sans,fontSize:"12px",color:Zs.sub});n.textContent=e,t.appendChild(n)}async function ji(e){if(Pc.restoreBody)if(!Mi.loaded||e){e&&(Mi.page=0),function(){const e=Pc.restoreBody;if(e){e.innerHTML="",Pc.restoreFoot&&(Pc.restoreFoot.style.display="none");for(let t=0;t<4;t++){const t=al("div",{padding:"8px 4px",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:"10px"}),n=al("div");n.className="ax-skel",Object.assign(n.style,{height:"12px",width:"68%"});const o=al("div");o.className="ax-skel",Object.assign(o.style,{height:"22px",width:"22px",borderRadius:"6px",flexShrink:"0",marginLeft:"auto"});const i=al("div",{display:"flex",flexDirection:"column",gap:"6px",flex:"1",minWidth:"0"}),r=al("div");r.className="ax-skel",Object.assign(r.style,{height:"8px",width:"38%"}),i.appendChild(n),i.appendChild(r),t.appendChild(i),t.appendChild(o),e.appendChild(t)}}}();try{const e=await async function(e,t,n){const o=await cn(`${k}${e}`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:t,variables:JSON.stringify(n)})});if(!o.ok)throw new Error(`HTTP ${o.status}: ${await o.text()}`);return o.json()}("/edgeugc/graphql","query GetUserUGCs($gameId: String!, $profileId: String!, $contentType: String, $page: String, $pageSize: Int) {recentUgcsByProfile(input:{gameId: $gameId, profileId: $profileId, contentType: $contentType, page: $page, pageSize: $pageSize}) {nextPage entries {id title lastEditedDate lifecycleStatus owner type commentCount privacyStatus ...on Movie {duration views} reactions {reactionTypeId count} resources {type id} profile {id name membership {lastTierExpiry} avatar(preferredGameId: $gameId) {gameId}}}}}",{gameId:x,profileId:ce.profileId,contentType:"WAYD",page:"",pageSize:50}),t=e?.data?.recentUgcsByProfile?.entries??[];if(0===t.length)return Mi.entries=[],Mi.loaded=!0,void Di("No previous statuses found");const n=c,o=await Promise.all(t.map(async e=>{const t=(e.resources??[]).find(e=>"PgcV1"===e.type)?.id;let o="";if(t&&n)try{const e=await cn(`${w}/${t}`,{method:"GET"});if(e.ok){const t=n.deserialize(new Uint8Array(await e.arrayBuffer()),{promoteValues:!1,promoteLongs:!1,promoteBuffers:!1});Array.isArray(t.Texts)&&t.Texts.length>0&&(o=String(t.Texts[0]??""))}}catch{}const i=(e.reactions??[]).find(e=>"loveit"===e.reactionTypeId)?.count??0;return{id:e.id,text:o,loveit:i,lastEditedDate:e.lastEditedDate}}));Mi.entries=o,Mi.loaded=!0,Fi()}catch(e){Di(e?.message??"Failed to load statuses")}}else Fi()}function Fi(){const e=Pc.restoreBody;if(!e)return;e.innerHTML="";const t=Pc.restoreFoot,n=Mi.entries.length,o=Math.max(1,Math.ceil(n/Ai));if(Mi.page>=o&&(Mi.page=o-1),Mi.page<0&&(Mi.page=0),!n)return t&&(t.style.display="none"),void Di("No previous statuses found");const i=Mi.page*Ai,r=Mi.entries.slice(i,i+Ai);for(const t of r){const n=al("div",{position:"relative",padding:"11px 12px",background:"linear-gradient(155deg,rgba(167,139,250,.1) 0%,rgba(255,255,255,.03) 45%,rgba(0,0,0,.25) 100%)",border:"1px solid rgba(167,139,250,.2)",borderRadius:"14px",display:"flex",alignItems:"center",gap:"12px",transition:"transform .14s, border-color .14s, box-shadow .14s",animation:"ax-fi 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",overflow:"hidden",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05)"});n.addEventListener("mouseenter",()=>{n.style.borderColor=Zs.accBdr||"rgba(167,139,250,.45)";n.style.boxShadow="0 0 20px rgba(167,139,250,.18), inset 0 1px 0 rgba(255,255,255,.06)";n.style.transform="translateY(-1px)"}),n.addEventListener("mouseleave",()=>{n.style.borderColor="rgba(167,139,250,.2)";n.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.05)";n.style.transform="none"});const glow=al("div",{position:"absolute",width:"70px",height:"70px",borderRadius:"50%",background:"rgba(167,139,250,.18)",filter:"blur(22px)",top:"-30px",right:"40px",pointerEvents:"none"});n.appendChild(glow);const o=al("div",{display:"flex",flexDirection:"column",gap:"5px",flex:"1",minWidth:"0",position:"relative",zIndex:"1"}),i=al("div",{fontFamily:Zs.sans,fontSize:"12.5px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});i.textContent=t.text||"(no text)",i.title=t.text||"";const r=al("div",{display:"flex",alignItems:"center",gap:"6px",fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub}),a=al("span",{display:"inline-flex",alignItems:"center",gap:"3px",color:Zs.acc,background:Zs.accDim,border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.3)"),borderRadius:"999px",padding:"2px 7px"});a.innerHTML=sl.heart;const s=al("span");if(s.textContent=String(t.loveit),a.appendChild(s),r.appendChild(a),t.lastEditedDate){const e=new Date(t.lastEditedDate);if(!isNaN(e)){const n=al("span");n.textContent=e.toLocaleDateString();r.appendChild(n)}}o.appendChild(i),o.appendChild(r);const l=al("button",{width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,rgba(167,139,250,.35),rgba(167,139,250,.12))",border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.4)"),borderRadius:"50%",color:Zs.acc,cursor:"pointer",outline:"none",padding:"0",flexShrink:"0",transition:"transform .12s, box-shadow .12s",position:"relative",zIndex:"1",boxShadow:"0 0 14px rgba(167,139,250,.25)"});l.title=re("status_restore"),l.innerHTML=sl.restore,l.addEventListener("mouseenter",()=>{l.disabled||(l.style.transform="scale(1.08)",l.style.boxShadow="0 0 22px rgba(167,139,250,.45)")}),l.addEventListener("mouseleave",()=>{l.style.transform="none",l.style.boxShadow="0 0 14px rgba(167,139,250,.25)"}),l.addEventListener("click",()=>_i(t,l)),n.appendChild(o),n.appendChild(l),e.appendChild(n)}if(t)if(o>1){t.style.display="flex",Pc.restorePageLabel.textContent=Mi.page+1+" / "+o;const e=0===Mi.page,n=Mi.page>=o-1;Pc.restorePrevBtn.disabled=e,Pc.restoreNextBtn.disabled=n,Pc.restorePrevBtn.style.opacity=e?"0.35":"1",Pc.restoreNextBtn.style.opacity=n?"0.35":"1",Pc.restorePrevBtn.style.cursor=e?"not-allowed":"pointer",Pc.restoreNextBtn.style.cursor=n?"not-allowed":"pointer"}else t.style.display="none"}async function _i(e,t){if(!Fo())return;if(t){t.disabled=!0;t.style.opacity="0.6";t.style.cursor="not-allowed"}await _o("restore",async()=>{await dn(.2,.4);const attrs=await Do();if(!attrs||"object"!=typeof attrs)throw new Error("Profil attributes okunamadi");const wid=String(e&&e.id||"").trim();if(!wid)throw new Error("Durum kimligi gerekli");const txt=String(e&&e.text||"");const readWayd=a=>{try{return String(a&&a.additionalData&&(a.additionalData.WAYD||a.additionalData.Wayd||a.additionalData.wayd)||"").trim()}catch{return""}};const cur=readWayd(attrs);const applyLock=()=>{try{lockWayd(wid,txt);uiWayd()}catch{}};const writeWayd=async base=>{const src=base&&"object"==typeof base?base:attrs;const add={...(src.additionalData&&"object"==typeof src.additionalData?src.additionalData:{}),WAYD:wid};const avatarId=src.avatarId!=null&&src.avatarId!==""?src.avatarId:(attrs.avatarId||"");try{await jo({...src,avatarId:avatarId,additionalData:add})}catch{await jo({avatarId:avatarId||"",additionalData:add})}};if(cur===wid){applyLock();try{await forceWaydKeep({silent:!0})}catch{}try{nudgeWaydPresence(!0)}catch{}try{pulseWaydVisual(wid,txt)}catch{}cd("Bu durum zaten aktif — oyundan cikip girersen de ayni kalir","info");return}await writeWayd(attrs);let now="";for(let attempt=0;attempt<4;attempt++){await dn(.2,.35);const check=await Do();now=readWayd(check);if(now===wid)break;await writeWayd(check||attrs)}if(now!==wid)throw new Error("Durum sunucuya yazilamadi — tekrar dene");applyLock();try{await forceWaydKeep({silent:!0})}catch{}try{nudgeWaydPresence(!0)}catch{}try{pulseWaydVisual(wid,txt)}catch{}try{setTimeout(()=>{forceWaydKeep({silent:!0}).catch(()=>{})},300);setTimeout(()=>{forceWaydKeep({silent:!0}).catch(()=>{})},1200);setTimeout(()=>{forceWaydKeep({silent:!0}).catch(()=>{})},3500)}catch{}cd("Durum sunucuya yazildi. Oyundan cik-gir: eski durum + begeni/yorum gelir","success")}).catch(err=>cd(err&&err.message||"Geri getirme basarisiz","error"))}async function Ri(){Fo()&&(ce.ops.quests.progress=0,await _o("quests",async()=>{await dn(.15,.3);const e=ce.profileId,t=[];const n=["EventQuest","StaticDailyQuest","RandomDailyQuest"].map(e=>`questType=${e}`).join("&");let o;try{o=await so(`/quests/v2/profiles/${e}/games/${x}/quests?${n}`)}catch{return t.push("gorev listesi"),void cd("Gorev listesi alinamadi"+(t.length?" — "+t.join(", "):""),"error")}const i=function(e){const t=[];function n(e){const o=e.children?.length>0;e.definitionId&&"Active"===e.state&&!o&&t.push({id:e.definitionId,target:e.target??1,needsProgress:(e.progress??0)<(e.target??1)}),o&&e.children.forEach(n)}return e.forEach(n),t}(o?.quests??[]);ce.ops.quests.chestsNormal=0,ce.ops.quests.chestsVip=0,ce.ops.quests.pets=0,ce.ops.quests.questsDone=0;let __active={};try{const __ar=await so(`/timelimitedrewards/v2/profiles/${e}/games/${x}/rewards?state=active`);for(const __row of(__ar?.rewards||[]))if(__row?.id)__active[String(__row.id)]=__row}catch{}for(const __rid of["daily_pickup","daily_pickup_vip"]){const __qid=__rid==="daily_pickup_vip"?"daily_open_gift_vip":"daily_open_gift_normal";const __row=__active[__rid]||{};let __target=Number(__row.targetValue)||4;if(!Number.isFinite(__target)||__target<1)__target=4;if(__target>6)__target=6;let __done=Number(__row.progress)||0;if(!Number.isFinite(__done)||__done<0)__done=0;let __need=__target-__done;if(__need<1)__need=__target;if(__need>6)__need=6;let __miss=0;for(let __c=0;__c<__need&&__miss<2;__c++){await dn(.08,.16);try{await lo(`/timelimitedrewards/v2/profiles/${e}/games/${x}/rewards/${__rid}`,{state:"Claimed"});ce.ops.quests.progress++;__rid==="daily_pickup_vip"?ce.ops.quests.chestsVip++:ce.ops.quests.chestsNormal++;try{Pc.syncQuestBadges?.()}catch{}ld();try{await lo(`/quests/v2/profiles/${e}/games/${x}/quests/${__qid}/progress`,{progress:1})}catch{}}catch{__miss++;continue}}try{await lo(`/quests/v2/profiles/${e}/games/${x}/quests/${__qid}/state`,{state:"Complete"})}catch{}}for(const n of i.filter(e=>!I.has(e.id)))try{await Oi(e,n)}catch{t.push(n.id)}await dn(.2,.4);let r=0;try{r=await async function(e){let t=0;for(const n of C){await dn(.12,.25);try{await co(`/pets/v1/pets/${n}/interactions`,{profileId:e,gameId:x}),t++}catch{}}return t}(e),ce.ops.quests.pets=r}catch{t.push("pet")}if(r>0){await dn(.15,.3);try{await lo(`/quests/v2/profiles/${e}/games/${x}/quests/daily_pet_pets/state`,{state:"Complete"}),ce.ops.quests.progress++,ld();try{Pc.syncQuestBadges?.()}catch{}}catch{}}else 0===r&&t.push("pet yok/basarisiz");const a=ce.ops.quests.progress;t.length?cd(`${a} tamam · fail: ${t.slice(0,4).join(", ")}${t.length>4?"…":""}`,"info"):cd(`${a} gorev tamam`,"success")}).catch(e=>cd(String(e?.message??"Gorev kosusu basarisiz"),"error")))}async function Oi(e,t){const n=`/quests/v2/profiles/${e}/games/${x}/quests/${t.id}`;if(t.needsProgress)for(let e=0;e<t.target;e++){await dn(.12,.28);try{await lo(`${n}/progress`,{progress:1})}catch{}}await dn(.15,.3);try{await lo(`${n}/state`,{state:"Complete"}),ce.ops.quests.progress++,ce.ops.quests.questsDone=(ce.ops.quests.questsDone||0)+1,ld();try{Pc.syncQuestBadges?.()}catch{}}catch{}await dn(.15,.35)}async function Ui(e,t){const n=String(t||"");try{if("summer_26_plaza_postcard"===n)return void await lo(`/quests/v2/profiles/${e}/games/${x}/quests/summer_26_pick_first_postcard/state`,{state:"Complete"});if(n.startsWith("summer_26_")&&n.endsWith("_postcard")&&!n.includes("minigame")&&"summer_26_plaza_postcard"!==n){const o=["EventQuest","StaticDailyQuest","RandomDailyQuest"].map(e=>`questType=${e}`).join("&"),i=await so(`/quests/v2/profiles/${e}/games/${x}/quests?${o}`),r=[];function a(e){const t=String(e?.definitionId||"");t.startsWith("summer_26_postcard_hunt_")&&"Active"===e.state&&r.push(t),(e.children||[]).forEach(a)}(i?.quests??[]).forEach(a),r.sort(),r[0]&&await lo(`/quests/v2/profiles/${e}/games/${x}/quests/${r[0]}/state`,{state:"Complete"})}}catch{}}async function Ni(){Fo()&&(ce.ops.crystals.collected=0,await _o("crystals",async()=>{await pn("crystals",1.2,2.4);const e=ce.profileId,n=await async function(e){return so(`/timelimitedrewards/v2/profiles/${e}/games/${x}/rewards?state=active`)}(e),o=Object.fromEntries((n?.rewards??[]).map(e=>[e.id,e])),i=Object.entries(t);let r=0;for(const[e,t]of i){const t=o[e];r+=t?Math.max(0,t.targetValue-t.progress):0}ce.ops.crystals.total=r||i.length,ld();let a=0;for(let t=0;t<i.length;t++){const[n]=i[t],r=o[n],s=r?Math.max(0,r.targetValue-r.progress):1;if(0===s)continue;let l=0;for(let t=0;t<s;t++){await pn("crystals",0===t?1:.5,0===t?2:1.2);try{await lo(`/timelimitedrewards/v2/profiles/${e}/games/${x}/rewards/${n}`,{state:"Claimed"}),a++,l++,ce.ops.crystals.collected=a,ld()}catch{break}}l>0&&(await pn("crystals",.4,.8),await Ui(e,n)),t<i.length-1&&await pn("crystals",1,2.2)}cd(`${a} etkinlik odulu claim${r?` (kalan plan ~${r})`:""}`,"success")}).catch(e=>cd(String(e?.message??"Etkinlik toplama basarisiz"),"error")))}async function qi(){Fo()&&await _o("acceptFriends",()=>Yi("approved","acceptFriends")).catch(()=>cd("Failed to accept requests","error"))}async function Hi(){Fo()&&await _o("rejectFriends",()=>Yi("rejected","rejectFriends")).catch(()=>cd("Failed to reject requests","error"))}async function Wi(){const e=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetAllRelationships($profileId: String!, $gameId: String!){ relationships(profileId: $profileId) { nodes { profileId labels(gameId: $gameId) } } requestsIn(profileId: $profileId) { nodes { profileId } } requestsOut(profileId: $profileId) { nodes { profileId } } blocked(profileId: $profileId) { nodes { profileId } } labelRequestsIn(profileId: $profileId, gameId: $gameId) { nodes { profileId label } } labelRequestsOut(profileId: $profileId, gameId: $gameId) { nodes { profileId label } } }",variables:{profileId:ce.profileId,gameId:x}})});if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.json();return(t?.data?.relationships?.nodes??[]).map(e=>e.profileId)}async function Gi(e){const t=new Map;if(!e.length)return t;for(let n=0;n<e.length;n+=50){const o=e.slice(n,n+50);try{const e=await cn(`${k}/experience/v1/experience/batch`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify(o.map(e=>({gameId:x,profileId:e})))});if(!e.ok)continue;const n=await e.json();if(!Array.isArray(n))continue;for(const e of n){const n=e?.experience;n&&"number"==typeof n.level&&t.set(n.profileId,n.level)}}catch{}n+50<e.length&&await pn("deleteFriendsLevel",.6,1.1)}return t}async function Vi(e){try{const t=await cn(`${k}/profilememberships/v1/memberships/summary/profiles/${e}`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,"skip-not-found-items":"true"}});if(!t.ok)return!1;const n=await t.json();if(!Array.isArray(n)||0===n.length)return!1;const o=n[0],i=new Date,r=o.currentTierExpiry?new Date(o.currentTierExpiry):null;return!!r&&r>i}catch{return!1}}async function deleteAllFriends(){Fo()&&await _o("deleteFriendsAll",async()=>{cd("Arkadaş listesi alınıyor…","info");await pn("deleteFriendsAll",.8,1.4);const list=await Wi();if(!list.length)return void cd(re("oto_no_friends"),"info");if(!window.confirm(list.length+" arkadaşın hepsi silinsin mi?"))return void cd("İptal","info");cd(list.length+" arkadaş siliniyor…","info");let n=0;for(const id of list){await pn("deleteFriendsAll",.5,1.1);if(await Ki(id))n++}cd(n+" arkadaş silindi","success")}).catch(()=>cd("Toplu silme başarısız","error"))}async function Ki(e){return(await cn(`${k}/profilerelationships/v2/profiles/${ce.profileId}/relationships/${e}`,{method:"DELETE",headers:{authorization:`Bearer ${ce.accessToken}`}})).ok}async function Ji(){Fo()&&await _o("deleteFriendsVip",async()=>{cd("Fetching friend list\u2026","info"),await pn("deleteFriendsVip",.8,1.4);const e=await Wi();if(!e.length)return void cd("No friends found","info");cd(`Checking ${e.length} friend${1!==e.length?"s":""}\u2026`,"info");const t=[];for(const n of e)await pn("deleteFriendsVip",.35,.7),await Vi(n)||t.push(n);if(!t.length)return void cd("All friends have VIP","info");cd(`Deleting ${t.length} non-VIP friend${1!==t.length?"s":""}\u2026`,"info");let n=0;for(const e of t)await pn("deleteFriendsVip",.9,1.6),await Ki(e)&&n++;cd(`Deleted ${n} non-VIP friend${1!==n?"s":""}`,"success")}).catch(()=>cd("Delete operation failed","error"))}async function Yi(e,t){await pn(t,.2,.4);const n=await To();if(!n.length)return void cd("Bekleyen istek yok","info");let o=0;for(const i of n){await pn(t,.1,.22);try{await lo(`/profilerelationships/v2/profiles/${i}/relationships/requests/${ce.profileId}`,{profileId:ce.profileId,state:e}),o++}catch{}}cd(`${o} istek ${"approved"===e?"kabul":"red"} edildi`,"success")}async function Qi(){Fo()&&await _o("readMessages",async()=>{await pn("messages",.15,.3);const list=await PoAll();if(!list.length)return void cd("Okunmamış mesaj yok","info");let t=0;for(const n of list){await pn("messages",.06,.14);try{await Mo(n)&&t++}catch{}}cd(t+" konuşma okundu","success")}).catch(e=>cd("Okuma başarısız: "+(e&&e.message?e.message:e),"error"))}const Xi=3e5,Zi=5e3,er=300,tr=4,nr=5e3,or=2e3,ir=1e4,rr=12e3,ar=200,sr=80,lr=50,cr=45e3,dr=1e4,pr=3e5,ur=80,fr=400,mr=16,gr=96,hr=500,yr=2500,br=2500,xr=[{id:"link",rx:/(https?:\/\/|www\.|discord\.gg|t\.me\/|bit\.ly|tinyurl|linktr\.ee|\.com\b|\.net\b|\.org\b|instagram|snapchat|whatsapp|telegram)/i},{id:"reklam",rx:/\b(bedava|free\s*(vip|diamond|diamonds|coin|coins)|ucuz\s*vip|satilik|hesap\s*(sat|al|ver)|reklam|promo|kod|cekilis|giveaway|follow\s*me|takip\s*et)\b/i},{id:"kufur",rx:/(^|[\s.!?,;:])(?:amk|aq|orospu|siktir|pic|ibne|yarrak|fuck|bitch|shit|sex|porn)(?=$|[\s.!?,;:])/i}];function kr(){return ce.dmSpamGuard}function wr(e){return new Promise(t=>setTimeout(t,e))}function vr(e){const t=String(e||"").trim().toLowerCase();if(!t)return"";const n=t.replace(/-/g,"");return/^[0-9a-f]{32}$/.test(n)?n:/^[0-9a-f]{32}$/i.test(t)?t:""}function Sr(e){return String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\u00ad\u200b-\u200f\u202a-\u202e]/g,"").toLowerCase()}function Cr(e){return e&&"object"==typeof e?vr(e.profileId||e.ProfileId||e.senderProfileId||e.SenderProfileId||e.authorProfileId||e.AuthorProfileId||e.participantProfileId||e.ParticipantProfileId||e.profile?.id||e.profile?.profileId):""}function Ir(e,t=0){if(!e||t>2)return"";if("string"==typeof e)return e;if("object"!=typeof e)return"";const n=["MessageBody","messageBody","message","Message","text","Text","body","Body","preview","lastMessageText","content","value"];for(const t of n)if("string"==typeof e[t]&&e[t].trim())return e[t];const o=e.messageContent||e.MessageContent||e.lastMessage||e.LastMessage||e.content;return o&&o!==e?Ir(o,t+1):""}function $r(e){return Array.isArray(e)?e:e&&"object"==typeof e?Object.values(e):[]}function Br(e){return String(e?.conversationId||e?.ConversationId||e?.id||e?.Id||"").trim()}function zr(e){const t=new Set,n=[e?.participants,e?.Participants,e?.participantIds,e?.ParticipantIds,e?.profileIds,e?.ProfileIds,e?.memberProfileIds,e?.members,e?.Members];for(const e of n)for(const n of $r(e)){const e="string"==typeof n?vr(n):Cr(n);e&&e!==ce.profileId&&t.add(e)}const o=Cr(e);return o&&o!==ce.profileId&&t.add(o),[...t]}function Tr(e){if(Array.isArray(e))return e;if(!e||"object"!=typeof e)return[];for(const t of["messages","Messages","history","History","items","Items","data","Data"])if(Array.isArray(e[t]))return e[t];return[]}function Lr(){const e=kr();return!(!e.lockdown&&!e.maxSpeed&&"max"!==e.mode&&"agresif"!==e.mode)}function Pr(){const e=kr();return!(!e.lockdown&&!e.maxSpeed&&"max"!==e.mode)}function Mr(e){return Math.min(er,Math.max(tr,parseInt(e,10)||6))}function Ar(e){return Math.min(nr,Math.max(20,parseInt(e,10)||or))}function Er(){const e=Ar(kr().blockConc);return Pr()?e:Lr()?Math.min(e,fr):Math.min(e,ur)}function Dr(){const e=Er(),t=Pr()?2:1;return Math.min(Zi,Math.max(e*t,e))}function jr(){const e=kr();return Pr()||!1!==e.leaveFirst?Math.min(500,Math.max(gr,Math.floor(Er()/4))):Lr()?Math.max(mr,32):mr}function Fr(e){e.shieldedConvIds||(e.shieldedConvIds=new Set),e.shieldedPids||(e.shieldedPids=new Set)}function _r(e,t){const n=kr();Fr(n);const o=vr(e);o&&n.shieldedPids.add(o);const i=String(t||"").trim();i&&n.shieldedConvIds.add(i)}function Rr(e){const t=kr();if(!t.enabled||!1===t.gameShield)return!1;Fr(t);const n=Br(e);if(n&&t.shieldedConvIds.has(n))return!0;const o=zr(e);if(!o.length)return!1;let i=!1;for(const e of o)if(t.friendIds.has(e)&&(i=!0),(t.blockedIds.has(e)||t.blockQueue.has(e)||t.inflightIds.has(e)||t.shieldedPids.has(e))&&!t.friendIds.has(e))return!0;if(i)return!1;const r=Ir(e?.lastMessage||e?.LastMessage||e);for(const e of o){if(t.friendIds.has(e))continue;const n=t.profileCache.get(e),o=n?.value||n;if(o&&"object"==typeof o){if(Wr(o,r).block)return!0}}return!1}function Or(e,t){const n=kr();if(!n.enabled||!1===n.gameShield||null==e)return e;Fr(n);const o=String(t||"").match(/\/conversations\/([^/?]+)\/history/i),i=o?decodeURIComponent(o[1]):"";let r=!(!i||!n.shieldedConvIds.has(i));if(!r&&i){const e=n.conversationCache.get(i);e&&Rr(e)&&(r=!0)}if(!r){const t=Tr(e);for(const e of t){const t=Cr(e);if(t&&(n.blockedIds.has(t)||n.blockQueue.has(t)||n.shieldedPids.has(t))){r=!0;break}}}if(!r)return e;if(i&&n.shieldedConvIds.add(i),n.stats.shielded=(n.stats.shielded||0)+1,Array.isArray(e))return[];if(!e||"object"!=typeof e)return e;const a={...e};for(const e of["messages","Messages","history","History","items","Items","data","Data"])Array.isArray(a[e])&&(a[e]=[]);return a}function Ur(e,t,n){try{const o=kr();if(!o.enabled||!1===o.gameShield||!n)return n;if(!String(e||"").includes("/gamemessaging/"))return n;const i=String(t||"GET").toUpperCase();return"GET"!==i&&"HEAD"!==i?n:/\/participants\/[^/]+\/conversations(?:[/?]|$)/i.test(e)?function(e){const t=kr();if(!t.enabled||!1===t.gameShield||null==e)return e;let n=!1,o=0;const i=e=>{if(!Array.isArray(e))return e;const i=[];for(const r of e){if(Rr(r)){o++,n=!0;const e=Br(r),i=zr(r);e&&t.shieldedConvIds.add(e);for(const e of i)t.shieldedPids.add(e);continue}i.push(r)}return i};if(Array.isArray(e)){const r=i(e);return o&&(t.stats.shielded=(t.stats.shielded||0)+o),n?r:e}if(!e||"object"!=typeof e)return e;let r=null;for(const t of["conversations","Conversations","items","Items","data","Data"]){if(!Array.isArray(e[t]))continue;const o=i(e[t]);o!==e[t]&&(r||(r={...e}),r[t]=o,n=!0)}return o&&(t.stats.shielded=(t.stats.shielded||0)+o),n&&r?r:e}(n):void 0!==Wt&&Wt.test(e)||/\/conversations\/[^/]+\/history(?:[/?]|$)/i.test(e)?Or(n,e):n}catch{return n}}function Nr(e){const t=kr(),n=Sr(e);if(!n)return null;const o=t.contentRules||{link:!0,reklam:!0,kufur:!0};for(const e of xr)if(!1!==o[e.id]&&e.rx.test(n))return e.id;return null}function qr(){const e=kr();return Math.max(1,parseInt(e.levelThreshold,10)||5)}function Hr(e){const t=kr().profileCache.get(e),n=t?.value||t;return n&&"object"==typeof n&&"number"==typeof n.level&&Number.isFinite(n.level)?n.level<=qr()?"yes":"no":"unknown"}function Wr(e,t){const n=kr();if(!e||"number"!=typeof e.level||!Number.isFinite(e.level))return{block:!1,reasons:[],needLevel:!0};if(e.level>qr())return{block:!1,reasons:[],needLevel:!1};const o=[`lvl ${e.level}`];(function(e){const t=Sr(e?.name||"");return!!t&&(!!/(^|[\s|_-])guest[0-9a-z_-]*($|[\s|_-])/.test(t)||!!/^g[a-z0-9]{5,19}$/.test(t)||!!/^guest/i.test(t)||!e?.hasAvatar&&/\b(guest|newuser|user[0-9]{4,})\b/.test(t))})(e)&&o.push("guest"),e?.lookedUp&&!String(e.name||"").trim()&&o.push("empty-name");const i=Nr(t);return i&&o.push(i),n.lockdown&&o.push("flood-low"),{block:!0,reasons:o,needLevel:!1}}function Gr(){const e=kr();if(!e||!1===e.adaptive||!e.enabled)return;const t=Vr(),n=e.blockQueue?.size||0,o=Math.max(t,Math.floor(n/8));if(o>=80||n>=800)(e.workerCount||0)<er&&(e.workerCount=er),e.blockConc=Math.max(e.blockConc||120,nr),e.batchMs=Math.min(e.batchMs||1e3,25),"max"!==e.mode&&(e.mode="max"),e.maxSpeed=!0,e.autoLock&&!e.lockdown&&Jr(t);else if(o>=25||n>=150)e.workerCount=Math.max(e.workerCount||6,200),e.blockConc=Math.max(e.blockConc||120,or),e.batchMs=Math.min(e.batchMs||1e3,50),e.maxSpeed=!0;else if(o>=8||n>=30)e.workerCount=Math.max(e.workerCount||6,100),e.blockConc=Math.max(e.blockConc||120,500),e.batchMs=Math.min(e.batchMs||1e3,100);else if(o<=2&&n<=5&&!e.lockdown){const t=parseInt(q(_.dmSpamWorker),10),n=parseInt(q(_.dmSpamBlockConc),10);Number.isFinite(t)&&e.workerCount>t&&(e.workerCount=Math.max(t,e.workerCount-20)),Number.isFinite(n)&&e.blockConc>n&&(e.blockConc=Math.max(n,e.blockConc-200))}try{na()}catch{}try{oa()}catch{}}function Vr(){const e=kr(),t=Date.now()-dr;return e.floodEvents=(e.floodEvents||[]).filter(e=>e>=t),e.floodEvents.length}function Kr(){const e=kr();e.enabled&&(e.pollTimer&&clearInterval(e.pollTimer),e.pollTimer=setInterval(()=>{ya()},function(){const e=kr();return e.lockdown||"max"===e.mode?lr:e.maxSpeed||"agresif"===e.mode?sr:ar}()))}function Jr(e){const t=kr();if(!t.lockdown&&t.autoLock){t.lockdown=!0,t.lockdownSince=Date.now(),t.lastFloodAt=Date.now(),t.stats.lockdowns=(t.stats.lockdowns||0)+1,(t.batchMs||1e3)>50&&(t._batchBeforeLock=t.batchMs,t.batchMs=50,oa()),(t.workerCount||6)<er&&(t._workersBeforeLock=t.workerCount,t.workerCount=er,na()),(t.blockConc||120)<or&&(null==t._blockConcBeforeLock&&(t._blockConcBeforeLock=t.blockConc),t.blockConc=Math.max(t.blockConc||120,or)),Kr(),ia(!0),Xr().catch(()=>{}),un(`[dm-lockdown-on] hits=${e||0}`),cd(`DM LOCKDOWN: spam sel (${e||0}/10sn) \u2014 ANINDA engel`,"error");try{gd?.("lockdown")}catch{}Zr()}}function Yr(e){const t=kr();if(!t.lockdown)return;t.lockdown=!1;const n=t.lockdownSince?Math.round((Date.now()-t.lockdownSince)/1e3):0;t.lockdownSince=0,null!=t._batchBeforeLock&&(t.batchMs=t._batchBeforeLock,t._batchBeforeLock=null,oa()),null!=t._workersBeforeLock&&(t.workerCount=t._workersBeforeLock,t._workersBeforeLock=null,na()),null!=t._blockConcBeforeLock&&(t.blockConc=t._blockConcBeforeLock,t._blockConcBeforeLock=null),Kr(),un(`[dm-lockdown-off] ${n}s`),e||cd(`DM lockdown bitti (${n}s) \u2014 normal moda donuldu`,"success"),t.lastQuietToastAt=Date.now(),Zr()}function Qr(){const e=kr();if(!e.lockdown||!e.enabled)return;const t=e.quietMs||2e4,n=e.lastFloodAt||e.lockdownSince||0;Vr()>=Math.max(2,Math.floor((e.floodThreshold||8)/2))?e.lastFloodAt=Date.now():e.queue.length+e.blockQueue.size+e.inflightIds.size>8||Date.now()-n<t||Yr(!1)}async function Xr(){const e=kr();if(ce.accessToken)try{const t=await Po(200);xa(t,"lockdown");for(const n of t.slice(0,150)){const t=Br(n);t&&e.conversationJobs.set(t,{conversationId:t,conv:n,source:"lockdown-mute"})}Ia(),ia(!0)}catch{}}function Zr(){const e=kr();if(e._uiPending)return;e._uiPending=!0;("function"==typeof requestAnimationFrame?requestAnimationFrame:e=>setTimeout(e,32))(()=>{e._uiPending=!1;try{ja?.()}catch{}})}function ea(){const e=kr();e.ownerProfileId!==ce.profileId&&(e.ownerProfileId=ce.profileId,e.myUuid=null,e.myUuidTs=0,e.queue.length=0,e.queuedIds.clear(),e.inflightIds.clear(),e.blockedIds.clear(),e.friendIds.clear(),e.sweepPage=1,e.ignoredIds.clear(),e.blockQueue.clear(),e.profileCache.clear(),e.profileInflight.clear(),e.conversationCache.clear(),e.conversationJobs.clear(),e.seenConvIds?.clear?.(),e.floodEvents=[],e.lockdown=!1,e.lockdownSince=0,e.lastFloodAt=0,e._batchBeforeLock=null,e._workersBeforeLock=null,e._blockConcBeforeLock=null,e.shieldedConvIds?.clear?.(),e.shieldedPids?.clear?.(),Object.assign(e.stats,{seen:0,checked:0,flagged:0,blocked:0,muted:0,left:0,lockdowns:0,floodHits:0,instant:0,shielded:0,leftFirst:0,rejectedFr:0,blockedFr:0,errors:0,rateLimited:0,dropped:0}))}function ta(){const e=kr();if(Pc.dmSpamModeSel){const t=e.mode,n=String(Pc.dmSpamModeSel.value||"normal");e.mode=["normal","agresif","max"].includes(n)?n:"normal",H(_.dmSpamMode,e.mode),e.mode!==t&&function(){const e=kr(),t=e.mode||"normal",n=q(_.dmSpamWorker),o=q(_.dmSpamBatch),i=q(_.dmSpamBlockConc);"max"===t?(e.lockdown||(null===n&&(e.workerCount=Math.max(e.workerCount||6,200)),null===o&&(e.batchMs=Math.min(e.batchMs||1e3,25))),e.maxSpeed=!0,e.instantBlock=!0,e.gameShield=!0,e.leaveFirst=!0,null===i&&(e.blockConc=Math.max(e.blockConc||120,or))):"agresif"===t?(e.lockdown||(null===n&&(e.workerCount=Math.max(e.workerCount||6,100)),null===o&&(e.batchMs=Math.min(e.batchMs||1e3,50))),e.maxSpeed=!0,e.instantBlock=!1!==e.instantBlock,null==e.gameShield&&(e.gameShield=!0),null==e.leaveFirst&&(e.leaveFirst=!0),null===i&&(e.blockConc=Math.max(e.blockConc||120,500))):e.maxSpeed=!1}()}if(Pc.dmSpamLevelSel&&(e.levelThreshold=Math.max(1,parseInt(Pc.dmSpamLevelSel.value,10)||5),H(_.dmSpamLevel,String(e.levelThreshold))),Pc.dmSpamWorkerSel){const t=Mr(Pc.dmSpamWorkerSel.value);e.lockdown&&null!=e._workersBeforeLock?e._workersBeforeLock=t:e.workerCount=t,H(_.dmSpamWorker,String(t))}if(Pc.dmSpamBatchSel){const t=Math.min(5e3,Math.max(25,parseInt(Pc.dmSpamBatchSel.value,10)||1e3));e.lockdown&&null!=e._batchBeforeLock?e._batchBeforeLock=t:e.batchMs=t,H(_.dmSpamBatch,String(t))}if(Pc.dmSpamFloodSel&&(e.floodThreshold=Math.min(hr,Math.max(3,parseInt(Pc.dmSpamFloodSel.value,10)||8)),H(_.dmSpamFlood,String(e.floodThreshold))),Pc.dmSpamQuietSel){const t=Math.min(120,Math.max(5,parseInt(Pc.dmSpamQuietSel.value,10)||20));e.quietMs=1e3*t,H(_.dmSpamQuiet,String(t))}Pc.dmSpamBlockConcSel&&(e.blockConc=Ar(Pc.dmSpamBlockConcSel.value),H(_.dmSpamBlockConc,String(e.blockConc)))}function na(){const e=kr(),t=Mr(e.workerCount||6);for(;e.workerSlots.length<t;){const t={id:e.workerSlots.length+1,stop:!1};e.workerSlots.push(t),Promise.resolve().then(()=>ua(t))}for(;e.workerSlots.length>t;){const t=e.workerSlots.pop();t&&(t.stop=!0)}}function oa(){const e=kr();e.flushTimer&&clearInterval(e.flushTimer);const t=Math.max(25,e.batchMs||1e3);e.flushTimer=setInterval(()=>{Sa()},t)}function ia(e){const t=kr();if(e||Pr())return t.flushKickTimer&&(clearTimeout(t.flushKickTimer),t.flushKickTimer=null),void(t.blockFlushRunning||Promise.resolve().then(()=>{Sa()}));t.flushKickTimer||(t.flushKickTimer=setTimeout(()=>{t.flushKickTimer=null,Sa()},40))}function ra(){ea(),ta(),na(),oa()}async function aa(){const e=kr();try{const t=await fa("query GetAllRelationships($profileId: String!, $gameId: String!){ relationships(profileId: $profileId) { nodes { profileId } } requestsOut(profileId: $profileId) { nodes { profileId } } }",{profileId:ce.profileId,gameId:x}),n=t?.data?.relationships?.nodes||[],o=t?.data?.requestsOut?.nodes||[];e.friendIds.clear();for(const t of n)t?.profileId&&e.friendIds.add(vr(t.profileId));for(const t of o)t?.profileId&&e.friendIds.add(vr(t.profileId))}catch{}}function sa(e){if(!ce.accessToken||!ce.profileId)return!1;const t=kr();if(t._starting)return!0;t._starting=!0;try{return t.enabled=!0,H(_.dmSpamOn,"1"),ea(),ta(),oa(),t._startTimer&&clearTimeout(t._startTimer),t._startTimer=setTimeout(()=>{t._startTimer=null,t.enabled&&(Fr(t),na(),Kr(),$a(),Ba(),t.sweepTimer&&clearTimeout(t.sweepTimer),t.sweepTimer=setTimeout(()=>{ba()},800),Promise.all([ma().catch(()=>{}),aa().catch(()=>{}),wa().catch(()=>{})]).then(()=>{t.enabled&&(ya(),t.autoRejectFriends&&za().catch(()=>{}),t.autoBlockFriends&&Ta().catch(()=>{}))}))},30),Zr(),e||cd("Otomatik spam engelleme acildi (anlik engel hazir)","success"),!0}finally{setTimeout(()=>{t._starting=!1},250)}}function la(e){const t=kr();t.lockdown&&Yr(!0),t.enabled=!1,H(_.dmSpamOn,"0"),t._startTimer&&(clearTimeout(t._startTimer),t._startTimer=null),t.pollTimer&&(clearInterval(t.pollTimer),t.pollTimer=null),t.flushTimer&&(clearInterval(t.flushTimer),t.flushTimer=null),t.flushKickTimer&&(clearTimeout(t.flushKickTimer),t.flushKickTimer=null),t.sweepTimer&&(clearTimeout(t.sweepTimer),t.sweepTimer=null),t.rejectFrTimer&&(clearInterval(t.rejectFrTimer),t.rejectFrTimer=null),t.blockFrTimer&&(clearInterval(t.blockFrTimer),t.blockFrTimer=null);for(const e of t.workerSlots)e.stop=!0;t.workerSlots=[],t.queue.length=0,t.queuedIds.clear(),t.inflightIds.clear(),t.blockQueue.clear(),t.conversationJobs.clear(),t.floodEvents=[],t.pollInFlight=!1,t.blockFlushRunning=!1,t.backgroundRunning=!1,t._starting=!1,Zr(),e||cd("Otomatik spam engelleme kapandi","info")}function ca(e){const t=kr();if(t._toggleBusy)setTimeout(()=>{try{Pc.dmSpamAutoToggle?._setChecked?.(!!t.enabled)}catch{}},0);else{t._toggleBusy=!0;try{if(e){if(!Fo()){try{Pc.dmSpamAutoToggle?._setChecked?.(!1)}catch{}return}sa(!1)}else la(!1)}catch(e){un(`[dm-toggle-err] ${String(e).substring(0,120)}`);try{la(!0)}catch{}try{Pc.dmSpamAutoToggle?._setChecked?.(!!t.enabled)}catch{}}finally{setTimeout(()=>{t._toggleBusy=!1,Zr()},280)}setTimeout(()=>{try{ld()}catch{}},0)}}function da(e){const t=kr(),n=vr(e?.profileId);if(!n||n===ce.profileId)return!1;const o=Ir(e?.text||e?.message||e?.lastMessage||""),i=t.ignoredIds.get(n)||0,r=Nr(o),a=!!r;if(i&&Date.now()-i<cr&&!a&&!t.lockdown)return!1;if(i&&(a||t.lockdown)&&t.ignoredIds.delete(n),t.blockedIds.has(n)||t.queuedIds.has(n)||t.inflightIds.has(n)||t.blockQueue.has(n))return!1;if(t.friendIds.has(n)&&!a)return!1;const s=Hr(n);if("no"===s){if(t.ignoredIds.size>800){const e=t.ignoredIds.keys().next().value;null!=e&&t.ignoredIds.delete(e)}return t.ignoredIds.set(n,Date.now()),!1}if("yes"===s&&!t.friendIds.has(n)){const i=t.profileCache.get(n),s=i?.value||i||null,l=[`lvl ${"number"==typeof s?.level?s.level:"?"}`];if(a?l.push(r):t.lockdown?l.push("instant-flood"):l.push("instant-level"),t.stats.seen++,t.stats.instant=(t.stats.instant||0)+1,pa({...e,profileId:n,text:o,meta:s,enqueuedAt:Date.now()},l),e?.conversationId||e?.conv){const o=Br(e)||Br(e.conv);o&&t.conversationJobs.set(o,{conversationId:o,conv:e.conv,profileId:n,source:"instant"}),_r(n,o)}else _r(n,"");return!1===t.leaveFirst&&!1===t.leaveOnBlock||Ia(),!0}if(t.queue.length>=rr)return t.stats.dropped++,Zr(),!1;t.queuedIds.add(n);const l={...e,profileId:n,text:o,enqueuedAt:Date.now()};return e?.priority||t.lockdown||Lr()?t.queue.unshift(l):t.queue.push(l),t.stats.seen++,!t.workerSlots.length&&t.enabled&&na(),Zr(),!0}function pa(e,t){const n=kr(),o=vr(e.profileId);if(!o||n.blockedIds.has(o)||n.friendIds.has(o))return;const i=e?.meta||n.profileCache.get(o)?.value||n.profileCache.get(o);if(i&&"number"==typeof i.level&&i.level>qr())return;if(!n.blockQueue.has(o)){if(n.stats.flagged++,n.blockQueue.size>=ir){const e=n.blockQueue.keys().next().value;null!=e&&n.blockQueue.delete(e)}n.blockQueue.set(o,{...e,reasons:t,attempts:0,retryAt:0})}const r=Br(e)||Br(e?.conv);_r(o,r),!1!==n.leaveFirst&&r&&(n.conversationJobs.set(r,{conversationId:r,conv:e?.conv,profileId:o,source:e?.source||"block"}),Ia()),ia(Pr()||n.lockdown),Zr()}async function ua(e){const t=kr();for(;!e.stop;){const n=t.queue.shift();if(!n){if(!(t.enabled||t.queue.length||t.blockQueue.size||ce.ops.dmSpamGuard.loading)){e.stop=!0;break}await wr(Lr()?40:180);continue}const o=n.profileId;if(t.queuedIds.delete(o),!(t.blockedIds.has(o)||t.friendIds.has(o)||t.blockQueue.has(o))){t.inflightIds.add(o);try{let e,i=n.text||"";const r=Hr(o);if("no"===r){if(t.stats.checked++,t.ignoredIds.size>800){const e=t.ignoredIds.keys().next().value;null!=e&&t.ignoredIds.delete(e)}t.ignoredIds.set(o,Date.now());continue}if("yes"===r){const n=t.profileCache.get(o);e=n?.value||n||null}else Pr()&&i||i?e=await ga(o):[e,i]=await Promise.all([ga(o),ha(n)]);e&&"number"==typeof e.level||(e=await ga(o));const a=Wr(e,i||n.text||"");if(t.stats.checked++,a.block)!1!==t.instantBlock&&(t.lockdown||Pr())&&(t.stats.instant=(t.stats.instant||0)+1),pa({...n,meta:e,text:i},a.reasons);else{if(t.ignoredIds.size>800){const e=t.ignoredIds.keys().next().value;null!=e&&t.ignoredIds.delete(e)}t.ignoredIds.set(o,Date.now())}}catch{t.stats.errors++}finally{t.inflightIds.delete(o),Zr()}}}const n=t.workerSlots.indexOf(e);n>=0&&t.workerSlots.splice(n,1)}async function fa(e,t){const n=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:e,variables:t})});if(!n.ok)throw new Error(`HTTP ${n.status}`);const o=await n.json();if(o?.errors?.[0]?.message)throw new Error(o.errors[0].message);return o}async function ma(){if(ce.accessToken&&ce.profileId)try{const e=await fa("query GetBlocked($profileId: String!){ blocked(profileId: $profileId) { nodes { profileId } } }",{profileId:ce.profileId}),t=kr();for(const n of e?.data?.blocked?.nodes||[]){const e=vr(n?.profileId);e&&t.blockedIds.add(e)}Zr()}catch{}}async function ga(e){const t=kr(),n=t.profileCache.get(e);if(n&&Date.now()-n.ts<Xi)return n.value;if(t.profileInflight.has(e))return t.profileInflight.get(e);const o=(async()=>{let n=null,o=null;try{const t=await fa("query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name avatar(preferredGameId: $gameId){ gameId } } }",{profileIds:[e],gameId:x});n=t?.data?.profiles?.[0]||null}catch{}try{const t=await cn(`${k}/experience/v1/experience/batch`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify([{gameId:x,profileId:e}])});if(t.ok){const e=await t.json(),n=Array.isArray(e)?e[0]?.experience:null;"number"==typeof n?.level&&(o=n.level)}}catch{}const i={id:e,name:n?.name||"",hasAvatar:n?!!n.avatar?.gameId:null,level:o,lookedUp:!!n};if(t.profileCache.size>800){const e=t.profileCache.keys().next().value;null!=e&&t.profileCache.delete(e)}return t.profileCache.set(e,{ts:Date.now(),value:i}),i})();t.profileInflight.set(e,o);try{return await o}finally{t.profileInflight.delete(e)}}async function ha(e){if(e.text)return e.text;if(Pr())return"";const t=Br(e);if(!t)return"";try{const e=Tr(await fo(`/gamemessaging/v1/conversations/${encodeURIComponent(t)}/history?page=1&pageSize=8`));for(let t=e.length-1;t>=0;t--){const n=e[t],o=Cr(n);if(o&&o===ce.profileId)continue;const i=Ir(n);if(i)return i}}catch{}return""}async function ya(){const e=kr();if(e.enabled&&!e.pollInFlight&&ce.accessToken){e.pollInFlight=!0;try{const e=Pr()?200:100;xa(await Po(e),"poll"),Qr()}catch{e.stats.errors++,Zr()}finally{e.pollInFlight=!1}}}async function ba(){const e=kr();if(e.enabled&&ce.accessToken)try{if(!Pr()||e.queue.length+e.blockQueue.size<20){const t=e.sweepPage||1,n=await Lo(t,200);n.length&&xa(n,"sweep"),e.sweepPage=n.length<200?1:t%5+1}}catch{e.stats.errors++}finally{if(Zr(),e.enabled&&ce.accessToken){const t=Pr()?2500:1500;e.sweepTimer=setTimeout(()=>{ba()},t)}}}function xa(e,t){if(!ce.accessToken||!kr().enabled&&"manual"!==t)return;const n=kr();n.seenConvIds||(n.seenConvIds=new Map);const o=function(e){if(Array.isArray(e))return e;if(!e||"object"!=typeof e)return[];for(const t of["conversations","Conversations","items","Items","data","Data"])if(Array.isArray(e[t]))return e[t];return[]}(e),i=Date.now();let r=0;for(const e of o){const o=Br(e);o&&n.conversationCache.set(o,e);const a=Number(e?.numberOfUnreadMessages??e?.NumberOfUnreadMessages??e?.numUnread??e?.NumUnread??0),s=Ir(e?.lastMessage||e?.LastMessage||e),l=zr(e);if(!l.length)continue;if("manual"!==t&&"sweep"!==t&&"lockdown"!==t&&a<=0&&!s)continue;const c=l.some(e=>!n.friendIds.has(e)&&!n.blockedIds.has(e));if(o&&c&&(a>0||"manual"===t||"lockdown"===t)){const e=n.seenConvIds.get(o)||0;(!e||i-e>1500)&&(n.seenConvIds.set(o,i),r++)}for(const i of l){if(n.friendIds.has(i)||n.blockedIds.has(i))continue;da({profileId:i,conversationId:o,conv:e,text:s,source:t,priority:!(!(n.lockdown||n.instantBlock&&Pr())||!(a>0||"lockdown"===t||"manual"===t||Nr(s)))})}if(n.conversationCache.size>800){const e=n.conversationCache.keys().next().value;null!=e&&n.conversationCache.delete(e)}}if(n.seenConvIds.size>1200)for(const[e,t]of n.seenConvIds)i-t>pr&&n.seenConvIds.delete(e);r>0&&"sweep"!==t&&(!function(e=1){const t=kr(),n=Date.now();Array.isArray(t.floodEvents)||(t.floodEvents=[]);for(let o=0;o<e;o++)t.floodEvents.push(n);t.lastFloodAt=n,t.stats.floodHits=(t.stats.floodHits||0)+e;const o=Vr();try{Gr()}catch{}try{bd?.()}catch{}t.autoLock&&t.enabled&&!t.lockdown&&o>=(t.floodThreshold||8)?Jr(o):t.lockdown&&(t.lastFloodAt=n)}(r),(n.lockdown||Pr())&&Ia()),Qr()}function ka(e,t,n){if(!kr().enabled||!e||!ce.accessToken)return;if(!String(e).includes("/gamemessaging/"))return;"GET"===String(t||"GET").toUpperCase()&&(/\/participants\/[^/]+\/conversations(?:[/?]|$)/i.test(e)?xa(n,"network"):Wt.test(e)&&function(e,t,n){if(!ce.accessToken||!kr().enabled&&"manual"!==n)return;const o=Tr(e),i=String(t||"").match(/\/conversations\/([^/?]+)\/history/i),r=i?decodeURIComponent(i[1]):"",a=r?kr().conversationCache.get(r):null,s=a?zr(a):[];for(const e of o){const t=Ir(e),o=Cr(e);if(o&&o!==ce.profileId)da({profileId:o,conversationId:r,conv:a,text:t,source:n});else if(!o&&s.length)for(const e of s)da({profileId:e,conversationId:r,conv:a,text:t,source:n})}}(n,e,"network"))}async function wa(){const e=kr();if(e.myUuid&&Date.now()-e.myUuidTs<6e5)return e.myUuid;const t=ce.profileId||"",n=t.replace(/-/g,"").toLowerCase();if(/^[0-9a-f]{32}$/.test(n))return e.myUuid=n,e.myUuidTs=Date.now(),n;try{const n=await cn(`${k}/profileidentity/v1/profiles/${encodeURIComponent(t)}`,{headers:{authorization:`Bearer ${ce.accessToken}`}});if(n.ok){const t=await n.json(),o=Array.isArray(t)?t[0]:t,i=(o?.login||o?.id||"").replace(/-/g,"").toLowerCase();if(/^[0-9a-f]{32}$/.test(i))return e.myUuid=i,e.myUuidTs=Date.now(),i}}catch{}return null}async function va(e){const t=await wa();if(!t)return{ok:!1,status:0,error:"UUID cozulemedi"};const n=e.replace(/-/g,"").toLowerCase();if(!/^[0-9a-f]{32}$/.test(n))return{ok:!1,status:0,error:"hedef UUID gecersiz"};const o=`mutation SpamEngel{ reportProfile(gameId: "${x}" profileIdToReport: "${n}" reason: "NoReason" location: "tr-TR") blockProfile(profileId: "${t}" profileIdToBlock: "${n}") }`;try{const e=await cn(`${k}/edgereports/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json",accept:"application/json",origin:"https://moviestarplanet2.com",referer:"https://moviestarplanet2.com/","x-msp-game-id":x},body:JSON.stringify({query:o,variables:{}})});if(429===e.status)return{ok:!1,status:429,rateLimited:!0};if(!e.ok)return{ok:!1,status:e.status};const t=await e.json();return t?.data?.blockProfile?{ok:!0,status:200}:t?.data?.reportProfile?{ok:!0,status:200,reportOnly:!0}:{ok:!1,status:200,error:JSON.stringify(t?.errors||t).substring(0,200)}}catch(e){return{ok:!1,status:0,error:String(e).substring(0,120)}}}async function Sa(){const e=kr();if(e.blockFlushRunning||!ce.accessToken||!ce.profileId)return;const t=Date.now();if(e.blockCooldownUntil&&e.blockCooldownUntil>t)return;const n=[];for(const[o,i]of e.blockQueue)if(!(i.retryAt&&i.retryAt>t)&&(n.push([o,i]),n.length>=Dr()))break;if(n.length){e.blockFlushRunning=!0;try{await wa();const t=Er();for(let o=0;o<n.length&&(e.enabled||e.blockQueue.size);o+=t){const i=n.slice(o,o+t).map(async([t,n])=>{if(e.blockedIds.has(t)||e.friendIds.has(t))return e.blockQueue.delete(t),{pid:t,job:n,result:{ok:!1,already:!0}};return{pid:t,job:n,result:await va(t)}}),r=await Promise.all(i);let a=!1;for(const{pid:t,job:n,result:o}of r)if(!o.already)if(o.ok){if(e.blockQueue.delete(t),e.blockedIds.add(t),e.stats.blocked++,"friend-request"===n.source&&(e.stats.blockedFr=(e.stats.blockedFr||0)+1),e.stats.blocked%200==0)try{gd?.("block")}catch{}Ca(n)}else if(o.rateLimited){n.attempts=(n.attempts||0)+1;const o=Math.min(2e4,4e3*n.attempts);n.retryAt=Date.now()+o,e.blockCooldownUntil=n.retryAt,e.blockQueue.set(t,n),e.stats.rateLimited++,a=!0}else n.attempts=(n.attempts||0)+1,n.attempts>=3?(e.blockQueue.delete(t),e.stats.errors++,un(`[dm-block-failed:${o.status||"no-status"}] ${t}`)):(n.retryAt=Date.now()+2500*n.attempts,e.blockQueue.set(t,n));if(Zr(),a)break;!Pr()&&o+t<n.length&&await wr(15)}}finally{e.blockFlushRunning=!1,e.enabled||e.blockQueue.size||!e.flushTimer||(clearInterval(e.flushTimer),e.flushTimer=null),!e.blockQueue.size||!e.enabled||e.blockCooldownUntil>Date.now()||ia(Pr()),Zr()}}}function Ca(e){const t=Br(e);if(!t)return;kr().conversationJobs.set(t,e),Ia()}async function Ia(){const e=kr();if(!e.backgroundRunning){e.backgroundRunning=!0;try{for(;e.conversationJobs.size;){const t=jr(),n=[];for(const[o,i]of e.conversationJobs)if(n.push([o,i]),e.conversationJobs.delete(o),n.length>=t)break;await Promise.all(n.map(async([t,n])=>{const o=vr(n?.profileId);_r(o,t);const i=!1!==e.leaveOnBlock&&(!1!==e.leaveFirst||e.lockdown||"max"===e.mode||"lockdown"===n?.source||"lockdown-mute"===n?.source||"instant"===n?.source||"block"===n?.source||o&&e.blockedIds.has(o)||o&&e.blockQueue.has(o));if(i&&!1!==e.leaveFirst)try{await Eo({conversationId:t}),e.stats.left=(e.stats.left||0)+1,e.stats.leftFirst=(e.stats.leftFirst||0)+1,e.conversationCache.delete(t),e.seenConvIds?.delete?.(t)}catch{}try{await Ao({conversationId:t,muted:!0}),e.stats.muted++}catch{try{await Mo({conversationId:t,muted:!0})}catch{}}if(i&&!1===e.leaveFirst)try{await Eo({conversationId:t}),e.stats.left=(e.stats.left||0)+1,e.conversationCache.delete(t),e.seenConvIds?.delete?.(t)}catch{}})),Pr()||await wr(10)}}finally{e.backgroundRunning=!1,Zr()}}}function $a(){const e=kr();e.rejectFrTimer&&(clearInterval(e.rejectFrTimer),e.rejectFrTimer=null),e.enabled&&e.autoRejectFriends&&(e.rejectFrTimer=setInterval(()=>{za().catch(()=>{})},yr))}function Ba(){const e=kr();e.blockFrTimer&&(clearInterval(e.blockFrTimer),e.blockFrTimer=null),e.enabled&&e.autoBlockFriends&&(e.blockFrTimer=setInterval(()=>{Ta().catch(()=>{})},br))}async function za(){const e=kr();if(e.enabled&&e.autoRejectFriends&&ce.accessToken&&ce.profileId&&!e._rejectFrRunning){e._rejectFrRunning=!0;try{const t=await To();if(!t.length)return;const n=t.slice(0,80),o=Math.min(40,Math.max(8,Math.floor(Er()/3)));for(let t=0;t<n.length&&(e.enabled&&e.autoRejectFriends);t+=o){const i=n.slice(t,t+o);await Promise.all(i.map(async t=>{try{await lo(`/profilerelationships/v2/profiles/${encodeURIComponent(t)}/relationships/requests/${encodeURIComponent(ce.profileId)}`,{profileId:ce.profileId,state:"rejected"}),e.stats.rejectedFr=(e.stats.rejectedFr||0)+1}catch{}}))}Zr()}catch{}finally{e._rejectFrRunning=!1}}}async function Ta(){const e=kr();if(e.enabled&&e.autoBlockFriends&&ce.accessToken&&ce.profileId&&!e._blockFrRunning){e._blockFrRunning=!0;try{const t=await To();if(!t.length)return;const n=t.slice(0,80),o=await async function(e){const t=new Map;if(!Array.isArray(e)||!e.length||!ce.accessToken)return t;for(let n=0;n<e.length;n+=80){const o=e.slice(n,n+80),i=o.map(e=>({gameId:x,profileId:e}));try{const e=await cn(`${k}/experience/v1/experience/batch`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify(i)});if(!e.ok)continue;const n=await e.json();if(!Array.isArray(n))continue;for(let e=0;e<n.length;e++){const i=n[e]?.experience,r="number"==typeof i?.level?i.level:null,a=vr(n[e]?.profileId)||o[e];a&&t.set(a,r)}}catch{}}return t}(n),i=qr();for(const t of n){const n=o.get(vr(t));null==n||n>i||(e.blockedIds.has(vr(t))||e.friendIds.has(vr(t))||pa({profileId:t,source:"friend-request",meta:{level:n}},[`friend-request-lvl-${n}`]))}ia(!0),Zr()}catch{}finally{e._blockFrRunning=!1}}}async function La(){Fo()&&await _o("dmSpamGuard",async()=>{kr();ra(),await Promise.all([ma().catch(()=>{}),aa().catch(()=>{})]);const e=await Po(200);xa(e,"manual"),ia(!0),Zr(),e.length?cd(`${e.length} okunmamis DM aninda isleme alindi`,"success"):cd("Okunmamis DM yok","info")}).catch(e=>cd(`Spam engelleme basarisiz: ${e.message}`,"error"))}async function Pa(){Fo()&&await _o("dmSpamGuard",async()=>{kr();ra(),await Promise.all([ma().catch(()=>{}),aa().catch(()=>{})]);const e=await async function(e=10){const t=[];for(let n=1;n<=Math.max(1,Math.min(e,10));n++){const e=await Lo(n,200);if(!e.length)break;if(t.push(...e),e.length<200)break}return t}(5);xa(e,"manual"),ia(!0),Zr(),e.length?cd(`${e.length} konusma DM gecmisinden isleme alindi`,"success"):cd("DM gecmisi bos","info")}).catch(e=>cd(`Spam engelleme basarisiz: ${e.message}`,"error"))}function Ma(){if(!Fo())return;const e=kr();e.enabled||sa(!0),e.autoLock=!0,e.lockdown?(Xr().catch(()=>{}),ia(!0),cd("Lockdown zaten acik \u2014 burst yenilendi","info")):Jr(e.floodThreshold||8)}function Aa(){const e=kr();Object.assign(e.stats,{seen:0,checked:0,flagged:0,blocked:0,muted:0,left:0,lockdowns:0,floodHits:0,instant:0,shielded:0,leftFirst:0,rejectedFr:0,blockedFr:0,errors:0,rateLimited:0,dropped:0}),Zr(),cd("Spam istatistikleri sifirlandi","info")}function Ea(){return""}function Da(e){const t=al("div",{fontFamily:Zs.sans,fontSize:"9px",fontWeight:"700",color:"#c4b5fd",marginBottom:"5px",letterSpacing:".08em",textTransform:"uppercase",opacity:".92"});return t.textContent=e,t}function ja(){const e=kr();if(Pc.dmSpamGuardBadge&&(Pc.dmSpamGuardBadge.textContent=Ea()),Pc.dmSpamAutoToggle?._setChecked&&Pc.dmSpamAutoToggle._getChecked?.()!==!!e.enabled&&Pc.dmSpamAutoToggle._setChecked(!!e.enabled),Pc.dmSpamGuardBtn&&(ce.ops.dmSpamGuard.loading&&ce.accessToken?Pc.dmSpamGuardBtn.setLoading(!0):(Pc.dmSpamGuardBtn.setLoading(!1),Pc.dmSpamGuardBtn.setDisabled(!ce.accessToken))),Pc.dmSpamAllBtn&&(ce.ops.dmSpamGuard.loading&&ce.accessToken?Pc.dmSpamAllBtn.setLoading?.(!0):(Pc.dmSpamAllBtn.setLoading?.(!1),Pc.dmSpamAllBtn.setDisabled?.(!ce.accessToken))),Pc.dmSpamLockBtn&&Pc.dmSpamLockBtn.setDisabled?.(!ce.accessToken),Pc.dmSpamStatus){const t=e.enabled?re("state_on_u"):re("state_off_u"),n=e.lockdown?`LOCKDOWN ${Math.round((Date.now()-(e.lockdownSince||Date.now()))/1e3)}s`:e.mode||"normal",o=Vr(),i=e.queue.length,r=e.blockQueue.size,a=e.inflightIds.size,s=e.workerSlots.length,l=!1!==e.gameShield?re("state_on_tag"):re("state_off_tag"),c=!1!==e.leaveFirst?re("state_on_tag"):re("state_off_tag"),d=e.autoRejectFriends?re("state_on_tag"):re("state_off_tag"),p=e.autoBlockFriends?re("state_on_tag"):re("state_off_tag");Pc.dmSpamStatus.textContent=re("spam_status_body",{auto:t,mode:n,shield:l,blocked:(e.stats&&e.stats.blocked)||0,muted:(e.stats&&e.stats.muted)||0,left:(e.stats&&e.stats.left)||0})+(e.blockFlushRunning?" | "+re("spam_status_flush"):"")+(e.blockCooldownUntil>Date.now()?" | "+re("spam_status_cooldown",{n:Math.ceil((e.blockCooldownUntil-Date.now())/1e3)}):""),Pc.dmSpamStatus.style.color=e.lockdown?Zs.err||"#f87171":"max"===e.mode&&e.enabled?"#fbbf24":e.enabled?Zs.acc:Zs.sub,Pc.dmSpamStatus.style.whiteSpace="pre-wrap"}try{bd?.()}catch{}}const Fa=new Set(["pet:pets","pet:spawn","pet:remove"]);function _a(e){let t=String(e||"").trim();return t?(t=t.replace(/^msp2_pet_/i,"").replace(/_prop$/i,""),t=t.replace(/_/g," "),t||e):"?"}function Ra(e){if(!e||"object"!=typeof e)return null;const t=String(e.itemId||e.ItemId||"").trim(),n=String(e.prefabPath||e.PrefabPath||"").trim();if(!t&&!n)return null;return{itemId:t,prefabPath:n,sessionId:e.sessionId??e.SessionId??null,colors:Array.isArray(e.colors)?e.colors.map(String):Array.isArray(e.Colors)?e.Colors.map(String):[],propId:e.propId??e.PropId??null,animation:String(e.animation||e.Animation||"idle"),direction:e.direction??e.Direction??1,position:e.position||e.Position||null}}function Oa(e){if(null==e||""===e)return{pid:null,name:""};const t=[e],n=Number(e);Number.isFinite(n)?t.push(n,String(n)):t.push(String(e));for(const e of t){const t=Qn(e);if(t?.pid)return{pid:t.pid,name:String(t.user?.name||"").trim()}}try{for(const[t,n]of ce.chatroomUsers)if(null!=n?.sessionId&&String(n.sessionId)===String(e))return{pid:t,name:String(n.name||"").trim()}}catch{}return{pid:null,name:""}}function Ua(e,t){return e.itemId?`id:${e.itemId}`:t&&e.prefabPath?`pf:${t}:${e.prefabPath}`:null!=e.sessionId&&e.prefabPath?`ss:${e.sessionId}:${e.prefabPath}`:`ts:${Date.now()}:${Math.random().toString(36).slice(2,8)}`}function Na(e,t,n){if(!e)return;const o=Ua(e,t),i=ce.petClone.captures,r=i.get(o);if(i.set(o,{ts:Date.now(),key:o,profileId:t||r?.profileId||null,name:n||r?.name||"Unknown",itemId:e.itemId||r?.itemId||"",prefabPath:e.prefabPath||r?.prefabPath||"",colors:e.colors?.length?e.colors:r?.colors||[],propId:e.propId??r?.propId??null,sessionId:e.sessionId??r?.sessionId??null,animation:e.animation||r?.animation||"idle",direction:e.direction??r?.direction??1,position:e.position||r?.position||null,label:_a(e.prefabPath||r?.prefabPath||"")}),i.size>100){let e=null,t=1/0;for(const[n,o]of i)o.ts<t&&(t=o.ts,e=n);e&&i.delete(e)}try{Ga()}catch{}}function qa(e){if(null==e)return;const t=ce.petClone.captures;let n=!1;for(const[o,i]of[...t.entries()])null!=i.sessionId&&String(i.sessionId)===String(e)&&(t.delete(o),n=!0);if(n)try{Ga()}catch{}}function Ha(e){if(Array.isArray(e))for(const t of e){const e=Ra(t);if(!e)continue;const n=Oa(e.sessionId);Na(e,n.pid,n.name)}}function Wa(e){if(!e||"object"!=typeof e)return;if(!1===e.success)return;const t=Ra(e);if(!t)return;const n=Oa(t.sessionId);Na(t,n.pid,n.name)}function Ga(){try{Pc.petCloneList&&function(e){if(!Zs)return void(e.innerHTML="");e.innerHTML="";const t=ce.petClone.captures;if(!t.size){const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,padding:"12px 8px",textAlign:"center"});return t.textContent="Henuz pet yakalanmadi. Odaya gir veya biri pet cikarsin (pet:pets / pet:spawn).",void e.appendChild(t)}const n=[...t.entries()].sort((e,t)=>t[1].ts-e[1].ts);for(const[t,o]of n){const n=al("div",{display:"flex",alignItems:"center",gap:"8px",padding:"6px 8px",cursor:"pointer",borderBottom:`1px solid ${Zs.bdrSub}`,transition:"background 0.12s"});n.addEventListener("mouseenter",()=>{n.style.background=Zs.sur}),n.addEventListener("mouseleave",()=>{n.style.background=""});const i=al("div",{flex:"1",minWidth:"0"}),r=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",color:Zs.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"});r.textContent=o.label||o.prefabPath||o.itemId||t,i.appendChild(r);const a=al("div",{fontFamily:Zs.mono,fontSize:"9px",color:Zs.sub,marginTop:"2px"}),s=o.name||(o.profileId?String(o.profileId).slice(0,8):"owner?"),l=o.itemId?o.itemId.slice(0,10):"?";a.textContent=`${s} | ${l}`,i.appendChild(a),n.appendChild(i);const c=al("button",{padding:"3px 8px",fontSize:"10px",fontFamily:Zs.sans,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",color:Zs.acc,cursor:"pointer",whiteSpace:"nowrap"});c.textContent="Uygula",c.addEventListener("click",e=>{e.stopPropagation(),ss(t)}),n.appendChild(c),n.addEventListener("click",()=>{o.profileId&&Nl(o.profileId)}),e.appendChild(n)}}(Pc.petCloneList)}catch{}}function Va(e){try{return JSON.stringify(e||{}).toLowerCase()}catch{return""}}function Ka(e){if(!e||"object"!=typeof e)return!1;const t=Va(e);if(/msp2_pet_|pet_inventory|petinventory|\"pet\"|'pet'|type\":\"pet|slot\":\"pet|\bpet\b/.test(t))return!0;{const t=Ci(e);if(/pet|animal|creature|familiar|companion/i.test(t))return!0}return!1}function Ja(e){if(!e||"object"!=typeof e)return"";const t=e.additionalData||{},n=t.MSP2Data&&"object"==typeof t.MSP2Data?t.MSP2Data:{},o=t.NebulaData&&"object"==typeof t.NebulaData?t.NebulaData:{},i=[e.prefabPath,e.PrefabPath,e.graphicsResourceId,e.GraphicsResourceId,n.prefabPath,n.PrefabPath,n.graphicsResourceId,n.GraphicsResourceId,n.Prefab,n.prefab,o.prefabPath,o.PrefabPath,t.prefabPath,t.PrefabPath,t.graphicsResourceId];for(const e of i){const t=String(e||"").trim();if(t&&/pet/i.test(t))return t}const r=Va(e).match(/msp2_pet_[a-z0-9_]+(?:_prop)?/i);return r?r[0]:""}async function Ya(e){if(!e)return null;const t=await Si();if(!Array.isArray(t)||!t.length)return null;const n=(e,t)=>{const n=String(e?.id||"").trim();return n?{id:n,match:t,prefabPath:Ja(e)||""}:null};if(e.itemId)for(const o of t)if(String(o?.id||"").trim()===String(e.itemId))return n(o,"exact");let o="";if(e.profileId&&e.itemId)try{const t=await vi(e.profileId,[e.itemId]);t?.[0]&&(o=Ii(t[0]))}catch{}if(o)for(const e of t){const t=Ii(e);if(t&&t===o){const t=n(e,"template");if(t)return t}}const i=String(e.prefabPath||"").trim().toLowerCase();if(i){for(const e of t)if(Va(e).includes(i)){const t=n(e,"prefab");if(t)return t}const e=i.replace(/^msp2_pet_/,"").replace(/_prop$/,"");if(e&&e.length>=6)for(const o of t)if(Va(o).includes(e)){const e=n(o,"prefab");if(e)return e}}const r=[];for(const e of t)Ka(e)&&r.push(e);if(r.length){r.sort((e,t)=>(Ja(e)?0:1)-(Ja(t)?0:1));const e=n(r[0],"any");if(e)return e}return null}const Qa=[];function Xa(){try{const e=ce.chatroomUsers?.get?.(ce.profileId);if(null!=e?.sessionId&&""!==e.sessionId)return e.sessionId}catch{}try{for(const[e,t]of ce.chatroomUsers||[])if(String(e).toLowerCase()===String(ce.profileId||"").toLowerCase()&&null!=t?.sessionId)return t.sessionId}catch{}return null}function Za(e){const t=ce.lastRoomPosition,n=(t&&t.position?t.position:null)||(e?.position||null)||{x:0,y:0,z:0};return{x:(Number(n.x)||0)+.55,y:Number(n.y)||0,z:(Number(n.z)||0)+.15}}function es(e,t){const n=ce.chatroomSocket;if(!n||1!==n.readyState)return!1;try{return n.send(`42${JSON.stringify([e,t??{}])}`),!0}catch{return!1}}function ts(e,t){const n=ce.chatroomSocket;if(!n||1!==n.readyState)return!1;const o="42"+JSON.stringify(["message",{messageType:e,messageContent:{...t||{},_axSynthetic:1}}]);try{return n.dispatchEvent(new MessageEvent("message",{data:o,origin:""})),!0}catch{return!1}}function ns(e){if(!Qa.length)return;const t=Qa.splice(0,Qa.length);for(const n of t)try{n(e)}catch{}}function os(e,t,n){const o=String(e?.prefabPath||"").trim();if(!o)return{ok:!1,reason:"prefabPath yok"};const i=Xa();if(null==i)return{ok:!1,reason:"sessionId yok (odada misin?)"};const r=n||Za(e),a=2===Number(e?.direction)?2:1,s=Array.isArray(e?.colors)?e.colors.map(String):[],l=String(e?.animation||"idle"),c=String(t||e?.itemId||"").trim(),d=null!=e?.propId?Number(e.propId):0,p=ts("pet:spawn",{success:!0,errorReason:null,sessionId:i,prefabPath:o,position:r,direction:a,itemId:c,propId:Number.isFinite(d)?d:0,animation:l,colors:s}),u={sessionId:i,prefabPath:o,position:r,destination:r,direction:a,animation:l,itemId:c,propId:Number.isFinite(d)?d:0,colors:s},f=ts("pet:pets",{pets:[u]});return p||f?(Na(Ra(u),ce.profileId,ce.profileName||"You"),{ok:!0,sessionId:i,local:!0}):{ok:!1,reason:"WS inject basarisiz"}}function is(e){const t=e||ce.chatroomSocket;if(t&&1===t.readyState)try{t.send(`42${JSON.stringify(["pet:pets",{}])}`)}catch{}}async function rs(e,t,n,o,i){es("pet:remove",{}),await dn(.12,.25);const r=function(e=2500){return new Promise(t=>{let n=!1;const o=e=>{if(n)return;n=!0,clearTimeout(i);const r=Qa.indexOf(o);r>=0&&Qa.splice(r,1),t(e||null)},i=setTimeout(()=>o(null),e);Qa.push(o)})}(2800);if(!es("pet:spawn",{itemId:e,prefabPath:t||"",position:n,direction:o,animation:i}))return{ok:!1,note:"pet:spawn gonderilemedi",err:"send_fail",respPrefab:"",respItemId:""};return function(e,t,n){if(!e||"object"!=typeof e)return{ok:!1,note:"spawn yaniti gelmedi (timeout)",err:"",respPrefab:"",respItemId:""};const o=String(e.errorReason||e.ErrorReason||"").trim(),i=String(e.prefabPath||e.PrefabPath||"").trim(),r=String(e.itemId||e.ItemId||"").trim(),a=!1===e.success||!1===e.Success,s=!0===e.success||!0===e.Success,l=!(!i&&!r&&null==e.sessionId&&null==e.SessionId);return a?{ok:!1,note:o?`sunucu reddetti: ${o}`:"sunucu spawn reddetti",err:o||"success=false",respPrefab:i,respItemId:r}:s||l&&!1!==e.success&&!1!==e.Success?(Wa({...e,sessionId:e.sessionId??e.SessionId??Xa(),prefabPath:i||t,itemId:r||n}),{ok:!0,note:"",err:"",respPrefab:i,respItemId:r}):o?{ok:!1,note:`sunucu reddetti: ${o}`,err:o,respPrefab:i,respItemId:r}:{ok:!1,note:"spawn yaniti belirsiz",err:"",respPrefab:i,respItemId:r}}(await r,t,e)}async function as(e,t={}){const n=String(e.itemId||"").trim(),o=String(e.prefabPath||"").trim(),i=e.label||_a(o)||n.slice(0,8)||"?";let r=null;if(!t.skipOwnedLookup)try{r=await Ya(e)}catch{r=null}const a=r?.id||null;if(a){const e=JSON.stringify({PetInventoryId:a}),t=await Do();await dn(.25,.55),await jo({...t,additionalData:{...t.additionalData||{},EquippedPet:e}})}const s=Za(e),l=2===Number(e.direction)?2:1,c=String(e.animation||"idle"),d=Array.isArray(e.colors)?e.colors.map(String):[],p=!(!ce.chatroomSocket||1!==ce.chatroomSocket.readyState);let u=!1,f=!1,m="",g="",h="none",y=a||n,b=o;const x=!r||"exact"!==r.match&&"template"!==r.match;if(!p)return m=a?"EquippedPet yazildi; oda WS yok \u2014 odaya girip tekrar Uygula":"oda WS yok ve sahip pet yok \u2014 once bir pet edin veya odaya gir",{equipId:y,soft:x,spawnOk:!1,localOk:!1,label:i,note:m,serverErr:g,mode:h,multiplayer:!1};if(r?.id&&o){const e=await rs(r.id,o,s,l,c);if(e.ok){const t=e.respPrefab||o,n=!e.respPrefab||e.respPrefab.toLowerCase()===o.toLowerCase();u=!0,h=n?"exact"===r.match||"template"===r.match?"owned":"spoof":"owned-natural",y=r.id,b=t,m=n?"any"===r.match||"prefab"===r.match?"sunucu spoof kabul (owned itemId + hedef prefab) \u2014 herkes gorur":"sunucu spawn OK (owned)":`sunucu prefab ezdi (hedef degil): ${t}`}else g=e.err||"",m=e.note||""}if(!u&&n&&o&&(!r||r.id!==n)){const e=await rs(n,o,s,l,c);e.ok?(u=!0,h="foreign-accepted",y=n,b=e.respPrefab||o,m="sunucu yabanci itemId kabul etti"):m||(g=e.err||g,m=e.note||m)}if(!u&&r?.id){const e=r.prefabPath||"";if(!o||e.toLowerCase()!==o.toLowerCase()||!o){const t=await rs(r.id,e,s,l,c);t.ok?(u=!0,h="owned-natural",y=r.id,b=t.respPrefab||e,m=o?`spoof reddi; kendi petin yayinlandi (${b||"owned"}) \u2014 hedef degil`:"kendi petin sunucu spawn OK"):m||(g=t.err||g,m=t.note||m)}}if(!u&&o){await dn(.08,.15);const t=r?.id||n||"local",i=os({...e,prefabPath:o,colors:d,direction:l,animation:c},t,s);f=!!i.ok,f?(h="local-only",m=r?.id?"local gosterim (sunucu spoof reddi; baskalarina yok \u2014 canta/grant yok)":"local gosterim (sahip pet yok; baskalarina yok \u2014 once bir pet al)"):i.reason&&(m=(m?m+" | ":"")+i.reason)}else u||o||(m=(m?m+" | ":"")+"prefabPath yok \u2014 odada pet yakala (liste) sonra Uygula");if(u&&"owned-natural"===h&&o){await dn(.05,.1);os({...e,prefabPath:o,colors:d,direction:l,animation:c},y,s).ok&&(f=!0,m=(m?m+" | ":"")+"ustune local hedef pet (sadece sen; baskasi sunucu petini gorur)")}return{equipId:y,soft:x,spawnOk:u,localOk:f,label:i,note:m,serverErr:g,mode:h,multiplayer:!!u,anchorMatch:r?.match||null,usedPrefab:b}}async function ss(e){if(!Fo())return;const t=ce.petClone.captures.get(e);t&&(t.itemId||t.prefabPath)?await _o("petClone",async()=>{cd("Pet soft uygulaniyor\u2026","info");const e=await as(t),{spawnOk:n,localOk:o,label:i,note:r,mode:a,multiplayer:s}=e;!s||"spoof"!==a&&"owned"!==a&&"foreign-accepted"!==a?s&&"owned-natural"===a?cd(`Pet sunucu OK ama hedef degil: ${i}${r?` | ${r}`:""}`,"warn"):o?cd(`Pet yanda (sadece sen): ${i}${r?` | ${r}`:""}`,"warn"):cd(`Pet basarisiz: ${i}${r?` | ${r}`:""}`,"error"):cd(`Pet HERKESE: ${i}${r?` | ${r}`:""}`,"success")}).catch(e=>cd(String(e?.message??e??"Pet uygulanamadi"),"error")):cd("Pet verisi bulunamadi \u2014 once odada pet ciksin veya nickten cek","error")}function ls(e,t,n){try{const o=!(!t||!t._axSynthetic)||!(!t?.messageContent||!t.messageContent._axSynthetic);if("pet:pets"===e){const e=t?.pets||t?.Pets||(Array.isArray(t)?t:null);return void(e&&Ha(e))}if("pet:spawn"===e)return o||ns(t),void Wa(t);if("pet:remove"===e){const e=t?.sessionId??t?.SessionId;return void(null!=e&&qa(e))}if("message"!==e)return;const i=String(t?.messageType??""),r=t?.messageContent??{},a=!(!r||!r._axSynthetic);if("2000"===i&&r&&!0===r.success){try{is(n)}catch{}return}if(!Fa.has(i)&&"pet:spawn"!==i&&"pet:pets"!==i&&"pet:remove"!==i&&!i.startsWith("pet:"))return;if("pet:pets"===i){const e=r.pets||r.Pets||(Array.isArray(r)?r:null);return void(e&&Ha(e))}if("pet:spawn"===i){const e=r&&(r.itemId||r.prefabPath||r.pets||"success"in r||"Success"in r)?r:t;return a||ns(e),Wa(e),void(Array.isArray(r?.pets)&&Ha(r.pets))}if("pet:remove"===i){const e=r.sessionId??r.SessionId??t?.sessionId;null!=e&&qa(e)}}catch{}}async function cs(){try{const e=ce.lastRoomPosition;if(!(e&&e.roomType&&e.position&&ce.accessToken))return;const t={ChatRoomPositionData:JSON.stringify(e)};await lo(`/profileattributes/v1/profiles/${encodeURIComponent(ce.profileId)}/games/${x}/attributes`,t),un("[relogin-tp] konum yazildi"),cd("Oda konumu yazildi \u2014 odaya tekrar girince aktif olur","info")}catch{}}function ds(e){return $o(e)}function ps(e,t){let n=String(e||t||"home").trim().toLowerCase();return n=n.replace(/[^a-z0-9_\-]+/g,"_").replace(/^_+|_+$/g,""),n||t||`home_${Date.now().toString(36)}`}function us(e){if(!e?.name||!e?.bson_data)return!1;const t=p.findIndex(t=>t.name===e.name);t>=0?p[t]={...p[t],...e,bundled:!1}:p.push({...e,bundled:!1});try{const __d=__hd(),__i=__d.indexOf(e.name);if(__i>=0){__d.splice(__i,1);H(_.homesDeleted,__d)}}catch{}try{Q(p)}catch{}try{Z(e.name)}catch{}return!0}function fs(){try{if(Pc.homesCountEl){Pc.homesCountEl.textContent="";try{if(Pc.homesFoldCount)Pc.homesFoldCount.textContent=String(p.filter(x=>x&&x.name&&!__hd().includes(x.name)).length)}catch{}}}catch{}}function ms(e,t){if(!e||!e.style)return;t?(e.style.background=Zs.accDim||"rgba(99,102,241,0.18)",e.style.border=`2px solid ${Zs.acc||"#818cf8"}`,e.style.boxShadow=`0 0 0 1px ${Zs.acc||"#818cf8"}, 0 0 16px ${Zs.accGlow||"rgba(129,140,248,0.45)"}`,e.style.borderRadius="10px"):(e.style.background="transparent",e.style.border="2px solid transparent",e.style.boxShadow="none",e.style.borderRadius="8px");const n=e._selMark;n&&(n.style.display=t?"flex":"none")}function gs(e){if(!e||"string"!=typeof e)return"";if(e.startsWith("data:"))return e;let t="image/png";return e.startsWith("/9j/")?t="image/jpeg":e.startsWith("R0lGOD")?t="image/gif":e.startsWith("UklGR")&&(t="image/webp"),`data:${t};base64,${e}`}async function hs(e){const t=String(e||"").trim();if(!t)throw new Error("DefaultMyHome bos");const n=await so(`/profilegeneratedcontent/v2/profiles/content/${encodeURIComponent(t)}`);if(!n)throw new Error("Ev UGC meta yok");const o=zo(n,"PgcV1");if(!o)throw new Error("PgcV1 kaynak yok");const i=await cn(`${w}/${o}`,{method:"GET"});if(!i.ok)throw new Error(`CDN HTTP ${i.status}`);const r=new Uint8Array(await i.arrayBuffer());if(!r.length)throw new Error("PGC bos");let a="";try{const e=zo(n,"snapshot");if(e){const t=await cn(`${w}/${e}`,{method:"GET"});t.ok&&(a=ds(new Uint8Array(await t.arrayBuffer())))}}catch{}return{pgcBytes:r,img:a,title:String(n.title||n.name||"").trim(),meta:n}}async function ys(e){const t=String(e||"").trim();if(!t)return null;try{const e=await Ul(t);if(Array.isArray(e)&&e.length){const n=t.toLowerCase(),o=e.find(e=>{const t=String(e.name||"").toLowerCase();return t===n||t.endsWith("|"+n)||t.split("|").pop()===n});return(o||e[0])?.id||null}}catch{}try{const e=await cn(`${k}/profileidentity/v1/profiles/${encodeURIComponent(t)}`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(e.ok){const t=await e.json(),n=Array.isArray(t)?t[0]:t,o=String(n?.id||n?.profileId||"").trim();if(o)return o}}catch{}return null}async function bs(e){const t=await cn(`${k}/profileattributes/v1/profiles/${encodeURIComponent(e)}/games/${x}/attributes`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(!t.ok)throw new Error(`attrs HTTP ${t.status}`);const n=await t.json();return String(n?.additionalData?.DefaultMyHome||"").trim()}async function xs(e){if(!Fo())return;const t=String(e||"").trim();t?await _o("homes",async()=>{const e=await async function(e){let t=p.find(t=>t.name===e);if(!t)throw new Error("Ev bulunamadi");if(t.bson_data)return t;if(cd(`Ev yukleniyor: ${e}\u2026`,"info"),t=await y(e),!t?.bson_data)throw new Error("Evde bson_data yok");return t}(t);await dn(.8,1.6);const n=await Do(),o=n?.additionalData?.DefaultMyHome;if(!o)throw new Error("DefaultMyHome yok \u2014 once kendi evini olustur");const i=Io(function(e){const t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);return n}(e.bson_data),"Room",null,"Public"),r=await Bo(i);await dn(.4,.9);const a=await cn(`${k}/profilegeneratedcontent/v2/profiles/${ce.profileId}/games/${x}/content/${o}`,{method:"PUT",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/bson",signature:r},body:i});if(!a.ok)throw new Error(`Upload failed: HTTP ${a.status}`);cd(`Ev ayarlandi: ${t}`,"success")}).catch(e=>cd(e.message??"Home update failed","error")):cd("Once bir ev sec","error")}async function ks(e){if(!Fo())return;const t=String(e||"").trim();t?await _o("homes",async()=>{cd(`Ev cekiliyor: ${t}\u2026`,"info");const e=await ys(t);if(!e)throw new Error("profil bulunamadi (region/nick?)");await dn(.25,.5);const n=await bs(e);if(!n)throw new Error("hedefte DefaultMyHome yok");await dn(.25,.5);const{pgcBytes:o,img:i}=await hs(n);let r=ps(`ev_${Date.now().toString(36)}`,"ev");p.some(e=>e.name===r)&&(r=ps(`ev_${t}_${Date.now().toString(36)}`,r)),us({name:r,img:i||"",bson_data:ds(o),sourceNick:t,sourceProfileId:e,sourceHomeId:n,harvestedAt:Date.now()}),Pc.homesSel&&(Pc.homesSel.value=r);try{Z(r)}catch{}vs(),Pc.homesPreviewUpdate&&Pc.homesPreviewUpdate(),await dn(.4,.8);const a=await Do(),s=a?.additionalData?.DefaultMyHome;if(!s)throw new Error("DefaultMyHome yok \u2014 once kendi evini olustur");const l=Io(o,"Room",null,"Public"),c=await Bo(l);await dn(.3,.6);const d=await cn(`${k}/profilegeneratedcontent/v2/profiles/${ce.profileId}/games/${x}/content/${s}`,{method:"PUT",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/bson",signature:c},body:l});if(!d.ok)throw new Error(`Upload failed: HTTP ${d.status}`);cd(`Ev cekildi + uygulandi: ${r}`,"success")}).catch(e=>cd(String(e?.message??e??"Ev cekilemedi"),"error")):cd("Nick veya profileId yaz","error")}async function ws(e){if(!Fo())return;const t=String(e||"").trim();t?await _o("homesHarvest",async()=>{cd(`Ev cekiliyor: ${t}\u2026`,"info");const e=await ys(t);if(!e)throw new Error("profil bulunamadi (region/nick?)");await dn(.25,.5);const n=await bs(e);if(!n)throw new Error("DefaultMyHome yok");await dn(.25,.5);const{pgcBytes:o,img:i}=await hs(n);let r=ps(`ev_${Date.now().toString(36)}`,"ev");p.some(e=>e.name===r)&&(r=ps(`ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`,r)),us({name:r,img:i||"",bson_data:ds(o),sourceNick:t,sourceProfileId:e,sourceHomeId:n,harvestedAt:Date.now()}),Pc.homesSel&&(Pc.homesSel.value=r);try{Z(r)}catch{}vs(),Pc.homesPreviewUpdate&&Pc.homesPreviewUpdate(),cd("Ev listeye eklendi (sadece gorsel). Sec \u2192 Evi Uygula.","success")}).catch(e=>cd(String(e?.message??e??"Ev cekilemedi"),"error")):cd("Cekmek icin nick yaz","error")}function vs(){const e=Pc.homesList,t=Pc.homesSel;if(!e)return;let n=t&&"string"==typeof t.value?t.value:"";try{n||(n=X()||"")}catch{}e.innerHTML="";const o=p.slice().filter(e=>e&&e.name&&!__hd().includes(e.name)).sort((e,t)=>{const n=Number(e.harvestedAt||0),o=Number(t.harvestedAt||0);return n!==o?n-o:String(e.name||"").localeCompare(String(t.name||""))});if(fs(),!o.length){t&&(t.value="",t.disabled=!0);const n=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,padding:"12px 8px",textAlign:"center"});try{__xbEnsureCatalog()}catch{}return n.textContent=window.__xbCatLoading?"Ev listesi yukleniyor\u2026":window.__xbCatFailed?"Ev listesi yuklenemedi. Sekmeyi tekrar ac.":"Henuz ev yok. Nick yaz \u2192 Cek + Uygula veya Sadece Cek.",e.appendChild(n),Pc.homesPreviewUpdate&&Pc.homesPreviewUpdate(),void ld()}t&&(t.disabled=!1);let i=n&&o.some(e=>e.name===n)?n:"";!i&&o.length&&(i=o[o.length-1].name),o.forEach((n,o)=>{const r=!!i&&n.name===i,a=al("div",{display:"flex",alignItems:"center",gap:"8px",padding:"9px 10px",cursor:"pointer",margin:"5px 6px",boxSizing:"border-box",transition:"background 0.12s, box-shadow 0.12s, border-color 0.12s, transform .12s",border:"1px solid rgba(167,139,250,.16)",borderRadius:"12px",background:"linear-gradient(155deg,rgba(255,255,255,.04),rgba(0,0,0,.2))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04)"});a.dataset.homeName=n.name,a.title="Tikla: sec \xb7 Cift tik: uygula";const s=al("div",{flex:"0 0 18px",fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,textAlign:"center"});s.textContent=String(o+1),a.appendChild(s);const l=al("div",{width:"72px",height:"48px",flex:"0 0 72px",borderRadius:"7px",overflow:"hidden",background:Zs.bg,border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box",position:"relative"}),c=gs(n.img||"");if(c){const e=al("img",{display:"block",width:"100%",height:"100%",objectFit:"cover"});e.alt="",e.src=c,e.onerror=()=>{e.style.display="none"},l.appendChild(e)}else{const e=al("div",{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:Zs.sans,fontSize:"10px",color:Zs.sub});e.textContent="Ev",l.appendChild(e)}a.appendChild(l);const d=al("div",{flex:"1",minWidth:"0"}),u=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",color:Zs.txt});u.textContent=n.name||(r?"Secili ev":`Ev #${o+1}`),d.appendChild(u);const f=al("div",{fontFamily:Zs.sans,fontSize:"9px",color:Zs.sub,marginTop:"2px"});f.textContent=n.img?"Gorsel hazir \xb7 cift tik uygula":n.bson_data?"Bson var \xb7 onizleme yok":"Yukleniyor \xb7 onizleme yok",d.appendChild(f),a.appendChild(d);const m=al("div",{width:"22px",height:"22px",flex:"0 0 22px",borderRadius:"50%",background:Zs.acc||"#818cf8",color:"#0b0f1a",fontWeight:"800",fontSize:"13px",alignItems:"center",justifyContent:"center",display:"none",fontFamily:Zs.sans});m.textContent="\u2713",m.title="Secili",a._selMark=m,a.appendChild(m);const g=al("button",{flex:"0 0 auto",padding:"4px 8px",fontSize:"10px",fontFamily:Zs.sans,fontWeight:"600",color:Zs.err||"#f87171",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",borderRadius:"5px",cursor:"pointer",outline:"none"});g.type="button",g.textContent="Sil",g.title="Bu evi listeden kalici sil",g.addEventListener("click",e=>{if(e.stopImmediatePropagation(),e.preventDefault(),!window.confirm("Bu evi listeden silmek istiyor musun? (Geri alinamaz)"))return;const t=function(e){const t=String(e||"").trim();if(!t)return!1;const n=p.findIndex(e=>e.name===t);if(n<0)return!1;const __rm=p.splice(n,1)[0];try{if(__rm&&__rm.bundled){const __d=__hd();if(!__d.includes(t)){__d.push(t);H(_.homesDeleted,__d)}}}catch{}try{Q(p)}catch{}try{const e=Pc.homesSel;e&&e.value===t&&(e.value=p.length&&p[p.length-1].name||"",Z(e.value||""))}catch{}return vs(),!0}(n.name);cd(t?"Ev silindi":"Silinemedi",t?"info":"error")}),a.appendChild(g),ms(a,r);const h=()=>{t&&(t.value=n.name);try{Z(n.name)}catch{}for(const t of e.children){if(!t||!t.dataset)continue;ms(t,t.dataset.homeName===n.name);try{t.querySelectorAll?.("div")}catch{}}try{for(let t=0;t<e.children.length;t++){const o=e.children[t];if(!o?.dataset?.homeName)continue;const i=o.dataset.homeName===n.name,r=o.querySelector("[data-home-lab]");r&&(r.textContent=i?"Secili ev":`Ev #${t+1}`)}}catch{}Pc.homesPreviewUpdate&&Pc.homesPreviewUpdate(),ld()};u.setAttribute("data-home-lab","1"),a.addEventListener("mouseenter",()=>{t&&t.value!==n.name&&(a.style.background=Zs.sur)}),a.addEventListener("mouseleave",()=>{ms(a,!(!t||t.value!==n.name))}),a.addEventListener("click",e=>{e.target===g||g.contains(e.target)||(e.stopImmediatePropagation(),h())}),a.addEventListener("dblclick",e=>{e.target===g||g.contains(e.target)||(e.stopImmediatePropagation(),h(),xs(n.name))}),e.appendChild(a)}),t&&(t.value=i||"");try{i&&Z(i)}catch{}Pc.homesPreviewUpdate&&Pc.homesPreviewUpdate(),ld();try{Pc.renderSoftHomes&&Pc.renderSoftHomes()}catch{}}let Ss=null;const Cs={on:!1,ox:0,oy:0};function openVipPanel(){Ss||Is();Ss.style.display="flex";Ss.style.zIndex="2147483652";try{const p=Cc?.getBoundingClientRect?.();if(p){const w=Ss.offsetWidth||360;let left=p.left-w-12;if(left<8)left=Math.min(innerWidth-w-8,p.right+12);Ss.style.left=left+"px";Ss.style.top=Math.max(8,p.top)+"px";Ss.style.right="auto";Ss.style.bottom="auto"}else{Ss.style.top="16px";Ss.style.left="16px";Ss.style.right="auto";Ss.style.bottom="auto"}}catch{}Bs();$s();if(ce.accessToken&&!ce.pkgs.fetched&&!ce.pkgs.loading&&!ce.pkgs.errorMsg)try{zs()}catch{}}function Is(){if(Ss)return;const e=al("div",{position:"fixed",top:"16px",left:"16px",width:"360px",maxWidth:"calc(100vw - 32px)",background:"linear-gradient(165deg,rgba(28,28,36,.98),rgba(14,14,20,.99))",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.12)"),borderRadius:"16px",boxShadow:"0 0 0 1px "+(Zs.accGlow||"rgba(167,139,250,.25)")+" inset, 0 28px 70px rgba(0,0,0,.88), 0 0 60px "+(Zs.accDim||"rgba(167,139,250,.15)"),zIndex:"2147483652",fontFamily:Zs.sans,display:"none",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",animation:"ax-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",maxHeight:"calc(100vh - 32px)"});e.id=A.pkgFloat;for(const t of["mousedown","mouseup","mousemove","click","wheel","touchstart","touchend","touchmove"])e.addEventListener(t,ev=>{const el=ev.target;const tag=(el&&el.tagName||"").toLowerCase();if(tag==="input"||tag==="textarea"||tag==="select"||el&&el.isContentEditable)return;if(el&&el.closest&&el.closest("input,textarea,select,[contenteditable=\"true\"]"))return;ev.stopImmediatePropagation()},{passive:t.startsWith("touch")||"wheel"===t});const glow=al("div",{position:"absolute",width:"180px",height:"180px",borderRadius:"50%",background:"rgba(245,158,11,.12)",filter:"blur(40px)",top:"-40px",right:"-30px",pointerEvents:"none"});e.appendChild(glow);const t=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:"3px",background:"linear-gradient(180deg, transparent 0%, #f59e0b 25%, "+(Zs.acc||"#a78bfa")+" 70%, transparent 100%)",borderRadius:"3px 0 0 3px",opacity:"0.9",pointerEvents:"none"});e.appendChild(t);const n=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:"48px",background:"linear-gradient(180deg,rgba(255,255,255,.04),transparent)",borderBottom:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),cursor:"grab",userSelect:"none",flexShrink:"0",position:"relative",zIndex:"1"}),o=al("div",{display:"flex",alignItems:"center",gap:"8px"}),i=al("span",{color:"#f59e0b",display:"flex",alignItems:"center"});i.innerHTML=sl.pkg;const r=al("span",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:"0.14em",color:Zs.txt,textTransform:"uppercase"});r.textContent=re("vip_panel_title"),o.appendChild(i),o.appendChild(r);const a=al("div",{display:"flex",gap:"4px"}),sBtn=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',re("btn_close"),!0);sBtn.addEventListener("click",()=>{e.style.display="none",Bs()}),a.appendChild(sBtn),n.appendChild(o),n.appendChild(a),n.addEventListener("mousedown",t=>{if(t.target.closest("button"))return;t.stopImmediatePropagation(),t.preventDefault();const o=e.getBoundingClientRect();Cs.on=!0,Cs.ox=t.clientX-o.left,Cs.oy=t.clientY-o.top,n.style.cursor="grabbing";const i=t=>{Cs.on&&(e.style.left=Math.min(Math.max(0,t.clientX-Cs.ox),innerWidth-e.offsetWidth)+"px",e.style.top=Math.min(Math.max(0,t.clientY-Cs.oy),innerHeight-e.offsetHeight)+"px",e.style.right="auto",e.style.bottom="auto")},r=()=>{Cs.on=!1,n.style.cursor="grab",window.removeEventListener("mousemove",i,!0),window.removeEventListener("mouseup",r,!0)};window.addEventListener("mousemove",i,!0),window.addEventListener("mouseup",r,!0)}),e.appendChild(n);const l=al("div",{overflowY:"auto",overflowX:"hidden",padding:"14px 14px 16px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:"0",position:"relative",zIndex:"1"});e.appendChild(l),Pc.pkgFloatBody=l,Ss=e,(j()??document.body).appendChild(e),$s()}function $s(){const e=Pc.pkgFloatBody;if(!e)return;e.innerHTML="";const head=al("div",{paddingBottom:"12px",marginBottom:"12px",borderBottom:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)")});const o=al("div",{fontFamily:Zs.sans,fontSize:"12.5px",fontWeight:"700",color:Zs.txt,letterSpacing:"-0.01em",marginBottom:"4px"});o.textContent=re("vip_panel_title");const a=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"400",color:Zs.sub,lineHeight:"1.5"});a.textContent=re("vip_card_desc"),head.appendChild(o),head.appendChild(a),e.appendChild(head);const s=!!ce.accessToken;const c=al("div",{background:"linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))",border:"1px solid "+(Zs.bdr||"rgba(255,255,255,.1)"),borderRadius:"12px",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04)",overflow:"hidden",maxHeight:"440px",overflowY:"auto"});if(c.id=A.pkgList,ce.pkgs.loading){const e=al("div",{padding:"28px 16px",fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,textAlign:"center"});e.textContent="Teklifler yukleniyor...",c.appendChild(e)}else if(ce.pkgs.errorMsg){const e=al("div",{padding:"24px 16px",fontFamily:Zs.sans,fontSize:"11px",color:Zs.err,textAlign:"center",lineHeight:"1.55"});e.textContent="Teklifler yuklenemedi: "+ce.pkgs.errorMsg,c.appendChild(e)}else if(ce.pkgs.fetched)if(ce.pkgs.offers.length){const cheapest=ce.pkgs.offers.reduce((e,t)=>(e.Cost?.Amount??1e12)<=(t.Cost?.Amount??1e12)?e:t);for(let t=0;t<ce.pkgs.offers.length;t++){const n=ce.pkgs.offers[t],o=Ts(n,cheapest&&n===cheapest);t===ce.pkgs.offers.length-1&&(o.style.borderBottom="none"),c.appendChild(o)}}else{const e=al("div",{padding:"24px 16px",fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,textAlign:"center"});e.textContent="Bu bolge icin bilinen indirimli paket yok.",c.appendChild(e)}else{const e=al("div",{padding:"24px 16px",fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,textAlign:"center",lineHeight:"1.6"});e.textContent=s?"Paketler getiriliyor...":"Once oyuna gir (login).",c.appendChild(e)}e.appendChild(c);if(s&&!ce.pkgs.fetched&&!ce.pkgs.loading&&!ce.pkgs.errorMsg)try{zs()}catch{}}function Bs(){const e=Pc.pkgOpenBtn;if(!e)return;const t=Ss&&"none"!==Ss.style.display;if(e._lbl)e._lbl.textContent=t?re("vip_panel_close"):re("vip_open_btn");else{const n=e.querySelector("span");n&&(n.textContent=t?re("vip_panel_close"):re("vip_open_btn"))}e.style.background=t?Zs.errDim:Zs.accDim,e.style.borderColor=t?Zs.errBdr:Zs.accBdr,e.style.color=t?Zs.err:Zs.acc}async function zs(){if(Fo()&&!ce.pkgs.loading){ce.pkgs.loading=!0,ce.pkgs.errorMsg=null,$s();try{const e=on(),t=`https://payments.mspapis.com/offers//v2/payment-offer/${e}/MovieStarPlanet2/Web/${ce.profileId??"NotSet"}/NotSet?country=${e}&isvip=False`,n=await cn(t,{method:"GET"});if(!n.ok)throw new Error(`HTTP ${n.status}`);const o=await n.json(),i=(Array.isArray(o)?o:o.Offers??[]).filter(e=>e.Content&&P.has(String(e.Content.Id))).filter(e=>e.Cost&&e.Content?.BundledItems).filter(e=>{const n=String(e.Content.Name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return!/normal\s*vip\s*1\s*y[iı]?l/.test(n)&&!/normal\s*vip\s*1\s*year/.test(n)}).sort((e,t)=>e.Cost.Amount-t.Cost.Amount);ce.pkgs.offers=i,ce.pkgs.fetched=!0,i.length?cd(re("vip_loaded",{n:i.length}),"success"):cd(re("vip_none_region"),"info")}catch(e){ce.pkgs.errorMsg=e?.message??"Istek basarisiz",ce.pkgs.offers=[],cd(re("vip_load_fail",{msg:ce.pkgs.errorMsg}),"error")}finally{ce.pkgs.loading=!1,$s()}}}function Ts(e,t){const n=e.Content.BundledItems?.find(e=>"DaysVip"===e.ItemReference),o=e.Content.BundledItems?.find(e=>"SoftCurrency"===e.ItemReference),i=e.Content.BundledItems?.find(e=>"HardCurrency"===e.ItemReference),r=L[String(e.Content.Id)],a=!!r||!!t,s=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",cursor:"pointer",boxSizing:"border-box",borderBottom:`1px solid ${Zs.bdr}`,transition:"background 0.15s",background:"transparent"});s.addEventListener("mouseenter",()=>{s.style.background=Zs.accDim}),s.addEventListener("mouseleave",()=>{s.style.background="transparent"});const l=al("div",{flex:"1",minWidth:"0",marginRight:"12px"}),c=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"500",color:Zs.txt,marginBottom:"5px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"});if(c.textContent=(function(nm){nm=String(nm||re("vip_special")).replace(/\s*\(?\s*Aboneli[gğ]i\s*\)?\s*/gi,"").replace(/\s{2,}/g," ").trim()||re("vip_special");if(ie==="tr")return nm;const low=nm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(/hos\s*geldin|welcome/.test(low))return re("vip_welcome_offer");if(/1\s*aylik|1\s*month|1\s*-\s*month/.test(low))return re("vip_1_month");if(/3\s*aylik|3\s*month|3\s*-\s*month/.test(low))return re("vip_3_month");if(/1\s*yillik|1\s*year|yearly|annual/.test(low))return re("vip_1_year");return nm})(e.Content.Name),t){const e=al("span",{display:"inline-block",marginLeft:"6px",fontFamily:Zs.mono,fontSize:"9px",fontWeight:"700",color:Zs.ok,background:Zs.okDim,border:`1px solid ${Zs.okBdr}`,borderRadius:"4px",padding:"1px 5px",verticalAlign:"middle"});e.textContent=re("vip_cheapest"),c.appendChild(e)}const d=al("div",{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"});if(n){const e=al("span",{display:"inline-flex",alignItems:"center",gap:"3px",fontFamily:Zs.mono,fontSize:"10px",fontWeight:"600",color:Zs.acc});e.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';const t=al("span");t.textContent=re("vip_days",{n:n.Amount}),e.appendChild(t),d.appendChild(e);if(Number(n.Amount)>=365){const dp=al("span",{display:"inline-block",marginLeft:"6px",fontFamily:Zs.mono,fontSize:"9px",fontWeight:"800",letterSpacing:".04em",color:"#fde68a",background:"rgba(245,158,11,.18)",border:"1px solid rgba(245,158,11,.4)",borderRadius:"4px",padding:"1px 5px",verticalAlign:"middle"});dp.textContent=re("vip_dp_tag"),e.appendChild(dp)}}if(o){const e=al("span",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub});e.textContent=`${(o.Amount/1e3).toFixed(1).replace(".0","")}k SC`,d.appendChild(e)}if(i){const e=al("span",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub});e.textContent=re("diamond_n",{n:i.Amount}),d.appendChild(e)}l.appendChild(c),l.appendChild(d);const p=al("div",{display:"flex",alignItems:"center",gap:"8px",flexShrink:"0"});if(r){const e=al("span",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.muted,textDecoration:"line-through"});e.textContent=r,p.appendChild(e)}const u=al("span",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:a?Zs.ok:Zs.txt});u.textContent=e.Cost.Formatted;const f=al("span",{display:"inline-flex",alignItems:"center",color:Zs.sub,transition:"color 0.15s"});return f.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>',s.addEventListener("mouseenter",()=>{f.style.color=Zs.acc}),s.addEventListener("mouseleave",()=>{f.style.color=Zs.sub}),p.appendChild(u),p.appendChild(f),s.appendChild(l),s.appendChild(p),s.addEventListener("click",()=>function(e){const t=ce.profileId??"NotSet",n=ce.profileName??"",o=ce.accessToken??"";if(!o)return void cd("Once giris gerekli","error");const i=`https://payments.mspapis.com/payments/Initialize?offerId=${e.Id}&profileId=${t}&actorName=${encodeURIComponent(n)}&accessToken=${encodeURIComponent(o)}&rp=windows-web&ItemsGender=0`;window.open(i,"_blank")}(e)),s}async function Ls(e,t){const n=await cn(`${k}/federationgateway/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({id:"SendGreetings-159BDD7706D824BB8F14874A7FAE3368",variables:{greetingType:String(e||"Autograph"),receiverProfileId:String(t||""),ignoreDailyCap:!1}})});if(!n.ok)return{ok:!1,reason:`HTTP ${n.status}`};let o=null;try{o=await n.json()}catch{return{ok:!1,reason:"json"}}const i=o?.data?.greetings?.sendGreeting;if(i?.success)return{ok:!0,wait:i?.data?.nextGreetingSecondsRemaining??null};return{ok:!1,reason:i?.error?.reason||i?.error?.message||"fail",wait:i?.error?.nextGreetingSecondsRemaining??null,raw:i}}async function Ps(){if(!Fo())return;const e=ce.autographer;if(e.running)return;const picks=Array.isArray(e.pickTargets)?e.pickTargets.filter(p=>p&&p.id):[];const greeting=e.selectedGreeting||"Autograph";if(picks.length){try{if(!e.vipChecked){try{const pid=ce.profileId,t=await ro(k+"/profilememberships/v1/memberships/summary/profiles/"+pid,{method:"GET",headers:{"skip-not-found-items":"true"}});if(Array.isArray(t)&&t.length>0){const row=t[0],now=new Date,exp=row.currentTierExpiry?new Date(row.currentTierExpiry):null;e.isVip=!!exp&&exp>now}}catch{}e.vipChecked=!0}}catch{}return _s(greeting,picks)}if(e.targetProfile&&e.targetProfile.id){try{if(!e.vipChecked){try{const pid=ce.profileId,t=await ro(k+"/profilememberships/v1/memberships/summary/profiles/"+pid,{method:"GET",headers:{"skip-not-found-items":"true"}});if(Array.isArray(t)&&t.length>0){const row=t[0],now=new Date,exp=row.currentTierExpiry?new Date(row.currentTierExpiry):null;e.isVip=!!exp&&exp>now}}catch{}e.vipChecked=!0}}catch{}return _s(greeting,[e.targetProfile])}cd("Once kisi sec: ustten ara veya odadan tikla","error")}function Ms(e){const t=ce.autographer;t.running=!1,t.timer&&(clearTimeout(t.timer),t.timer=null),t.countdownTimer&&(clearInterval(t.countdownTimer),t.countdownTimer=null),e?cd(`Autographer done \u2014 ${t.sentCount} sent`,"success"):cd(`Autographer stopped \u2014 ${t.sentCount} sent`,"info"),t.greetingAllAbort=!0,yn(),Ns()}function As(e){return e>=3600?`${Math.floor(e/3600)}h ${Math.floor(e%3600/60)}m`:e>=60?`${Math.floor(e/60)}m ${e%60}s`:`${e}s`}function Es(e){return e==="Autograph"||e===n?(ie==="en"?"Normal Signature":"Normal \u0130mza"):r(e)?.label||e}function Ds(){const e=ce.profileId,t=[];for(const[n,o]of ce.chatroomUsers)n&&n!==e&&t.push({id:n,name:o?.name||n});return t}function js(e,t){const n=ce.autographer;if(!e)return;const o=n.pickTargets.findIndex(t=>t.id===e);o>=0?n.pickTargets.splice(o,1):n.pickTargets.push({id:e,name:t||e,src:"room"}),Ns()}function Fs(e,t){const n=ce.autographer;if(!e)return;const o=n.pickTargets.findIndex(t=>t.id===e);o>=0?(n.pickTargets[o].name=t||n.pickTargets[o].name||e,n.pickTargets[o].src="search"):n.pickTargets.push({id:e,name:t||e,src:"search"})}async function _s(e,t){if(!Fo())return;if(!e)return void cd(re("ag_need_style"),"error");const list=(t||[]).map(e=>"string"==typeof e?{id:e,name:e}:{id:e&&e.id,name:e&&e.name||e&&e.id,src:e&&e.src}).filter(e=>e.id),selfId=ce.profileId,seen=new Set,targets=[];for(const row of list)row.id&&row.id!==selfId&&!seen.has(row.id)&&(seen.add(row.id),targets.push(row));if(!targets.length)return void cd("Gonderilecek kisi yok","error");const a=ce.autographer;if(a.greetingAllRunning)return;a.greetingAllRunning=!0,a.greetingAllAbort=!1,a.greetingAllType=e,a.greetingAllProgress=0,a.greetingAllTotal=targets.length,Ns();const label=Es(e);cd(label+" -> "+targets.length+" kisi...","info");let ok=0,skipped=0;const isAuto=e==="Autograph"||e==="SummerGreeting"||e===n;const waitAbortable=async sec=>{let left=Math.max(0,Number(sec)||0);while(left>0){if(a.greetingAllAbort)return!1;const chunk=Math.min(.45,left);await dn(chunk,chunk);left-=chunk;if(a.greetingAllAbort)return!1}return!0};for(const target of targets){if(a.greetingAllAbort)break;let waitSec=null;try{const res=await Ls(isAuto?"Autograph":e,target.id);waitSec=res.wait;if(res.ok)ok++;else{if("FailedDefinitionNotFound"===res.reason){a.greetingAllAbort=!0,cd(label+": bu sezon tanimi yok / hak kalmadi - durdu","error");break}"FailedCooldown"!==res.reason&&null==res.wait||skipped++}a.greetingAllProgress++,Pc.agGreetProgress&&(Pc.agGreetProgress.textContent=Es(a.greetingAllType)+" - "+a.greetingAllProgress+"/"+a.greetingAllTotal+" (ok:"+ok+")")}catch{}if(a.greetingAllAbort)break;if(isAuto){let w=Number(waitSec);if(!Number.isFinite(w)||w<=0)w=a.isVip?120:3600;w=Math.max(2,Math.min(w,7200));if(Pc.agGreetProgress)Pc.agGreetProgress.textContent=label+" | sonraki ~"+Math.round(w)+"sn (Durdur aktif)";const cont=await waitAbortable(w);if(!cont)break}else if(a.instantMode){const cont=await waitAbortable(.05);if(!cont)break}else{const cont=await waitAbortable(.15);if(!cont)break}}const done=a.greetingAllProgress;const wasAbort=!!a.greetingAllAbort;a.greetingAllRunning=!1,a.greetingAllType=null,a.greetingAllAbort=!1;if(wasAbort)cd(label+": durduruldu ("+ok+"/"+done+")","info");else cd(label+": "+ok+"/"+done+" basarili"+(skipped?" | cd/atlanan ~"+skipped:""),"success");Ns()}let Rs=null;const Os={on:!1,ox:0,oy:0};function Us(){if(Rs)return;const e=al("div",{position:"fixed",bottom:"24px",right:"24px",width:"380px",maxWidth:"calc(100vw - 32px)",background:"linear-gradient(165deg,rgba(28,28,36,.99),rgba(16,16,22,.99))",border:`1px solid ${Zs.bdr}`,borderRadius:"16px",boxShadow:`0 0 0 1px ${Zs.accGlow} inset, 0 28px 70px rgba(0,0,0,0.88), 0 0 40px ${Zs.accDim}`,zIndex:"2147483646",fontFamily:Zs.sans,display:"none",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",animation:"ax-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",maxHeight:"calc(100vh - 40px)"});e.id=A.agFloat;for(const t of["mousedown","mouseup","mousemove","click","wheel","touchstart","touchend","touchmove"])e.addEventListener(t,e=>e.stopImmediatePropagation(),{passive:t.startsWith("touch")||"wheel"===t});const t=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:"2px",background:`linear-gradient(180deg, transparent 0%, ${Zs.acc} 30%, ${Zs.accBdr} 70%, transparent 100%)`,borderRadius:"2px 0 0 2px",opacity:"0.6",pointerEvents:"none"});e.appendChild(t);const n=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:"44px",background:Zs.sur,borderBottom:`1px solid ${Zs.bdrSub}`,cursor:"grab",userSelect:"none",flexShrink:"0"}),o=al("div",{display:"flex",alignItems:"center",gap:"8px"}),i=al("span",{color:Zs.acc,display:"flex",alignItems:"center"});i.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';const r=al("span",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"700",letterSpacing:"0.12em",color:Zs.txt,textTransform:"uppercase"});r.textContent=re("ag_panel_title"),o.appendChild(i),o.appendChild(r);const a=al("div",{display:"flex",gap:"4px"}),s=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',"Close",!0);s.addEventListener("click",()=>{e.style.display="none"}),a.appendChild(s),n.appendChild(o),n.appendChild(a),n.addEventListener("mousedown",t=>{if(t.target.closest("button"))return;t.stopImmediatePropagation(),t.preventDefault();const o=e.getBoundingClientRect();Os.on=!0,Os.ox=t.clientX-o.left,Os.oy=t.clientY-o.top,n.style.cursor="grabbing";const i=t=>{Os.on&&(e.style.left=Math.min(Math.max(0,t.clientX-Os.ox),innerWidth-e.offsetWidth)+"px",e.style.top=Math.min(Math.max(0,t.clientY-Os.oy),innerHeight-e.offsetHeight)+"px",e.style.right="auto",e.style.bottom="auto")},r=()=>{Os.on=!1,n.style.cursor="grab",window.removeEventListener("mousemove",i,!0),window.removeEventListener("mouseup",r,!0)};window.addEventListener("mousemove",i,!0),window.addEventListener("mouseup",r,!0)}),e.appendChild(n);const l=al("div",{overflowY:"auto",overflowX:"hidden",padding:"12px 14px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:"0"});e.appendChild(l),Pc.agFloatBody=l,Rs=e,(j()??document.body).appendChild(e),Ns()}function Ns(){const e=Pc.agFloatBody;if(!e)return;e.innerHTML="";const t=ce.autographer,a=(e,t,n)=>{const o=al("div",{padding:"12px 12px 14px",marginBottom:"12px",borderRadius:"12px",background:"linear-gradient(165deg,rgba(255,255,255,.035),rgba(255,255,255,.01))",border:"1px solid "+Zs.bdrSub}),i=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}),r=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:"0.09em",color:Zs.sub,textTransform:"uppercase"});r.textContent=e,i.appendChild(r),t&&i.appendChild(t),o.appendChild(i);for(const e of n)e&&o.appendChild(e);return o},s=[];if(t.targetProfile){const e=al("div",{display:"flex",gap:"10px",alignItems:"center",padding:"9px 10px",background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"7px",marginBottom:"0",position:"relative"});if(t.targetFaceUrl){const n=al("img",{width:"38px",height:"38px",borderRadius:"6px",objectFit:"cover",flexShrink:"0",background:Zs.sur,border:`1px solid ${Zs.bdrSub}`});n.src=t.targetFaceUrl,n.onerror=()=>{n.style.display="none"},e.appendChild(n)}const n=al("div",{flex:"1",minWidth:"0",overflow:"hidden"}),o=al("div",{display:"flex",alignItems:"center",gap:"6px",marginBottom:"2px"}),i=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:"1",minWidth:"0"});i.textContent=t.targetProfile.name;const r=al("span",{fontFamily:Zs.mono,fontSize:"9px",fontWeight:"600",color:Zs.acc,background:"rgba(255,255,255,0.04)",border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",padding:"1px 6px",flexShrink:"0",letterSpacing:"0.05em",display:"inline-flex",alignItems:"center",gap:"4px"});r.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><span>LOCKED</span>',o.appendChild(i),o.appendChild(r);const a=al("div",{fontFamily:Zs.mono,fontSize:"9px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});a.textContent=t.targetProfile.id,n.appendChild(o),n.appendChild(a),e.appendChild(n);const l=al("button",{fontFamily:Zs.sans,fontSize:"9px",color:Zs.sub,background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"4px",padding:"3px 7px",cursor:"pointer",outline:"none",flexShrink:"0"});l.textContent="\u2715",l.title="Unlock & clear target",l.addEventListener("click",()=>{t.running?cd("Stop the autographer first","error"):(t.targetProfile=null,t.targetFaceUrl=null,t.searchResults=[],t.searchQuery="",Ns())}),e.appendChild(l),s.push(e);Pc.agOutfitCopyBtn=null}else{s.push(Bl(ie==="en"?"Search players, select — multiple allowed.":"Oyuncu ara, se\xe7 — birden fazla se\xe7ilebilir."));const e=al("div",{display:"flex",gap:"6px",marginTop:"10px",marginBottom:"0",alignItems:"stretch"}),n=kl("Nick veya 32 haneli profile ID\u2026");n.style.marginBottom="0",n.style.flex="1",n.value=t.searchQuery??"",n.dataset.agSearch="1",n.addEventListener("input",()=>{t.searchQuery=n.value}),n.addEventListener("keydown",e=>{e.stopPropagation()});const o=al("button",{display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",padding:"8px 12px",background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"6px",color:Zs.acc,fontFamily:Zs.sans,fontSize:"11px",fontWeight:"500",cursor:"pointer",outline:"none",flexShrink:"0",whiteSpace:"nowrap",transition:"background 0.15s, border-color 0.15s"});o.textContent=t.searching?(ie==="en"?"Searching…":"Aranıyor…"):(ie==="en"?"Search":"Ara"),o.disabled=t.searching,t.searching&&(o.style.opacity="0.6");const i=()=>hn(n.value);if(o.addEventListener("mouseenter",()=>{o.disabled||(o.style.background=Zs.accGlow,o.style.borderColor=Zs.accBdr)}),o.addEventListener("mouseleave",()=>{o.style.background=Zs.accDim,o.style.borderColor=Zs.accBdr}),o.addEventListener("click",i),n.addEventListener("keydown",e=>{"Enter"===e.key&&(e.preventDefault(),i())}),e.appendChild(n),e.appendChild(o),s.push(e),t.searchResults&&t.searchResults.length){const e=al("div",{marginTop:"8px",maxHeight:"230px",overflowY:"auto",background:Zs.sur,border:`1px solid ${Zs.bdrSub}`,borderRadius:"7px"});t.searchResults.forEach((n,o)=>{const i=al("div",{display:"flex",alignItems:"center",gap:"9px",padding:"7px 9px",cursor:"pointer",borderBottom:o<t.searchResults.length-1?`1px solid ${Zs.bdrSub}`:"none",transition:"background 0.12s"}),r=al("img",{width:"30px",height:"30px",borderRadius:"5px",objectFit:"cover",flexShrink:"0",background:Zs.bg,border:`1px solid ${Zs.bdrSub}`});r.alt="",r.setAttribute("data-face-id",n.id),n.faceUrl&&(r.src=n.faceUrl),r.onerror=()=>{r.style.opacity="0.25"};const a=al("div",{flex:"1",minWidth:"0"}),s=al("div",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});s.textContent=n.name;const l=al("div",{fontFamily:Zs.mono,fontSize:"9px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});if(l.textContent=n.id,a.appendChild(s),a.appendChild(l),i.appendChild(r),i.appendChild(a),n.vip){const e=al("span",{fontFamily:Zs.mono,fontSize:"9px",fontWeight:"600",color:Zs.acc,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",padding:"2px 6px",flexShrink:"0",letterSpacing:"0.04em"});e.textContent="VIP",i.appendChild(e)}i.addEventListener("mouseenter",()=>{i.style.background=Zs.accDim}),i.addEventListener("mouseleave",()=>{i.style.background="transparent"}),i.addEventListener("click",()=>function(e){const t=ce.autographer;if(t.running)return void cd("Önce oto imzayı durdur","error");const n=t.searchResults.find(t=>t.id===e);n&&(Fs(n.id,n.name||n.id),t.searchResults=[],t.searchQuery="",t.searching=!1,cd("Listeye eklendi: "+(n.name||n.id),"success"),Ns())}(n.id)),e.appendChild(i)}),s.push(e)}else if(t.searching){const e=al("div",{marginTop:"8px",fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,textAlign:"center",padding:"8px"});e.textContent=ie==="en"?"Searching players…":"Oyuncular aranıyor…",s.push(e)}{const searchPicks=(t.pickTargets||[]).filter(p=>p&&p.src==="search");if(searchPicks.length){const wrap=al("div",{marginTop:"10px",padding:"10px",borderRadius:"10px",background:"linear-gradient(165deg,rgba(255,255,255,.04),rgba(255,255,255,.015))",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),display:"flex",flexDirection:"column",gap:"8px"});const lab=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:".07em",textTransform:"uppercase",color:Zs.sub});lab.textContent=(ie==="en"?"Selected":"Se\xe7ili ki\u015filer")+" ("+searchPicks.length+")";wrap.appendChild(lab);const chips=al("div",{display:"flex",flexWrap:"wrap",gap:"5px"});for(const p of searchPicks){const b=al("button",{display:"inline-flex",alignItems:"center",gap:"4px",padding:"4px 9px",borderRadius:"999px",cursor:"pointer",outline:"none",background:Zs.accDim,border:"1px solid "+Zs.accBdr,color:Zs.acc,fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"600"});b.textContent=(p.name||p.id)+" x";b.title=p.id;b.addEventListener("click",()=>{const ix=t.pickTargets.findIndex(x=>x.id===p.id);ix>=0&&t.pickTargets.splice(ix,1);Ns()});chips.appendChild(b)}wrap.appendChild(chips);s.push(wrap)}}}e.appendChild(a(ie==="en"?"Target":"Hedef",null,s));const l=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,marginBottom:"10px",lineHeight:"1.55"});l.textContent=t.vipChecked?t.isVip?(ie==="en"?"VIP: ~1 signature / 2 min (up to 30/hour).":"VIP: yaklaşık 2 dakikada 1 imza (saatte 30)."):(ie==="en"?"Standard: 1 signature / hour.":"Standart: saatte 1 imza."):(ie==="en"?"Rate depends on VIP. Detected when you start.":"Hız VIP’e göre. Başlatınca algılanır.");const c=wl([["1","1"],["5","5"],["10","10"],["25","25"],["50","50"],["0","Unlimited"]]);c.value=String(t.maxCount),Pc.agFloatCountSel=c;const d=al("div",{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",marginBottom:"8px",cursor:"pointer"}),p=al("div",{flex:"1"}),u=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",color:Zs.txt,marginBottom:"2px"});u.textContent=ie==="en"?"⚡ Instant Mode":"⚡ Anlık mod";const f=al("div",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.sub,lineHeight:"1.5"});f.textContent=ie==="en"?"Sends to all selected quickly!":"Se\xe7ilen herkese h\u0131zl\u0131 \u015fekilde g\xf6nderir!",p.appendChild(u),p.appendChild(f);const m=al("div",{position:"relative",flexShrink:"0",width:"32px",height:"17px",borderRadius:"9px",background:t.instantMode?Zs.acc:"rgba(255,255,255,0.08)",border:`1px solid ${t.instantMode?Zs.acc:Zs.bdrSub}`,transition:"background 0.2s, border-color 0.2s",cursor:"pointer",boxSizing:"border-box",marginTop:"2px"}),g=al("div",{position:"absolute",top:"2px",left:t.instantMode?"15px":"2px",width:"11px",height:"11px",borderRadius:"50%",background:t.instantMode?Zs.bg:Zs.sub,transition:"left 0.2s, background 0.2s"});m.appendChild(g),d.appendChild(p),d.appendChild(m),d.addEventListener("click",()=>{t.instantMode=!t.instantMode,m.style.background=t.instantMode?Zs.acc:"rgba(255,255,255,0.08)",m.style.borderColor=t.instantMode?Zs.acc:Zs.bdrSub,g.style.left=t.instantMode?"15px":"2px",g.style.background=t.instantMode?Zs.bg:Zs.sub,cd((ie==="en"?"Instant Mode ":"Anlık mod ")+(t.instantMode?(ie==="en"?"on":"açık"):(ie==="en"?"off":"kapalı")),"info")});const h=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,marginBottom:"8px",minHeight:"14px"});if(t.running){const e=t.maxCount>0?`/ ${t.maxCount}`:"/ \u221e";h.textContent=`Sent ${t.sentCount} ${e}${t.instantMode?"":` \xb7 Next in ${As(t.nextInSec)}`}`}Pc.agFloatStatus=h;const y=t.running?xl(ie==="en"?"Stop":"Durdur","stop","danger"):xl(ie==="en"?"Start":"Başlat","autograph");y.addEventListener("click",()=>{t.running?Ms(!1):Ps()}),e.appendChild(a(ie==="en"?"Autograph to target":"Hedefe imza",null,[l,c,h,y])),t.selectedGreeting||(t.selectedGreeting="Autograph"),Array.isArray(t.pickTargets)||(t.pickTargets=[]);const b=al("div",{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"4px"}),w=e=>{const n=t.selectedGreeting===e.id,o=al("button",{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"8px 10px",margin:"0",textAlign:"left",background:n?Zs.accDim:Zs.sur,border:`1px solid ${n?Zs.accBdr:Zs.bdrSub}`,borderRadius:"8px",cursor:"pointer",outline:"none",transition:"background 0.12s, border-color 0.12s",boxSizing:"border-box"}),i=al("span",{fontSize:"18px",lineHeight:"1",flexShrink:"0",width:"26px",textAlign:"center"});i.textContent=e.emoji;const r=al("div",{flex:"1",minWidth:"0"}),a=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"700",color:n?Zs.acc:Zs.txt,letterSpacing:"0.01em"});a.textContent=e.label;const s=al("div",{fontFamily:Zs.sans,fontSize:"9.5px",color:Zs.sub,marginTop:"2px"});null!=e.fame?s.textContent=`\u2605 ${e.fame}  \xb7  \ud83e\ude99 ${e.sc}`:s.textContent=e.sub||"",r.appendChild(a),r.appendChild(s);const l=al("span",{fontFamily:Zs.mono,fontSize:"11px",fontWeight:"700",flexShrink:"0",color:"#fff",background:n?"linear-gradient(135deg,#ff4d8d,#e91e8c)":"rgba(255,77,141,0.55)",borderRadius:"999px",padding:"4px 10px",display:"inline-flex",alignItems:"center",gap:"4px",boxShadow:n?"0 0 12px rgba(233,30,140,0.45)":"none"});return l.textContent=e.diam?re("diamond_n",{n:e.diam}):re("ag_free"),l.style.background=e.diam?(n?"linear-gradient(135deg,#ff4d8d,#e91e8c)":"rgba(255,77,141,0.55)"):(n?"linear-gradient(135deg,#34d399,#059669)":"rgba(52,211,153,0.35)"),o.appendChild(i),o.appendChild(r),o.appendChild(l),o.addEventListener("mouseenter",()=>{n||(o.style.background="rgba(255,255,255,0.04)")}),o.addEventListener("mouseleave",()=>{o.style.background=n?Zs.accDim:Zs.sur}),o.addEventListener("click",()=>{t.selectedGreeting=e.id,Ns()}),o};b.appendChild(w({id:"Autograph",label:ie==="en"?"Normal Signature":"Normal \u0130mza",emoji:"✍️",diam:0,sub:ie==="en"?"Free · VIP 2min / non-VIP 1h":"\xdccretsiz · VIP 2dk / di\u011fer 1sa"}));for(const e of i)b.appendChild(w(e));if(!t.selectedGreeting||t.selectedGreeting===n||(t.selectedGreeting==="StarGreeting"&&!r(t.selectedGreeting)))t.selectedGreeting="Autograph";if(!(t.selectedGreeting==="Autograph"||t.selectedGreeting===n||i.some(e=>e.id===t.selectedGreeting)))t.selectedGreeting="Autograph";const v=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,marginTop:"8px",marginBottom:"2px",lineHeight:"1.45"});const gSel=t.selectedGreeting==="Autograph"||t.selectedGreeting===n?{emoji:"✍️",label:ie==="en"?"Normal Signature":"Normal \u0130mza",diam:0}:r(t.selectedGreeting);v.textContent=gSel?re("ag_selected",{emoji:gSel.emoji,label:gSel.label,price:gSel.diam?re("diamond_n",{n:gSel.diam}):re("ag_free")}):re("ag_pick_style");e.appendChild(a(re("ag_styles"),null,[b,v]));const S=Ds().length,C=al("span",{fontFamily:Zs.mono,fontSize:"9.5px",fontWeight:"500",color:S>0?Zs.ok:Zs.sub,background:S>0?Zs.okDim:"rgba(255,255,255,0.04)",border:`1px solid ${S>0?Zs.okBdr:Zs.bdrSub}`,borderRadius:"4px",padding:"2px 6px"});C.textContent=re("ag_room_count",{n:S}),Pc.agUserBadge=C;const I=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:t.greetingAllRunning?Zs.acc:Zs.sub,marginTop:"6px",minHeight:"14px"});t.greetingAllRunning&&(I.textContent=`${Es(t.greetingAllType)} \u2014 ${t.greetingAllProgress} / ${t.greetingAllTotal}`),Pc.agGreetProgress=I;const $=!!t.greetingAllRunning,B=()=>t.selectedGreeting||i[0].id,z=()=>B()==="Autograph"||B()===n?0:r(B())?.diam??"?",zLab=()=>{const d=z();return 0===d||"0"===d?re("ag_free"):re("diamond_n",{n:d})},T=(e,t,n)=>{const o=n?xl(e,"stop","danger"):xl(e,"autograph");return o.style.marginBottom="6px",$&&!n&&o.setDisabled(!0),o.addEventListener("click",t),o},L=T(re("ag_send_all",{n:S,price:(function(){const d=Number(z())||0;return d?re("diamond_n",{n:d*S}):re("ag_free")})()}),()=>async function(e){const t=Ds();if(t.length)return _s(e,t);cd(re("ag_no_others"),"error")}(B()));S&&!$||L.setDisabled(!0);const P=T(t.targetProfile?re("ag_locked_to",{name:t.targetProfile.name,price:zLab()}):re("ag_locked_need"),()=>async function(e){const t=ce.autographer.targetProfile;if(t?.id)return _s(e,[t]);cd(re("ag_lock_target_need"),"error")}(B()));t.targetProfile?.id&&!$||P.setDisabled(!0);const M=t.pickTargets.length,A=T(re("ag_send_picked",{n:M,price:(function(){const d=Number(z())||0;return d?re("diamond_n",{n:d*M}):re("ag_free")})()}),()=>async function(e){const t=ce.autographer.pickTargets||[];if(t.length)return _s(e,t);cd(re("ag_need_pick"),"error")}(B()));M&&!$||A.setDisabled(!0);const E=$?T(re("btn_stop"),()=>{t.greetingAllAbort=!0;try{Ns()}catch{};cd(re("ag_stopping"),"info")},!0):null,D=Bl(0===S?re("ag_need_room"):re("ag_click_pick")),j=al("div",{maxHeight:"160px",overflowY:"auto",background:Zs.sur,border:`1px solid ${Zs.bdrSub}`,borderRadius:"8px",marginBottom:"8px"});{const e=ce.profileId,n=[...ce.chatroomUsers.entries()].filter(([t])=>t&&t!==e);if(n.length)n.forEach(([e,o],i)=>{const r=t.pickTargets.some(t=>t.id===e),a=al("div",{display:"flex",alignItems:"center",gap:"8px",padding:"7px 9px",cursor:"pointer",background:r?Zs.accDim:"transparent",borderBottom:i<n.length-1?`1px solid ${Zs.bdrSub}`:"none"}),s=al("span",{fontFamily:Zs.mono,fontSize:"11px",color:r?Zs.acc:Zs.muted,width:"14px"});s.textContent=r?"\u2713":"\xb7";const l=al("div",{flex:"1",minWidth:"0",fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});l.textContent=o?.name||e;const c=al("div",{fontFamily:Zs.mono,fontSize:"8.5px",color:Zs.muted,maxWidth:"72px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});c.textContent=e,a.appendChild(s),a.appendChild(l),a.appendChild(c),a.addEventListener("click",()=>js(e,o?.name||e)),j.appendChild(a)});else{const e=al("div",{padding:"10px",fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,textAlign:"center"});e.textContent="Oda bo\u015f / hen\xfcz alg\u0131lanmad\u0131",j.appendChild(e)}}const F=al("div",{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"8px",minHeight:"8px"});const roomPicks=(t.pickTargets||[]).filter(p=>p&&p.src!=="search");for(const e of roomPicks){const btn=al("button",{display:"inline-flex",alignItems:"center",gap:"4px",padding:"3px 8px",borderRadius:"999px",cursor:"pointer",outline:"none",background:Zs.accDim,border:"1px solid "+Zs.accBdr,color:Zs.acc,fontFamily:Zs.sans,fontSize:"10px",fontWeight:"600"});btn.textContent=(e.name||e.id)+" x";btn.title=e.id;btn.addEventListener("click",()=>js(e.id,e.name));F.appendChild(btn)}if(roomPicks.length){const clr=al("button",{padding:"3px 8px",borderRadius:"999px",cursor:"pointer",outline:"none",background:"transparent",border:"1px solid "+Zs.bdrSub,color:Zs.sub,fontFamily:Zs.sans,fontSize:"10px"});clr.textContent="Oda listesini temizle";clr.addEventListener("click",()=>{ce.autographer.pickTargets=(ce.autographer.pickTargets||[]).filter(p=>p&&p.src==="search");Ns()});F.appendChild(clr)}const _=al("textarea",{});Object.assign(_.style,{width:"100%",minHeight:"56px",resize:"vertical",boxSizing:"border-box",marginBottom:"6px",padding:"8px 10px",background:Zs.sur,border:`1px solid ${Zs.bdrSub}`,borderRadius:"7px",color:Zs.txt,fontFamily:Zs.mono,fontSize:"11px",outline:"none"}),_.placeholder="Nick veya ID (sat\u0131r / virg\xfcl)\n\xd6rn: Jeust\nTR|39907566\nabc\u2026uuid",_.value=t.bulkDraft||"",_.addEventListener("input",()=>{t.bulkDraft=_.value});const R=xl("Listeye ekle (nick/ID \xe7\xf6z)","autograph");R.style.marginBottom="10px",R.addEventListener("click",()=>{(async function(e){if(!Fo())return;const t=String(e||"").split(/[\n,;]+/).map(e=>e.trim()).filter(Boolean);if(!t.length)return void cd("Nick veya ID yapistir","error");const n=ce.autographer;let o=0;const i=on();for(const e of t)if(/^[0-9a-f]{32}$/i.test(e))Fs(e,e.slice(0,8)+"\u2026"),o++;else if(/^[A-Za-z]{2}\|/.test(e)){Fs(e,e),o++;try{const t=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name } }",variables:{profileIds:[e],gameId:x}})});if(t.ok){const o=await t.json(),i=(o?.data?.profiles??[])[0];if(i?.id){const t=n.pickTargets.findIndex(t=>t.id===e||t.id===i.id);t>=0?n.pickTargets[t]={id:i.id,name:i.name||i.id}:n.pickTargets.some(e=>e.id===i.id)||Fs(i.id,i.name||i.id)}}}catch{}}else{try{const t=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfileSearch($region: String!, $startsWith: String!, $pageSize: Int, $currentPage: Int, $preferredGameId: String!) { findProfiles(region: $region, nameBeginsWith: $startsWith, pageSize: $pageSize, page: $currentPage) { totalCount nodes { id } } }",variables:{region:i,startsWith:e,pageSize:10,currentPage:1,preferredGameId:x}})});if(!t.ok)continue;const n=await t.json(),r=(n?.data?.findProfiles?.nodes??[]).map(e=>e.id).filter(Boolean);if(!r.length)continue;const a=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:"query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name } }",variables:{profileIds:r,gameId:x}})});if(!a.ok)continue;const s=await a.json(),l=s?.data?.profiles??[],c=e.toLowerCase();let d=l.find(e=>String(e.name||"").toLowerCase()===c)||l.find(e=>String(e.name||"").toLowerCase().endsWith("|"+c))||l[0];d?.id&&(Fs(d.id,d.name||d.id),o++)}catch{}n.instantMode||await dn(.2,.4)}cd(o?`${o} kisi listeye eklendi`:"Eslesen oyuncu bulunamadi",o?"success":"error"),Ns()})(_.value).catch(()=>{})}),(function(){const rec=al("div",{alignSelf:"flex-start",fontSize:"9px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",padding:"3px 8px",borderRadius:"999px",color:"#081018",background:"linear-gradient(90deg,#fbbf24,#f59e0b,#f97316)",boxShadow:"0 0 14px rgba(245,158,11,.55)",marginBottom:"2px"});rec.textContent=ie==="en"?"Recommended":"\xd6nerilir";const instantWrap=al("div",{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"4px"});instantWrap.appendChild(rec);instantWrap.appendChild(d);e.appendChild(a(ie==="en"?"Send · room & selection":"G\xf6nder · oda & se\xe7im",C,[instantWrap,D,j,F,L,A,E,I]))})();try{const keep=t.searchQuery&&!t.searching;if(keep){const inp=e.querySelector('input[data-ag-search="1"]');if(inp){const pos=inp.value.length;inp.focus();try{inp.setSelectionRange(pos,pos)}catch{}}}}catch{}}function qs(e){return $o(e)}const Hs=1024,Ws=2048,Gs=B,Vs=18e4,Ks=9e4,Js=B;function Ys(e,t){const n=Number(e)||0;return!Number.isFinite(n)||n<=0?Math.min(256,t):Math.max(64,Math.min(t,Math.round(n>t?t:n)))}function Qs(e,t){const n=String(e?.message??e??"bilinmeyen hata");return/Maximum call stack|stack size/i.test(n)?`${t}: kodlama hatasi (stack) \u2014 guncel BSON encoder gerekli, eklentiyi yenile`:/HTTP\s*413|too large|entity too large|payload/i.test(n)?`${t}: dosya cok buyuk (sunucu limiti)`:/InvalidSignature|signature/i.test(n)?`${t}: imza reddedildi`:(/HTTP\s*4\d\d|HTTP\s*5\d\d/i.test(n),n.length>180?n.slice(0,180)+"\u2026":n)}let Xs=null;const Zs={bg:"#080810",sur:"#0d0d1a",surAlt:"#111122",bdr:"rgba(245,158,11,0.10)",bdrSub:"rgba(255,255,255,0.06)",txt:"#f0eee8",sub:"#5a5570",muted:"#38344a",acc:"#f59e0b",accDim:"rgba(245,158,11,0.08)",accBdr:"rgba(245,158,11,0.22)",accGlow:"rgba(245,158,11,0.14)",err:"#ef4444",errDim:"rgba(239,68,68,0.08)",errBdr:"rgba(239,68,68,0.22)",ok:"#4ade80",okDim:"rgba(74,222,128,0.08)",okBdr:"rgba(74,222,128,0.22)",info:"#60a5fa",infoDim:"rgba(96,165,250,0.08)",sans:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",display:"'Syne', 'Inter', -apple-system, sans-serif",mono:"'Geist Mono', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace",glass:"linear-gradient(160deg, rgba(18,16,32,0.96) 0%, rgba(8,8,16,0.98) 55%, rgba(10,10,22,0.99) 100%)"};function el(e){const t=/^#?([0-9a-f]{6})$/i.exec(String(e||"").trim());if(!t)return null;const n=parseInt(t[1],16);let o=n>>16&255,i=n>>8&255,r=255&n;const dark=o+i+r<90;if(dark){o=226;i=232;r=240}const hex=dark?"e2e8f0":t[1].toLowerCase();return{acc:`#${hex}`,accDim:dark?"rgba(255,255,255,0.06)":`rgba(${o},${i},${r},0.08)`,accBdr:dark?"rgba(226,232,240,0.28)":`rgba(${o},${i},${r},0.22)`,accGlow:dark?"rgba(226,232,240,0.16)":`rgba(${o},${i},${r},0.14)`,bdr:dark?"rgba(255,255,255,0.12)":`rgba(${o},${i},${r},0.10)`}}const tl=[["yellow","#f59e0b","Sari"],["amber","#fbbf24","Kehribar"],["orange","#f97316","Turuncu"],["coral","#fb7185","Mercan"],["red","#ef4444","Kirmizi"],["rose","#f43f5e","Gul"],["pink","#ec4899","Pembe"],["fuchsia","#d946ef","Fusya"],["purple","#a855f7","Mor"],["violet","#8b5cf6","Menekse"],["indigo","#6366f1","Indigo"],["blue","#3b82f6","Mavi"],["sky","#0ea5e9","Gok"],["cyan","#22d3ee","Camgobegi"],["teal","#14b8a6","Deniz"],["emerald","#10b981","Zumrut"],["green","#4ade80","Yesil"],["lime","#a3e635","Lime"],["white","#e8e6e0","Beyaz"],["silver","#94a3b8","Gumus"],["neonpink","#ff2bd6","Neon Pembe"],["neoncyan","#00f0ff","Neon Cyan"],["neonlime","#b8ff00","Neon Lime"],["neongold","#ffd60a","Neon Altın"],["neonpurple","#c77dff","Neon Mor"],["neonorange","#ff6b00","Neon Turuncu"],["aurora","#5efce8","Aurora"],["magma","#ff3d00","Magma"],["ice","#7dd3fc","Buz"],["void","#0a0a0a","Siyah"]],nl=Object.fromEntries(tl.map(([e,t])=>[e,el(t)])),ol=tl.map(([e,t,n])=>[e,t,n]);let il="yellow";{const e=q(_.theme);e&&nl[e]&&(il=e,Object.assign(Zs,nl[e]))}function rl(e){if(!nl[e]||e===il)return;il=e,H(_.theme,e),Object.assign(Zs,nl[e]);try{void 0!==Wc&&Wc&&(Wc.remove(),Wc=null,Vc=null)}catch{}if(!Cc)return;const t=Cc.getBoundingClientRect(),n=!(!Pc.settingsPanel||"none"===Pc.settingsPanel.style.display),o=Tc;let i=!1;try{i=!(void 0===Rs||!Rs||"none"===Rs.style.display)}catch{i=!1}if(Cc.remove(),Cc=null,void 0!==Rs&&Rs){try{Rs.remove()}catch{}Rs=null,delete Pc.agFloatBody}if(Ic=!1,$d(),Cc){Cc.style.top=Math.round(t.top)+"px",Cc.style.left=Math.round(t.left)+"px",Cc.style.right="auto",Cc.style.animation="none";try{bl?.()}catch{}}if(o&&"profile"!==o)try{sd(o)}catch{}if(n&&Pc.settingsPanel&&(Pc.settingsPanel.style.display="block"),i)try{Rs||Us(),Rs&&(Rs.style.display="flex")}catch{}}function al(e,t){const n=document.createElement(e);return t&&Object.assign(n.style,t),n}const sl={gender:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 12v9"/><path d="M9 18l3 3 3-3"/><path d="M7 3l-3 3 3 3"/><path d="M4 6h6"/></svg>',mood:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',status:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',restore:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',heart:'<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',quests:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',crystal:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 8 19 16 12 22 5 16 5 8 12 2"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="8" x2="19" y2="8"/></svg>',accept:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',reject:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',message:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',bot:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',info:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',misc:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>',upload:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',image:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',pkg:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',autograph:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',stop:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',user:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',friends:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',home:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>',copy:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',outfit:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.41a1 1 0 00.99.9H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.9l.58-3.41a2 2 0 00-1.34-2.23z"/></svg>',gear:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'};let ll=!1;const cl=e=>{ll&&e.stopImmediatePropagation()};function dl(){const e=document.querySelector("canvas");e&&(e._savedTabIndex=e.getAttribute("tabindex"),e.setAttribute("tabindex","-1"),e.blur()),ll=!0}function pl(){const e=document.querySelector("canvas");e&&(null!=e._savedTabIndex?e.setAttribute("tabindex",e._savedTabIndex):e.removeAttribute("tabindex"),delete e._savedTabIndex),ll=!1}function ul(){const e=(e,t)=>{if(!e)return;let n=e.getElementById?e.getElementById(t):e.querySelector?.("#"+t);if(!n){n=document.createElement("link"),n.id=t,n.rel="stylesheet";try{n.crossOrigin="anonymous"}catch{}e.appendChild(n)}n.href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Playfair+Display:wght@600;700&family=Bebas+Neue&family=JetBrains+Mono:wght@500;700&family=Caveat:wght@600;700&family=Rubik:wght@500;700&family=Cinzel:wght@600;700&family=Pacifico&display=swap"};try{document.head&&e(document.head,"xb-fonts-doc")}catch{}try{const t=j();t&&e(t,A.fonts)}catch{}}const fl=[{id:"outfit",name:"Outfit",css:"'Outfit', sans-serif"},{id:"playfair",name:"Playfair",css:"'Playfair Display', Georgia, serif"},{id:"bebas",name:"Bebas Neue",css:"'Bebas Neue', Impact, sans-serif"},{id:"jetbrains",name:"JetBrains Mono",css:"'JetBrains Mono', Consolas, monospace"},{id:"caveat",name:"Caveat",css:"'Caveat', cursive"},{id:"rubik",name:"Rubik",css:"'Rubik', sans-serif"},{id:"cinzel",name:"Cinzel",css:"'Cinzel', Georgia, serif"},{id:"pacifico",name:"Pacifico",css:"'Pacifico', cursive"}];function ml(e){const t=e||("function"==typeof q?q(_.panelFont):null)||"arial",n=fl.find(e=>e.id===t);return n&&n.css||fl[0].css}function gl(){try{const e="function"==typeof q?q(_.panelTitle):null,t=null!=e?String(e).trim():"";if(t)return t.slice(0,32)}catch{}try{return re("brand_name")}catch{return"6x0k Space"}}function hl(){try{const e=parseFloat("function"==typeof q?q(_.panelOpacity):null);if(Number.isFinite(e))return Math.min(1,Math.max(.12,e))}catch{}return.97}function yl(e,t){if(!e||1!==e.nodeType)return;const n=(e.tagName||"").toLowerCase();if("style"===n||"link"===n||"svg"===n||"path"===n)return;try{e.style.setProperty("font-family",t,"important")}catch{}const o=e.children;if(o)for(let e=0;e<o.length;e++)yl(o[e],t)}try{if(!document.getElementById("xb-fonts")){const l=document.createElement("link");l.id="xb-fonts";l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=IBM+Plex+Sans:wght@400;600;700&family=JetBrains+Mono:wght@500;700&family=Manrope:wght@500;700&family=Outfit:wght@500;700;800&family=Plus+Jakarta+Sans:wght@500;700&family=Sora:wght@500;700&family=Space+Grotesk:wght@500;700&display=swap";(document.head||document.documentElement).appendChild(l)}}catch{}function bl(){if(Cc)try{ul();const e=hl(),t=ml();try{Zs.sans=t,Zs.display=t}catch{}const n=Math.max(.45,e);Cc.style.opacity=String(n),Cc.style.fontFamily=t;const o=Math.max(.04,Math.min(.98,.08+.9*e));Cc.style.background=`linear-gradient(160deg, rgba(18,16,32,${o.toFixed(3)}) 0%, rgba(8,8,16,${Math.min(.99,o+.02).toFixed(3)}) 55%, rgba(10,10,22,${Math.min(1,o+.04).toFixed(3)}) 100%)`;try{const t=e<.5?Math.round(4+16*(.5-e)):8;Cc.style.backdropFilter=`blur(${t}px)`,Cc.style.webkitBackdropFilter=Cc.style.backdropFilter}catch{}Pc.panelTitleEl&&(Pc.panelTitleEl.textContent=gl());const i=j();if(i){let e=i.getElementById(A.kf+"-app");e||(e=document.createElement("style"),e.id=A.kf+"-app",i.appendChild(e)),e.textContent=[`#${A.wrap}{`,`  font-family:${t}!important;`,`  opacity:${n}!important;`,"}",`#${A.wrap},#${A.wrap} *{font-family:${t}!important;}`,`#${A.wrap} svg,#${A.wrap} svg *{font-family:inherit!important;}`].join("")}!function(e){try{Cc&&yl(Cc,e)}catch{}try{void 0!==Rs&&Rs&&yl(Rs,e)}catch{}try{void 0!==Ss&&Ss&&yl(Ss,e)}catch{}try{void 0!==Xs&&Xs&&yl(Xs,e)}catch{}try{const t=j();if(t)for(const n of t.querySelectorAll("[id]"))try{n!==Cc&&n.style&&"fixed"===n.style.position&&yl(n,e)}catch{}}catch{}}(t)}catch{}}function xl(e,t,n){const o="danger"===n,i="ok"===n,r="secondary"===n,a="primary"===n||!n&&!o&&!i&&!r;let s,l,c,d,p,u,f;o?(s=Zs.errDim,l=Zs.errBdr,c=Zs.err,d="rgba(239,68,68,0.15)",p="rgba(239,68,68,0.40)",u="0 0 14px rgba(239,68,68,0.12)",f="rgba(239,68,68,0.18)"):i?(s=Zs.okDim,l=Zs.okBdr,c=Zs.ok,d="rgba(74,222,128,0.15)",p="rgba(74,222,128,0.40)",u="0 0 14px rgba(74,222,128,0.12)",f="rgba(74,222,128,0.18)"):r?(s="rgba(255,255,255,0.02)",l=Zs.bdrSub,c=Zs.sub,d="rgba(255,255,255,0.05)",p="rgba(255,255,255,0.12)",u="none",f=Zs.bdrSub):(s=a?`linear-gradient(180deg, ${Zs.accDim}, rgba(0,0,0,0.12))`:Zs.accDim,l=Zs.accBdr,c=Zs.acc,d=Zs.accGlow,p=Zs.accBdr,u=`0 0 16px ${Zs.accGlow}`,f=Zs.accBdr);const m=al("button",{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",width:"100%",padding:ce.ui?.compact?"6px 12px":"8px 14px",background:s,border:`1px solid ${l}`,borderRadius:"7px",color:c,fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:a?"600":"500",letterSpacing:"0.02em",cursor:"pointer",outline:"none",position:"relative",overflow:"hidden",boxSizing:"border-box",transition:"background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.1s, opacity 0.15s"}),g=t?function(e){const t=al("span",{display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:"0",lineHeight:"1"});return t.innerHTML=sl[e]||sl.user||"",t}(t):null,h=al("span",{transition:"opacity 0.12s",pointerEvents:"none"});h.textContent=e;const y=al("span",{display:"none",position:"absolute",inset:"0",alignItems:"center",justifyContent:"center",pointerEvents:"none"}),b=al("span",{display:"block",width:"12px",height:"12px",border:`1.5px solid ${f}`,borderTopColor:c,borderRadius:"50%",animation:"ax-spin 0.5s linear infinite"});return y.appendChild(b),g&&m.appendChild(g),m.appendChild(h),m.appendChild(y),m.addEventListener("mouseenter",()=>{m.disabled||(m.style.background=d,m.style.borderColor=p,m.style.boxShadow=u,m.style.transform="translateY(-1px)")}),m.addEventListener("mouseleave",()=>{m.style.background=s,m.style.borderColor=l,m.style.boxShadow="",m.style.transform=""}),m.addEventListener("mousedown",()=>{m.disabled||(m.style.transform="translateY(0) scale(0.98)")}),m.addEventListener("mouseup",()=>{m.disabled||(m.style.transform="translateY(-1px)")}),m.setLoading=e=>{m.disabled=e,m.style.opacity=e?"0.6":"1",m.style.cursor=e?"not-allowed":"pointer",h.style.opacity=e?"0":"1",g&&(g.style.opacity=e?"0":"1"),y.style.display=e?"flex":"none"},m.setDisabled=e=>{m.disabled=e,m.style.opacity=e?"0.28":"1",m.style.cursor=e?"not-allowed":"pointer"},m._lbl=h,m}function kl(e){const t=al("input",{display:"block",width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.03)",border:`1px solid ${Zs.bdrSub}`,borderRadius:"6px",color:Zs.txt,fontFamily:Zs.sans,fontSize:"12px",fontWeight:"400",outline:"none",boxSizing:"border-box",marginBottom:"8px",transition:"border-color 0.15s, box-shadow 0.15s"});t.type="text",t.placeholder=e,t.addEventListener("mousedown",e=>e.stopImmediatePropagation()),t.addEventListener("click",e=>{e.stopImmediatePropagation(),t.focus()}),t.addEventListener("focus",()=>{t.style.borderColor=Zs.accBdr,t.style.boxShadow=`0 0 0 3px ${Zs.accGlow}`,dl()}),t.addEventListener("blur",()=>{t.style.borderColor=Zs.bdrSub,t.style.boxShadow="",pl()});for(const e of["keydown","keypress","keyup"])t.addEventListener(e,e=>e.stopImmediatePropagation());return t}function wl(e){const t=al("select",{display:"block",width:"100%",padding:"8px 28px 8px 10px",background:"rgba(255,255,255,0.03)",border:`1px solid ${Zs.bdrSub}`,borderRadius:"6px",color:Zs.txt,fontFamily:Zs.sans,fontSize:"12px",fontWeight:"400",outline:"none",cursor:"pointer",boxSizing:"border-box",marginBottom:"8px",appearance:"none",WebkitAppearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a5570' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",transition:"border-color 0.15s, box-shadow 0.15s"});t.addEventListener("mousedown",e=>e.stopImmediatePropagation()),t.addEventListener("click",e=>e.stopImmediatePropagation()),t.addEventListener("focus",()=>{t.style.borderColor=Zs.accBdr,t.style.boxShadow=`0 0 0 3px ${Zs.accGlow}`,dl()}),t.addEventListener("blur",()=>{t.style.borderColor=Zs.bdrSub,t.style.boxShadow="",pl()});for(const e of["keydown","keypress","keyup"])t.addEventListener(e,e=>e.stopImmediatePropagation());for(const[n,o]of e){const e=document.createElement("option");e.value=n,e.textContent=o,e.style.background=Zs.sur,t.appendChild(e)}return t}function vl(...e){const t=al("div",{padding:ce.ui?.compact?"10px 11px":"13px 12px",marginBottom:"10px",border:`1px solid ${Zs.bdrSub}`,borderRadius:"11px",background:`linear-gradient(155deg, ${Zs.sur} 0%, rgba(255,255,255,0.015) 100%)`,boxShadow:`0 0 0 1px ${Zs.accGlow} inset, 0 10px 24px rgba(0,0,0,0.28)`,boxSizing:"border-box",animation:"ax-fi 0.22s cubic-bezier(0.16, 1, 0.3, 1) both"});for(const n of e)n&&t.appendChild(n);return t}function Sl(e,t,n){const o=al("div",{marginBottom:ce.ui?.compact?"8px":"11px"}),i=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:t?"3px":"0"}),r=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,letterSpacing:"-0.01em",flex:"1",minWidth:"0"});if(r.textContent=e,i.appendChild(r),n&&i.appendChild(n),o.appendChild(i),t){const e=String(t).length>110?String(t).slice(0,108)+"\u2026":t,n=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"400",color:Zs.sub,lineHeight:"1.45"});n.textContent=e,n.title=t,o.appendChild(n)}return o}function Cl(e){const t=Number(e);return Number.isFinite(t)?t>=1e6?(t/1e6).toFixed(1).replace(/\.0$/,"")+"M":t>=1e3?(t/1e3).toFixed(1).replace(/\.0$/,"")+"k":String(Math.floor(t)):"\u2014"}function Il(e,t,n){const o=al("div",{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"11px"}),i=al("div",{flex:"1",minWidth:"0"}),r=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,marginBottom:"4px",letterSpacing:"-0.01em"});if(r.textContent=e,i.appendChild(r),t){const e=String(t).length>110?String(t).slice(0,108)+"\u2026":t,n=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"400",color:Zs.sub,lineHeight:"1.45"});n.textContent=e,n.title=t,i.appendChild(n)}const a=al("span",{fontFamily:Zs.mono,fontSize:"10px",fontWeight:"500",color:Zs.acc,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",padding:"2px 7px",whiteSpace:"nowrap",flexShrink:"0",letterSpacing:"0.03em"});if(a.textContent="\u2014",o.appendChild(i),n){const e=al("div",{display:"flex",alignItems:"center",gap:"6px",flexShrink:"0",marginTop:"1px"});e.appendChild(n),e.appendChild(a),o.appendChild(e)}else o.appendChild(a);return{row:o,badge:a}}function $l(e,t){const n=al("div",{position:"relative",flexShrink:"0"}),o=al("button",{width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"4px",color:Zs.sub,cursor:"pointer",outline:"none",padding:"0",boxSizing:"border-box",transition:"background 0.12s, border-color 0.12s, color 0.12s"});o.title=`${t} speed`,o.setAttribute("aria-label",`${t} speed`),o.innerHTML=sl.gear,o.addEventListener("mouseenter",()=>{"block"!==i.style.display&&(o.style.background=Zs.accDim,o.style.borderColor=Zs.accBdr,o.style.color=Zs.acc)}),o.addEventListener("mouseleave",()=>{"block"!==i.style.display&&(o.style.background="transparent",o.style.borderColor=Zs.bdrSub,o.style.color=Zs.sub)});const i=al("div",{position:"absolute",top:"calc(100% + 6px)",right:"0",minWidth:"128px",background:Zs.bg,border:`1px solid ${Zs.bdr}`,borderRadius:"6px",boxShadow:`0 10px 26px rgba(0,0,0,0.7), 0 0 0 1px ${Zs.accGlow} inset`,padding:"4px",zIndex:"20",display:"none",boxSizing:"border-box"});function r(){i.innerHTML="";const n=ce.speeds[e];for(const o of W){const a=o===n,l=al("button",{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"6px 8px",background:a?Zs.accDim:"transparent",border:"none",borderRadius:"4px",outline:"none",color:a?Zs.acc:Zs.txt,cursor:"pointer",fontFamily:Zs.sans,fontSize:"11px",fontWeight:a?"600":"400",textAlign:"left"}),c=al("span");c.textContent=V[o];const d=al("span",{fontFamily:Zs.mono,fontSize:"9.5px",color:a?Zs.acc:Zs.muted,letterSpacing:"0.02em"});d.textContent=`${G[o]}\xd7`,l.appendChild(c),l.appendChild(d),l.addEventListener("mouseenter",()=>{a||(l.style.background="rgba(255,255,255,0.04)")}),l.addEventListener("mouseleave",()=>{a||(l.style.background="transparent")}),l.addEventListener("click",n=>{n.stopImmediatePropagation(),ce.speeds[e]=o,Y(e,o),r(),s(),cd(`${t}: ${V[o]}`,"info")}),i.appendChild(l)}}function a(){r(),i.style.display="block",o.style.background=Zs.accDim,o.style.borderColor=Zs.accBdr,o.style.color=Zs.acc;const e=j()??document;setTimeout(()=>e.addEventListener("mousedown",l,!0),0)}function s(){i.style.display="none",o.style.background="transparent",o.style.borderColor=Zs.bdrSub,o.style.color=Zs.sub;(j()??document).removeEventListener("mousedown",l,!0)}function l(e){n.contains(e.target)||s()}return o.addEventListener("click",e=>{e.stopImmediatePropagation(),"block"===i.style.display?s():a()}),n.appendChild(o),n.appendChild(i),n}function Bl(e){const t=al("div",{display:"flex",alignItems:"flex-start",gap:"8px",padding:"8px 10px",marginBottom:"10px",background:Zs.accDim,border:`1px solid ${Zs.bdr}`,borderRadius:"5px",boxSizing:"border-box"}),n=al("span",{flexShrink:"0",color:Zs.acc,lineHeight:"1",marginTop:"1px"});n.innerHTML=sl.info;const o=al("span",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"400",color:Zs.sub,lineHeight:"1.6"});return o.textContent=e,t.appendChild(n),t.appendChild(o),t}function zl(e,t,n,o,i){const r=al("div",{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"14px",padding:"12px 0",borderBottom:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box",cursor:"pointer"}),a=al("div",{flex:"1",minWidth:"0"}),s=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,marginBottom:"4px",letterSpacing:"-0.01em"});if(s.textContent=e,a.appendChild(s),t){const e=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"400",color:Zs.sub,lineHeight:"1.55"});e.textContent=t,a.appendChild(e)}const l=al("div",{position:"relative",flexShrink:"0",width:"34px",height:"18px",borderRadius:"9px",background:n?Zs.acc:"rgba(255,255,255,0.08)",border:`1px solid ${n?Zs.acc:Zs.bdrSub}`,transition:"background 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), border-color 0.2s",cursor:"pointer",boxSizing:"border-box",marginTop:"1px"}),c=al("div",{position:"absolute",top:"2px",left:n?"16px":"2px",width:"12px",height:"12px",borderRadius:"50%",background:n?Zs.bg:Zs.sub,transition:"left 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), background 0.2s, transform 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.4)"});l.appendChild(c);let d=n;if(r.addEventListener("click",function(){d=!d,l.style.background=d?Zs.acc:"rgba(255,255,255,0.08)",l.style.borderColor=d?Zs.acc:Zs.bdrSub,c.style.left=d?"16px":"2px",c.style.background=d?Zs.bg:Zs.sub,c.style.animation="ax-spring 0.28s ease",setTimeout(()=>{try{c.style.animation=""}catch{}},300),o(d)}),r.appendChild(a),i){const e=al("div",{display:"flex",alignItems:"center",gap:"8px",flexShrink:"0",marginTop:"1px"});e.appendChild(i),e.appendChild(l),r.appendChild(e)}else r.appendChild(l);return r._getChecked=()=>d,r._setChecked=function(e){d=!!e,l.style.background=d?Zs.acc:"rgba(255,255,255,0.08)",l.style.borderColor=d?Zs.acc:Zs.bdrSub,c.style.left=d?"16px":"2px",c.style.background=d?Zs.bg:Zs.sub},r}function Tl(e){let t=null;const n=al("div",{position:"relative",marginBottom:"10px",borderRadius:"8px",overflow:"hidden",border:`1.5px dashed ${Zs.accBdr}`,background:Zs.accDim,transition:"border-color 0.15s, background 0.15s, min-height 0.2s",cursor:"pointer",boxSizing:"border-box",minHeight:"42px"}),o=al("div",{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",padding:"12px 10px",pointerEvents:"none"}),i=al("span",{color:Zs.sub,lineHeight:"1",opacity:"0.6"});i.innerHTML=sl.image;const r=al("span",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"500",color:Zs.sub,textAlign:"center",lineHeight:"1.5"});r.textContent=re("drop_image_here");const a=al("span",{fontFamily:Zs.mono,fontSize:"10px",fontWeight:"400",color:Zs.muted,letterSpacing:"0.03em"});a.textContent="PNG \xb7 JPG \xb7 WEBP \xb7 GIF",o.appendChild(i),o.appendChild(r),o.appendChild(a),n.appendChild(o);const s=al("div",{display:"none",position:"relative",width:"100%",height:"100%"}),l=al("img",{width:"100%",height:"100%",objectFit:"cover",display:"block",borderRadius:"6px"}),c=al("div",{position:"absolute",inset:"0",background:"linear-gradient(to top, rgba(8,8,16,0.85) 0%, transparent 50%)",borderRadius:"6px",pointerEvents:"none"}),d=al("div",{position:"absolute",bottom:"8px",left:"10px",right:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",pointerEvents:"none"}),p=al("span",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"200px"}),u=al("button",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"500",color:Zs.err,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:"4px",padding:"2px 7px",cursor:"pointer",outline:"none",flexShrink:"0",pointerEvents:"all"});u.textContent="Kaldir",d.appendChild(p),d.appendChild(u),s.appendChild(l),s.appendChild(c),s.appendChild(d),n.appendChild(s);const f=document.createElement("input");f.type="file",f.accept="image/png,image/jpeg,image/webp,image/gif,image/*",Object.assign(f.style,{display:"none"});for(const e of["mousedown","click","keydown","keypress","keyup"])f.addEventListener(e,e=>e.stopImmediatePropagation());function m(){t=null,l.src="",o.style.display="flex",s.style.display="none",n.style.minHeight="56px",n.style.borderStyle="dashed",n.style.borderColor=Zs.accBdr,n.style.background=Zs.accDim,f.value="",e(null)}function g(i){i&&i.type.startsWith("image/")?function(i){t=i;const r=new FileReader;r.onload=e=>{l.src=e.target.result},r.readAsDataURL(i),p.textContent=i.name,o.style.display="none",s.style.display="block",n.style.minHeight="120px",n.style.borderStyle="solid",n.style.borderColor=Zs.accBdr,n.style.background=Zs.accDim,e(i)}(i):cd("Only image files are accepted","error")}return n.appendChild(f),n.addEventListener("click",e=>{e.target===u||u.contains(e.target)||(e.stopImmediatePropagation(),f.click())}),u.addEventListener("click",e=>{e.stopImmediatePropagation(),m()}),f.addEventListener("change",()=>{const e=f.files?.[0];e&&g(e)}),n.addEventListener("dragover",e=>{e.preventDefault(),e.stopImmediatePropagation(),n.style.borderColor=Zs.acc,n.style.background=Zs.accDim,n.style.animation="ax-dz-pulse 1s ease infinite"}),n.addEventListener("dragleave",e=>{e.stopImmediatePropagation(),t||(n.style.borderColor=Zs.accBdr,n.style.background=Zs.accDim,n.style.animation="")}),n.addEventListener("drop",e=>{e.preventDefault(),e.stopImmediatePropagation(),n.style.animation="";const t=e.dataTransfer?.files?.[0];t&&g(t)}),n._reset=m,n}async function Ll(e,t){const n=await cn(`${k}/edgerelationships/graphql`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json"},body:JSON.stringify({query:e,variables:t})});if(!n.ok)throw new Error(`HTTP ${n.status}`);const o=await n.json();if(o?.errors?.[0]?.message)throw new Error(o.errors[0].message);return o}function Pl(e){const t=e?.membership?.currentTierExpiry||e?.membership?.lastTierExpiry||null;if(!t)return{active:!1,text:"VIP yok / bilinmiyor"};const n=new Date(t);if(!Number.isFinite(n.getTime()))return{active:!1,text:"VIP bilinmiyor"};const o=n.getTime()-Date.now();if(o<=0)return{active:!1,text:"VIP bitmis",until:n.toISOString()};return{active:!0,text:`${Math.ceil(o/864e5)} gun`,until:n.toISOString()}}function Ml(e){if(!e)return"";const t=new Date(e);return Number.isFinite(t.getTime())?t.toLocaleString("tr-TR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):String(e)}function Al(e){const t=Number(e);return Number.isFinite(t)?t:null}function El(e){const t=function(e){if(!e)return null;if("object"==typeof e)return e;if("string"!=typeof e)return null;try{return JSON.parse(e)}catch{return null}}(e);if(!t||"object"!=typeof t)return null;const n=String(t.roomType||t.RoomType||"").trim();if(!n)return null;const o={roomType:n},i=t.position||t.Position||null;if(i&&"object"==typeof i){const e=Al(i.x??i.X),t=Al(i.y??i.Y),n=Al(i.z??i.Z);null!=e&&null!=t&&null!=n&&(o.position={x:e,y:t,z:n})}const r=Al(t.loadMode??t.LoadMode),a=Al(t.direction??t.Direction),s=String(t.roomsVersion||t.RoomsVersion||"").trim();return null!=r&&(o.loadMode=r),null!=a&&(o.direction=a),s&&(o.roomsVersion=s),o}function Dl(e,t){if(e?.roomType){const n=[`Oda: ${e.roomType}`];return e.roomsVersion&&n.push(e.roomsVersion),t&&n.push("su an senin odanda"),n.join(" | ")}return t?ce.chatroomRoomId?`Mevcut oda: ${ce.chatroomRoomId}`:"Mevcut odada":"Oda datasi yok / gorunmuyor"}async function jl(e){try{const t=await cn(`${k}/profileattributes/v1/profiles/${encodeURIComponent(e)}/games/${x}/attributes`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});return t.ok?{data:await t.json(),error:null}:{data:null,error:`HTTP ${t.status}`}}catch(e){return{data:null,error:String(e?.message||e||"attrs alinamadi")}}}function Fl(e){if(!e||"number"!=typeof e.level)return{text:"API vermedi",progress:""};const t=[`Lvl ${e.level}`];"number"==typeof e.xp&&t.push(`${e.xp.toLocaleString("tr-TR")} XP`);let n="";const o=Number(e.currentLevelXpMin),i=Number(e.currentLevelXpMax),r=Number(e.xp);if(Number.isFinite(o)&&Number.isFinite(i)&&Number.isFinite(r)&&i>o){n=`%${Math.max(0,Math.min(100,Math.round((r-o)/(i-o)*100)))} (${Math.max(0,r-o).toLocaleString("tr-TR")} / ${(i-o).toLocaleString("tr-TR")})`}return{text:t.join(" | "),progress:n}}function _l(...e){for(const t of e){if(!t)continue;const e=new Date(t);if(Number.isFinite(e.getTime()))return e.toISOString();if("string"==typeof t&&t.trim())return t.trim()}return null}async function Rl(e){const t={lastLogin:null,source:null,online:!1};try{if(ce.chatroomUsers.get(e))return t.online=!0,t.lastLogin=(new Date).toISOString(),t.source="chatroom",t}catch{}const n=[`${k}/profilepresence/v1/profiles/${encodeURIComponent(e)}`,`${k}/presence/v1/profiles/${encodeURIComponent(e)}`,`${k}/profileidentity/v1/profiles/${encodeURIComponent(e)}`];for(const e of n)try{const n=await cn(e,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(!n.ok)continue;const o=await n.json(),i=Array.isArray(o)?o[0]:o;if(!i||"object"!=typeof i)continue;const r=_l(i.lastLogin,i.lastSeen,i.lastOnline,i.lastActivity,i.lastActive,i.updated,i.updatedAt,i.modified,i.loginDate,i.lastLoginDate,i.created,i.createdAt);if(r)return t.lastLogin=r,t.source=e.includes("presence")?"presence":"identity",!0!==i.online&&!0!==i.isOnline&&"Online"!==i.status||(t.online=!0),t}catch{}return t}async function Ol(e){const[t,n,o,i]=await Promise.all([jl(e.id),no(e.id).catch(()=>null),mn(e.id).catch(()=>null),Rl(e.id).catch(()=>({lastLogin:null,source:null,online:!1}))]),r=function(e,t){const n=e?.additionalData||{},o=El(n.ChatRoomPositionData);return{mood:n.Mood||n.mood||"",gender:n.Gender||n.gender||"",waydId:n.WAYD||n.Wayd||n.wayd||"",defaultHome:n.DefaultMyHome||"",welcomeVersion:n.WelcomeVersion||"",migrated:n.IsMigrated||"",avatarId:e?.avatarId||e?.avatar?.id||"",updatedRaw:e?.updated||e?.lastUpdated||e?.lastModified||e?.created||null,updated:Ml(e?.updated||e?.lastUpdated||e?.lastModified),roomData:o,error:t||""}}(t.data,t.error),a=function(e,t){const n=ce.chatroomUsers.get(e),o=El(t?.ChatRoomPositionData);return{text:Dl(o,n),roomId:n&&ce.chatroomRoomId||null,mood:n?.mood||t?.Mood||t?.mood||null,faceUrl:n?.faceUrl||null,data:o,source:o?"profileattributes":n?"chatroom":null}}(e.id,t.data?.additionalData||{});!a.data&&r.roomData&&(a.data=r.roomData);const s=r.waydId?await async function(e){const t=String(e||"").trim();if(!t)return null;const n={id:t,text:"",edited:"",privacy:"",reactions:"",comments:null};try{const e=await so(`/profilegeneratedcontent/v2/profiles/content/${encodeURIComponent(t)}`);n.edited=Ml(e?.lastEditedDate||e?.updated||e?.created),n.privacy=String(e?.privacyStatus||e?.privacy||"").trim(),n.comments="number"==typeof e?.commentCount?e.commentCount:null;const o=Array.isArray(e?.reactions)?e.reactions:[];n.reactions=o.map(e=>`${e.reactionTypeId||e.type||"react"}:${e.count??0}`).slice(0,3).join(" ");const i=zo(e,"PgcV1");if(i&&c){const e=await cn(`${w}/${i}`,{method:"GET"});if(e.ok){const t=c.deserialize(new Uint8Array(await e.arrayBuffer()),{promoteValues:!1,promoteLongs:!1,promoteBuffers:!1}),o=Array.isArray(t?.Texts)?t.Texts:[];n.text=String(o[0]||"").trim()}}return n}catch{return n}}(r.waydId):null,l=_l(e.lastLogin,e.lastSeen,e.lastOnline,e.lastActivity,i?.lastLogin,(s?.edited&&s.edited.includes("."),null),r.updatedRaw,s&&(t.data,null))||i?.lastLogin||r.updatedRaw||null;let d=null;return!l&&s?.edited&&(d=s.edited),{id:e.id,name:e.name||"Unknown",culture:e.culture||"",avatarGame:e.avatar?.gameId||"",faceUrl:a.faceUrl||o||null,vip:Pl(e),room:a,attrs:r,mood:r.mood||a.mood||null,wayd:s,exp:n,expInfo:Fl(n),lastLogin:l,lastLoginSource:i?.source||(l&&r.updatedRaw===l?"attrs":null),online:!!(i?.online||a.faceUrl&&ce.chatroomUsers.get(e.id)),activityProxy:d}}async function Ul(e){const t=String(e||"").trim();let n=[];if(gn(t))n=[t.toLowerCase()];else{const e=await async function(e){if(!ce.accessToken||!e)return null;try{const t=await cn(`${k}/profileidentity/v1/profiles/${encodeURIComponent(e)}`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(!t.ok)return null;const n=await t.json(),o=Array.isArray(n)?n[0]:n,i=String(o?.login||o?.id||"").trim().toLowerCase();return gn(i)?i:null}catch(e){return null}}(t);if(e)n=[e];else{const e=on(),o=await Ll("query GetProfileSearch($region: String!, $startsWith: String!, $pageSize: Int, $currentPage: Int, $preferredGameId: String!) { findProfiles(region: $region, nameBeginsWith: $startsWith, pageSize: $pageSize, page: $currentPage) { totalCount nodes { id avatar(preferredGameId: $preferredGameId) { gameId } } } }",{region:e,startsWith:t,pageSize:20,currentPage:1,preferredGameId:x});n=(o?.data?.findProfiles?.nodes||[]).map(e=>e.id).filter(Boolean)}}if(!n.length)return[];const o=await Ll("query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name culture avatar(preferredGameId: $gameId){ gameId } membership { lastTierExpiry } } }",{profileIds:n,gameId:x});let i=o?.data?.profiles||[];if(!gn(t)){const e=t.toLowerCase();i=[...i].sort((t,n)=>{const o=String(t.name||"").toLowerCase(),i=String(n.name||"").toLowerCase();return(o===e||o.endsWith("|"+e)?0:1)-(i===e||i.endsWith("|"+e)?0:1)||o.localeCompare(i)})}return Promise.all(i.slice(0,8).map(e=>Ol(e)))}async function Nl(e){const t=String(e||"").trim();t?Fo()&&(ce.profileLookup.query=t,ce.profileLookup.errorMsg=null,ce.profileLookup.selected=null,ce.profileLookup.results=[],Jl(),await _o("profileLookup",async()=>{const e=await Ul(t);ce.profileLookup.results=e,ce.profileLookup.selected=e[0]||null,e.length||(ce.profileLookup.errorMsg="Profil bulunamadi"),Jl(),e[0]?cd(`Profil acildi: ${e[0].name}`,"success"):cd("Profil bulunamadi","info")}).catch(e=>{ce.profileLookup.errorMsg=String(e?.message||"Profil bilgisi alinamadi"),Jl(),cd(ce.profileLookup.errorMsg,"error")})):cd("Nick veya profile ID yaz","error")}async function ql(e){const t=function(){try{const e=tn(ce.accessToken)?.culture;if(e&&String(e).includes("-"))return String(e)}catch{}const e=String(on()||"TR").toLowerCase();return"tr"===e?"tr-TR":"gb"===e||"uk"===e?"en-GB":"us"===e?"en-US":"de"===e?"de-DE":"fr"===e?"fr-FR":"pl"===e?"pl-PL":"nl"===e?"nl-NL":"es"===e?"es-ES":"pt"===e?"pt-PT":"se"===e||"sv"===e?"sv-SE":`${e}-${e.toUpperCase()}`}()||"tr-TR",n={joinType:"JoinProfile",roomType:"chatroom",roomInstanceId:null,profileIdToJoin:String(e),parameters:{Culture:t}},o=await cn(`${k}/matchmaker/v1/games/${x}/reservations/`,{method:"POST",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/json",accept:"application/json","x-msp-game-id":x},body:JSON.stringify(n)});let i=null;try{i=await o.json()}catch{i=null}const r=String(i?.hostUrl||"").trim(),a=String(i?.roomId||"").trim();return 200===o.status&&r?{ok:!0,status:"ok",hostUrl:r,roomId:a,http:200}:409===o.status?r&&a?{ok:!0,status:"ok",hostUrl:r,roomId:a,http:409}:{ok:!1,status:"oda_dolu",hostUrl:r,roomId:a,http:409}:404===o.status?{ok:!1,status:"hedef_offline",http:404}:{ok:!1,status:`http_${o.status}`,error:i?.message||i?.reasonPhrase||"",http:o.status,hostUrl:r,roomId:a}}async function Hl(e,t={}){const n=e?.name||e?.id||"hedef",o=function(e){const t=[],n=e=>{const n=String(e||"").trim();n&&!t.includes(n)&&t.push(n)};if(!e)return t;n(e.id);const o=String(e.name||"");/^[A-Za-z]{2}\|/.test(o)&&n(o);for(const[t]of ce.chatroomUsers||[]){const o=ce.chatroomUsers.get(t);o&&e.name&&String(o.name||"").toLowerCase()===String(e.name).toLowerCase()&&n(t),e.id&&t===e.id&&n(t)}return t}(e);if(!o.length)throw new Error("Hedef profil ID yok");let i=null,r=o[0];for(const e of o){r=e;try{i=await ql(e)}catch(e){i={ok:!1,status:"err",error:String(e?.message||e)}}if(i?.ok)break;if("hedef_offline"!==i?.status&&"oda_dolu"===i?.status)break}let a=null;for(const e of o){const t=await jl(e),n=El(t?.data?.additionalData?.ChatRoomPositionData);if(n?.roomType){a=n;break}}a||(a=e?.room?.data||e?.attrs?.roomData||null);const s=a?function(e){if(!e||!e.roomType)return null;const t={roomType:e.roomType,loadMode:e.loadMode??0,direction:e.direction??2,roomsVersion:e.roomsVersion||""};if(e.position&&"object"==typeof e.position){const n=Number(e.position.x),o=Number(e.position.y),i=Number(e.position.z);Number.isFinite(n)&&Number.isFinite(o)&&Number.isFinite(i)&&(t.position={x:n+.85,y:o,z:i+.35})}return t}(a):null;if(s?.roomType){const e=await Do(),t={...e.additionalData||{}};t.ChatRoomPositionData=JSON.stringify(s),await jo({...e,additionalData:t})}let l=!1;return(o.some(e=>ce.chatroomUsers.has(e))||[...ce.chatroomUsers?.keys?.()||[]].some(t=>{const n=ce.chatroomUsers.get(t);return n?.name&&e?.name&&String(n.name).toLowerCase()===String(e.name).toLowerCase()}))&&s&&(l=function(e){const t=ce.chatroomSocket;if(!t||1!==t.readyState)return!1;if(!e?.position)return!1;const n=Number(e.position.x),o=Number(e.position.y),i=Number(e.position.z);if(!Number.isFinite(n)||!Number.isFinite(o)||!Number.isFinite(i))return!1;const r=ce.appliedMood||"default",a=e.direction??2;try{const e={position:{x:n,y:o,z:i},mood:r,direction:a,modifiers:[]};return t.send(`42${JSON.stringify(["7001",e])}`),!0}catch{return!1}}(s)),{name:n,usedPid:r,join:i,roomType:s?.roomType||a?.roomType||null,walked:l,wrotePos:!!s?.roomType,force:!!t.force,hostUrl:i?.hostUrl||"",roomId:i?.roomId||""}}async function Wl(){const e=ce.profileLookup.selected?.id;if(e)try{await navigator.clipboard.writeText(e),cd("Profil ID kopyalandi","success")}catch{cd("Pano izni yok","error")}else cd("Kopyalanacak ID yok","error")}function Gl(e,t,n,o){const i=al("div",{display:"grid",gridTemplateColumns:"96px minmax(0, 1fr)",gap:"8px",alignItems:"start",padding:"5px 0",borderBottom:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"}),r=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.muted});r.textContent=e;const a=al("div",{display:"flex",alignItems:"flex-start",gap:"6px",minWidth:"0"}),s=al("div",{fontFamily:n?Zs.mono:Zs.sans,fontSize:n?"10px":"11px",color:Zs.txt,lineHeight:"1.45",overflowWrap:"anywhere",flex:"1",minWidth:"0"});if(s.textContent=t||"-",a.appendChild(s),o&&"function"==typeof o.onCopy&&t){const e=al("button",{flexShrink:"0",padding:"2px 6px",fontSize:"9px",fontFamily:Zs.sans,fontWeight:"600",color:Zs.acc,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",cursor:"pointer",outline:"none"});e.type="button",e.textContent=o.copyLabel||"Kopyala",e.title=o.copyTitle||"Kutuphaneye ekle",e.addEventListener("click",e=>{e.stopImmediatePropagation();try{o.onCopy(String(t))}catch{}}),a.appendChild(e)}return i.appendChild(r),i.appendChild(a),i}async function Vl(){const e=ce.profileLookup.selected,t=String(e?.mood||e?.attrs?.mood||"").trim();if(e?.id)if(t){if(Fo()){try{ii(t)}catch{}await fi(t)}}else cd("Bu profilde ruh hali yok / API vermedi","info");else cd("\xd6nce nick/ID ile profil \xe7ek","error")}async function Kl(e){const t=String(e??Pc.moodPullInput?.value??"").trim();t?Fo()&&await _o("moodPull",async()=>{ce.profileLookup.query=t;const e=await Ul(t);ce.profileLookup.results=e,ce.profileLookup.selected=e[0]||null,ce.profileLookup.errorMsg=e.length?null:"Profil bulunamad\u0131",Jl();let n=String(e[0]?.mood||e[0]?.attrs?.mood||"").trim();if(!n&&e[0]?.id)try{n=String(ce.chatroomUsers.get(e[0].id)?.mood||"").trim()}catch{}if(e[0])if(n){await fi(n,{skipLibrary:!0,permanent:!0})}else cd(`${e[0].name}: ruh hali bulunamadı`,"info");else cd("Profil bulunamadı","info")}).catch(e=>cd(String(e?.message||"Ruh hali \xe7ekilemedi"),"error")):cd("Nick veya profile ID yaz","error")}function Jl(){const e=Pc.profileLookupResult,t=ce.profileLookup.selected,n=Pc.profileLookupCopyBtn;n&&n.setDisabled(!t?.id||!ce.accessToken);const o=Pc.profileLookupMoodBtn;if(o){const e=String(t?.mood||t?.attrs?.mood||"").trim(),n=!!e&&!!ce.accessToken;ce.ops.mood?.loading||ce.ops.moodPull?.loading?o.setLoading(!0):(o.setLoading(!1),o.setDisabled(!n)),o.title=n?`Uygula: ${e}`:"\xd6nce profilde ruh hali olmal\u0131"}if(Pc.moodPullBtn&&(ce.ops.moodPull?.loading||ce.ops.mood?.loading?Pc.moodPullBtn.setLoading(!0):(Pc.moodPullBtn.setLoading(!1),Pc.moodPullBtn.setDisabled(!ce.accessToken))),!e)return;if(e.innerHTML="",ce.ops.profileLookup.loading||ce.ops.moodPull?.loading){const t=al("div",{width:"52%",height:"9px",marginBottom:"8px"}),n=al("div",{width:"100%",height:"8px",marginBottom:"7px"}),o=al("div",{width:"74%",height:"8px"});return t.className="ax-skel",n.className="ax-skel",o.className="ax-skel",e.appendChild(t),e.appendChild(n),void e.appendChild(o)}if(!t){const t=al("div",{fontFamily:Zs.mono,fontSize:"10.5px",color:ce.profileLookup.errorMsg?Zs.err:Zs.sub,lineHeight:"1.6"});return t.textContent=ce.profileLookup.errorMsg||"Bilgiler burada g\xf6r\xfcnecek",void e.appendChild(t)}const i=al("div",{display:"flex",alignItems:"center",gap:"9px",marginBottom:"8px"}),r=al("div",{width:"36px",height:"36px",borderRadius:"50%",background:Zs.surAlt,border:`1px solid ${Zs.bdrSub}`,overflow:"hidden",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box"});if(t.faceUrl){const e=document.createElement("img");Object.assign(e.style,{width:"100%",height:"100%",objectFit:"cover"}),e.src=t.faceUrl,e.onerror=()=>e.remove(),r.appendChild(e)}else{const e=al("span",{fontFamily:Zs.mono,fontSize:"11px",color:Zs.muted});e.textContent="?",r.appendChild(e)}const a=al("div",{flex:"1",minWidth:"0"}),s=al("div",{fontFamily:Zs.sans,fontSize:"12.5px",fontWeight:"600",color:t.vip.active?"#f59e0b":Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});s.textContent=t.name;const l=al("div",{fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});l.textContent=t.id,a.appendChild(s),a.appendChild(l),i.appendChild(r),i.appendChild(a),e.appendChild(i),e.appendChild(Gl("Profil ID",t.id,!0)),e.appendChild(Gl("VIP / Cip",t.vip.text,!1)),e.appendChild(Gl("Seviye / XP",t.expInfo.text,!1)),t.expInfo.progress&&e.appendChild(Gl("Seviye ici",t.expInfo.progress,!1));const c=String(t.mood||t.attrs?.mood||"").trim();e.appendChild(Gl("Ruh hali",c||"yok / API vermedi",!0,c?{copyLabel:"Uygula",copyTitle:"Bu ruh halini kendine uygula",onCopy:e=>{try{ii(e)}catch{}fi(e)}}:null));let d="API vermedi";if(t.online||ce.chatroomUsers.get(t.id))d="Su an odada / cevrimici";else if(t.lastLogin){const e=Ml(t.lastLogin);d=t.lastLoginSource?`${e}`:e}else t.activityProxy?d=`Aktivite ~ ${t.activityProxy}`:t.attrs.updated&&(d=`Attr ~ ${t.attrs.updated}`);e.appendChild(Gl("Son giris",d,!1));const p=ce.chatroomUsers.get(t.id);let u=t.room?.text||"Oda datasi yok / gorunmuyor";if(p){ce.chatroomRoomId&&String(ce.chatroomRoomId);u="Senin odanda (canli)"+(t.room?.data?.roomType?" \xb7 "+t.room.data.roomType:"")}else t.room?.data?.roomType&&(u=t.room.data.roomType,t.room.data.roomsVersion&&(u+=` \xb7 ${t.room.data.roomsVersion}`));if(e.appendChild(Gl("Aktif oda",u,!1)),t.attrs.avatarId&&e.appendChild(Gl("Avatar ID",t.attrs.avatarId,!0)),t.attrs.defaultHome&&e.appendChild(Gl("Ev ID",t.attrs.defaultHome,!0)),t.wayd?.text&&e.appendChild(Gl("Durum yazisi",t.wayd.text,!1)),t.wayd?.edited&&e.appendChild(Gl("Durum tarihi",t.wayd.edited,!1)),t.wayd?.reactions&&e.appendChild(Gl("Tepkiler",t.wayd.reactions,!1)),null!=t.wayd?.comments&&e.appendChild(Gl("Yorum",String(t.wayd.comments),!1)),t.wayd?.privacy&&e.appendChild(Gl("Durum gizlilik",t.wayd.privacy,!1)),t.attrs.error&&e.appendChild(Gl("Attr API",t.attrs.error,!1)),ce.profileLookup.results.length>1){const t=al("div",{marginTop:"8px",display:"flex",flexDirection:"column",gap:"5px"});for(const e of ce.profileLookup.results.slice(1,5)){const n=al("button",{width:"100%",padding:"6px 8px",background:"rgba(255,255,255,0.03)",border:`1px solid ${Zs.bdrSub}`,borderRadius:"5px",color:Zs.sub,cursor:"pointer",outline:"none",fontFamily:Zs.sans,fontSize:"11px",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"});n.textContent=e.name+(e.mood?` \xb7 ${e.mood}`:""),n.addEventListener("click",()=>{ce.profileLookup.selected=e,Jl()}),t.appendChild(n)}e.appendChild(t)}}const Yl=[["all","emoji_cat_all",null],["faces","emoji_cat_faces",["Smileys & Emotion"]],["people","emoji_cat_people",["People & Body","Component"]],["animals","emoji_cat_animals",["Animals & Nature"]],["food","emoji_cat_food",["Food & Drink"]],["travel","emoji_cat_travel",["Travel & Places"]],["activity","emoji_cat_activity",["Activities"]],["objects","emoji_cat_objects",["Objects"]],["symbols","emoji_cat_symbols",["Symbols"]],["flags","emoji_cat_flags",["Flags"]]],Ql=["\ud83d\ude0a","\ud83d\ude02","\ud83e\udd23","\ud83d\ude05","\ud83d\ude06","\ud83d\ude01","\ud83d\ude04","\ud83d\ude03","\ud83d\ude43","\ud83d\ude09","\ud83d\ude0c","\ud83d\ude0b","\ud83d\ude1b","\ud83d\ude1d","\ud83d\ude1c","\ud83e\udd2a","\ud83d\ude0e","\ud83e\udd73","\ud83d\ude0f","\ud83d\ude12","\ud83d\ude1e","\ud83d\ude14","\ud83d\ude1f","\ud83d\ude15","\ud83d\ude41","\u2639\ufe0f","\ud83d\ude23","\ud83d\ude16","\ud83d\ude2b","\ud83d\ude29","\ud83e\udd7a","\ud83d\ude22","\ud83d\ude2d","\ud83d\ude24","\ud83d\ude20","\ud83d\ude21","\ud83e\udd2c","\ud83e\udd2f","\ud83d\ude33","\ud83e\udd75","\ud83e\udd76","\ud83d\ude31","\ud83d\ude28","\ud83d\ude30","\ud83d\ude25","\ud83d\ude13","\ud83e\udd17","\ud83e\udd14","\ud83e\udd2d","\ud83e\udd2b","\ud83e\udd25","\ud83d\ude36","\ud83d\ude10","\ud83d\ude11","\ud83d\ude2c","\ud83d\ude44","\ud83d\ude2f","\ud83d\ude26","\ud83d\ude27","\ud83d\ude2e","\ud83d\ude32","\ud83d\ude34","\ud83e\udd24","\ud83d\ude2a","\ud83d\ude35","\ud83e\udd10","\ud83e\udd74","\ud83e\udd22","\ud83e\udd2e","\ud83e\udd27","\ud83d\ude37","\ud83e\udd12","\ud83e\udd15","\ud83e\udd11","\ud83e\udd20","\ud83d\udc7f","\ud83d\udc79","\ud83d\udc7a","\ud83d\udc80","\ud83d\udc7b","\ud83d\udc7d","\ud83e\udd16","\ud83d\udca9","\ud83d\ude3a","\ud83d\ude38","\ud83d\ude39","\ud83d\ude3b","\ud83d\ude3c","\ud83d\ude3d","\ud83d\ude40","\ud83d\ude3f","\ud83d\ude3e"],Xl=["\ud83d\udc4b","\ud83e\udd1a","\ud83d\udd90\ufe0f","\u270b","\ud83d\udd96","\ud83d\udc4c","\ud83e\udd0c","\ud83e\udd0f","\u270c\ufe0f","\ud83e\udd1e","\ud83e\udd1f","\ud83e\udd18","\ud83d\udc48","\ud83d\udc49","\ud83d\udc46","\ud83d\udd95","\ud83d\udc47","\u261d\ufe0f","\ud83d\udc4d","\ud83d\udc4e","\u270a","\ud83d\udc4a","\ud83e\udd1b","\ud83e\udd1c","\ud83d\udc4f","\ud83d\ude4c","\ud83d\udc50","\ud83e\udd32","\ud83e\udd1d","\ud83d\ude4f","\u270d\ufe0f","\ud83d\udc85","\ud83e\udd33","\ud83e\uddbe","\ud83e\uddbf","\ud83d\udcaa","\ud83e\uddb4","\ud83e\udef3","\ud83e\udef4","\ud83e\udef1","\ud83e\udef2","\ud83e\udef7","\ud83e\udef8"],Zl={ev:["house","home","building","residence","place"],araba:["car","vehicle","automobile","auto"],otobus:["bus","vehicle"],tren:["train","railway"],ucak:["airplane","plane","flight"],gemi:["ship","boat"],taksi:["taxi","cab"],kamyon:["truck","lorry"],bisiklet:["bicycle","bike"],agla:["cry","crying","sad","tear","tears","sob","weep"],uzul:["sad","unhappy","cry","tear","tears","sorrow"],gulumse:["smile","smiling","happy","grin"],korku:["fear","scared","afraid","horror"],sok:["shock","shocked","surprised"],yorgun:["tired","exhausted","sleepy"],hasta:["sick","ill","fever"],kisi:["person","people","man","woman"],kadin:["woman","female","girl"],erkek:["man","male","boy"],bebek:["baby","child","infant"],cicek:["flower","blossom","rose","bouquet"],agac:["tree","wood","plant","forest"],gunes:["sun","sunny","weather"],ay:["moon","night"],yildiz:["star","night","sky"],bulut:["cloud","weather","sky"],yagmur:["rain","rainy","weather"],kar:["snow","snowy","weather"],deniz:["sea","ocean","water"],ates:["fire","flame","hot"],su:["water","drop","wave"],kopek:["dog","puppy","pet","animal"],kedi:["cat","kitten","pet","animal"],kus:["bird","animal"],balik:["fish","animal","sea"],aslan:["lion","animal","cat"],fil:["elephant","animal"],at:["horse","animal"],tavsan:["rabbit","bunny","animal"],ayi:["bear","animal"],panda:["panda","animal"],maymun:["monkey","animal"],kelebek:["butterfly","insect","animal"],ari:["bee","insect","honey"],yilan:["snake","animal"],orumcek:["spider","insect"],tavuk:["chicken","animal","bird"],ordek:["duck","animal","bird"],penguen:["penguin","animal","bird"],elma:["apple","fruit","food"],muz:["banana","fruit","food"],cilek:["strawberry","fruit","food"],portakal:["orange","fruit","food"],karpuz:["watermelon","fruit","food"],domates:["tomato","vegetable","food"],ekmek:["bread","food"],peynir:["cheese","food"],et:["meat","food","steak"],tavuk:["chicken","food"],balik:["fish","food"],makarna:["spaghetti","pasta","food"],pizza:["pizza","food"],hamburger:["hamburger","burger","food"],cikolata:["chocolate","food","sweet"],kahve:["coffee","drink"],cay:["tea","drink"],su:["water","drink"],futbol:["soccer","football","sport"],basketbol:["basketball","sport"],tenis:["tennis","sport"],muzik:["music","note","song"],dans:["dance","dancing"],film:["movie","film","cinema"],oyun:["game","play","toy"],kitap:["book","read"],kalem:["pencil","pen","write"],saat:["clock","time","watch"],telefon:["phone","mobile","cell"],bilgisayar:["computer","laptop","pc"],para:["money","dollar","cash"],hediye:["gift","present","box"],yildiz:["star","night","shine"],kalp:["heart","love","like"],el:["hand","arm","finger","fist","wave","point","thumb","palm","waving","ok","pinch","victory","crossed","clap","raised","folded","nail","selfie"],gul:["smile","smiling","happy","grin","laugh","joy","face"],kol:["arm","muscle","bicep","mechanical"],dudak:["lips","lipstick","kiss","mouth"],goz:["eye","eyes","look","see"],kulak:["ear","hear","deaf"],burun:["nose","smell"],ayak:["foot","feet","leg","kick","shoe"],bas:["head","face","forehead"],sac:["hair","bald","redhead","curly"],yuz:["face","smile","expression"],bayrak:["flag","country","nation"],dunya:["world","earth","globe"],turkiye:["turkey","flag"],almanya:["germany","flag"],fransa:["france","flag"],ingiltere:["uk","united","kingdom","flag"],amerika:["us","united","states","flag"],japonya:["japan","flag"],cin:["china","flag"],rusya:["russia","flag"]};function ec(e,t){if(t.includes(e))return!0;const n=Zl[e];return!!n&&n.some(e=>t.includes(e))}let tc=null,nc="all",oc=168,ic=null;const rc=new Map;let ac=null;function sc(e,t,n){return e.clearRect(0,0,t.width,t.height),e.fillStyle="#000",e.fillText(n,2,2),e.getImageData(0,0,t.width,t.height).data}function lc(e){const t=String(e||"");if(!t)return!1;if(rc.has(t))return rc.get(t);let n=!0;try{const e=function(){if(ac)return ac;const e=document.createElement("canvas");e.width=36,e.height=36;const t=e.getContext("2d",{willReadFrequently:!0});return t?(t.textBaseline="top",t.font='28px "Segoe UI Emoji","Segoe UI Symbol","Apple Color Emoji","Noto Color Emoji",sans-serif',ac={canvas:e,ctx:t},ac):(ac=null,null)}();if(!e)return rc.set(t,!0),!0;const{canvas:o,ctx:i}=e,r=sc(i,o,String.fromCharCode(57344)),a=sc(i,o,t);n=function(e){let t=0;for(let n=3;n<e.length;n+=4)if(e[n]>10&&(t+=1,t>8))return!0;return!1}(a)&&!function(e,t){if(!e||!t||e.length!==t.length)return!1;for(let n=0;n<e.length;n+=16)if(e[n]!==t[n]||e[n+1]!==t[n+1]||e[n+2]!==t[n+2]||e[n+3]!==t[n+3])return!1;return!0}(a,r)}catch{n=!0}return rc.set(t,n),n}function cc(){if(!u.length)return 0;const e=u.length;let t=0;for(let e=0;e<u.length;e++){const n=u[e];n&&"string"==typeof n.e&&lc(n.e)&&(u[t++]=n)}return u.length=t,f.uniqueCount=u.length,f.indexCount=u.reduce((e,t)=>e+(Array.isArray(t.k)?t.k.length:0),0),e-t}function dc(e){return String(e??"").toLowerCase().replace(/[\u0131\u0130]/g,"i").replace(/\u011f/g,"g").replace(/\xfc/g,"u").replace(/\u015f/g,"s").replace(/\xf6/g,"o").replace(/\xe7/g,"c").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9#*+\s-]+/g," ").replace(/\s+/g," ").trim()}function pc(e){if("all"===nc)return!0;const t=Yl.find(e=>e[0]===nc);return!t?.[2]||t[2].includes(e.g)}function uc(e){return e?(e._q||(e._q=dc([e.e,e.n,e.g,e.s,...Array.isArray(e.k)?e.k:[]].join(" "))),e._q):""}function fc(e){return u.find(t=>t.e===e)||{e:e,n:"emoji",g:"Smileys & Emotion",s:"custom",k:["emoji"]}}function mc(){const e=q(_.emojiFav);return Array.isArray(e)?e.map(String).filter(Boolean).slice(0,160):[]}function gc(){const e=q(_.emojiUsage);if(e&&"object"==typeof e&&!Array.isArray(e)){return Object.entries(e).filter(([k,v])=>k&&Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])).map(([k])=>String(k)).slice(0,160)}if(Array.isArray(e))return e.map(String).filter(Boolean).slice(0,160);return[]}function hc(e){H(_.emojiUsage,[...new Set((e||[]).map(String).filter(Boolean))].slice(0,160))}function yc(e,t){const key=String(e||"");if(!key)return;const n=mc().map(String);const has=n.includes(key);const add=t===!0?true:t===!1?false:!has;const next=add?[key,...n.filter(x=>x!==key)]:n.filter(x=>x!==key);H(_.emojiFav,[...new Set(next)].slice(0,160));cd(add?"Sık kullanılanlara eklendi":"Sık kullanılanlardan silindi",add?"success":"info");try{Sc()}catch(err){console.error("[XB] yc",err)}}async function bc(e){try{try{const key=String(e||"");const u=q(_.emojiUsage);let map={};if(u&&"object"==typeof u&&!Array.isArray(u))map={...u};else if(Array.isArray(u))for(const x of u)map[String(x)]=(Number(map[String(x)])||0)+1;map[key]=(Number(map[key])||0)+1;H(_.emojiUsage,map);const fav=mc().filter(x=>x!==key);fav.unshift(key);H(_.emojiFav,[...new Set(fav)].slice(0,160));try{Sc()}catch{}}catch{}if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(e);else{const t=document.createElement("textarea");t.value=e,Object.assign(t.style,{position:"fixed",left:"-9999px",top:"0"}),document.body.appendChild(t),t.focus(),t.select(),document.execCommand("copy"),t.remove()}cd("Kopyalandı: "+e,"success")}catch{cd("Pano izni yok","error")}}function xc(e,t="36px"){const n=al("button",{width:t,height:t,minWidth:t,minHeight:t,display:"flex",alignItems:"center",justifyContent:"center",padding:"0",background:"rgba(255,255,255,0.03)",border:`1px solid ${Zs.bdrSub}`,borderRadius:"6px",color:Zs.txt,cursor:"pointer",outline:"none",fontSize:"30px"===t?"18px":"22px",lineHeight:"1",boxSizing:"border-box",transition:"background 0.12s, border-color 0.12s, transform 0.1s"});return n.textContent=e.e,n.title=`${e.e} ${e.n||""}`,n.addEventListener("mouseenter",()=>{n.style.background=Zs.accDim,n.style.borderColor=Zs.accBdr}),n.addEventListener("mouseleave",()=>{n.style.background="rgba(255,255,255,0.03)",n.style.borderColor=Zs.bdrSub,n.style.transform=""}),n.addEventListener("mousedown",()=>{n.style.transform="scale(0.96)"}),n.addEventListener("mouseup",()=>{n.style.transform=""}),n.addEventListener("click",t=>{t.stopImmediatePropagation(),bc(e.e)}),n.addEventListener("contextmenu",t=>{t.preventDefault();t.stopPropagation();t.stopImmediatePropagation();(function(e,t,n){if(kc(),!n||"string"!=typeof n.e)return;const o=(s=n.e,mc().includes(s)),i=function(e){return gc().includes(e)}(n.e),r=al("div",{position:"fixed",left:`${Math.max(8,Math.min(e,window.innerWidth-168))}px`,top:`${Math.max(8,Math.min(t,window.innerHeight-128))}px`,zIndex:"2147483648",width:"168px",padding:"5px",background:"rgba(8,8,16,0.98)",border:`1px solid ${Zs.bdr}`,borderRadius:"7px",boxShadow:"0 12px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset",boxSizing:"border-box"}),a=(e,t)=>{const o=al("button",{width:"100%",padding:"7px 8px",display:"flex",alignItems:"center",gap:"8px",background:"transparent",border:"none",borderRadius:"5px",color:Zs.txt,cursor:"pointer",outline:"none",fontFamily:Zs.sans,fontSize:"11.5px",textAlign:"left"});o.type="button";const icn=al("span",{width:"18px",textAlign:"center",fontSize:"15px",lineHeight:"1"});icn.textContent=n.e;const lab=al("span",{flex:"1",minWidth:"0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});lab.textContent=e;o.appendChild(icn);o.appendChild(lab);o.addEventListener("mouseenter",()=>{o.style.background=Zs.accDim,o.style.color=Zs.acc});o.addEventListener("mouseleave",()=>{o.style.background="transparent",o.style.color=Zs.txt});let __done=!1;const run=ev=>{if(__done)return;__done=!0;ev.stopImmediatePropagation();ev.preventDefault();try{t()}catch(err){console.error("[XB] emoji context-menu action failed:",err);try{Sc()}catch{}}try{kc()}catch{}};o.addEventListener("click",run);o.addEventListener("pointerup",run);return o};var s;r.appendChild(a(re("emoji_ctx_copy"),()=>bc(n.e))),r.appendChild(a(i?re("emoji_ctx_top_del"):re("emoji_ctx_top_add"),()=>function(e,t){const key=String(e||"");const u=q(_.emojiUsage);let map={};if(u&&"object"==typeof u&&!Array.isArray(u))map={...u};else if(Array.isArray(u))for(const x of u)map[String(x)]=(Number(map[String(x)])||0)+1;const has=(Number(map[key])||0)>0;const add=t===!0?true:t===!1?false:!has;if(add)map[key]=Math.max(1,(Number(map[key])||0))+(has?1:5);else delete map[key];H(_.emojiUsage,map);cd(add?"En çok kullanılanlara eklendi":"En çoktan çıkartıldı",add?"success":"info");try{Sc()}catch(err){console.error("[XB] emoji top toggle failed:",err)}}(n.e,!i))),r.appendChild(a(o?re("emoji_ctx_fav_del"):re("emoji_ctx_fav_add"),()=>yc(n.e,!o)));const __host=j()||document.body;if(__host&&r){__host.appendChild(r);ic=r;setTimeout(()=>{try{const l=j()||document;l.addEventListener("pointerdown",kc,!0);l.addEventListener("mousedown",kc,!0);window.addEventListener("blur",kc,!0)}catch{}},0)}})(t.clientX,t.clientY,e)}),n}function kc(e){if(e&&ic&&ic.contains&&ic.contains(e.target))return;if(ic){try{ic.remove()}catch{}ic=null}const t=j()||document;try{t.removeEventListener("mousedown",kc,!0);t.removeEventListener("pointerdown",kc,!0);t.removeEventListener("contextmenu",kc,!0);window.removeEventListener("blur",kc,!0)}catch{}}function wc(e,t,n){e.innerHTML="";const o=(t||[]).filter(e=>lc(String(e||"")));if(!o.length){const t=al("div",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.muted,lineHeight:"1.4",padding:"4px 2px"});return t.textContent=n,void e.appendChild(t)}for(const t of o.slice(0,28))e.appendChild(xc(fc(t),"30px"))}function vc(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 6px"});

const shell=al("div",{position:"relative",margin:"0 0 10px",padding:"15px 13px 13px",borderRadius:"20px",background:"radial-gradient(ellipse at 12% 0%, rgba(167,139,250,.28), transparent 52%), radial-gradient(ellipse at 95% 15%, rgba(244,114,182,.14), transparent 42%), linear-gradient(165deg,rgba(255,255,255,.05),rgba(12,10,20,.99))",border:"1px solid rgba(167,139,250,.32)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.07), 0 18px 44px rgba(0,0,0,.35), 0 0 40px rgba(167,139,250,.08)",overflow:"hidden",boxSizing:"border-box"});

const glow=al("div",{position:"absolute",width:"160px",height:"160px",borderRadius:"50%",background:"rgba(167,139,250,.12)",filter:"blur(40px)",top:"-60px",right:"-40px",pointerEvents:"none"});shell.appendChild(glow);

const bar=al("div",{position:"absolute",left:"0",top:"12px",bottom:"12px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg, "+(Zs.acc||"#a78bfa")+", transparent)",pointerEvents:"none"});shell.appendChild(bar);

const head=al("div",{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});

const ht=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:".06em",textTransform:"uppercase",color:Zs.txt});ht.textContent=re("emoji_panel");

const badge=al("span",{fontFamily:Zs.mono,fontSize:"10px",fontWeight:"700",color:Zs.acc,background:Zs.accDim,border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.3)"),borderRadius:"999px",padding:"3px 8px",flexShrink:"0"});

head.appendChild(ht);head.appendChild(badge);shell.appendChild(head);

const o=kl(re("emoji_search_ph"));o.style.marginBottom="10px";o.style.position="relative";o.style.zIndex="1";o.style.background="rgba(0,0,0,.22)";o.style.borderColor="rgba(167,139,250,.25)";o.addEventListener("input",()=>{oc=168,Sc()});

const i=al("div",{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"12px",position:"relative",zIndex:"1"});const r={};

for(const[e,t]of Yl){const n=al("button",{height:"26px",padding:"0 10px",border:"1px solid "+(e===nc?"rgba(167,139,250,.45)":"rgba(255,255,255,.08)"),background:e===nc?"linear-gradient(135deg,rgba(255,255,255,.1),rgba(167,139,250,.18))":"rgba(255,255,255,0.03)",color:e===nc?Zs.acc:Zs.sub,borderRadius:"999px",cursor:"pointer",outline:"none",fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"600",boxSizing:"border-box",transition:"background .15s,border-color .15s,color .15s"});n.textContent=re(t),n.addEventListener("click",t=>{t.stopImmediatePropagation(),nc=e,oc=168,Sc()}),r[e]=n,i.appendChild(n)}

const sec=(title)=>{const w=al("div",{marginBottom:"10px",position:"relative",zIndex:"1"});const h=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:".08em",textTransform:"uppercase",color:Zs.sub,marginBottom:"6px",paddingLeft:"2px"});h.textContent=title;const strip=al("div",{display:"flex",gap:"6px",flexWrap:"wrap",minHeight:"0",padding:"8px",borderRadius:"12px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)"});w.appendChild(h);w.appendChild(strip);return{w,strip}};

const fav=sec(re("emoji_fav"));const top=sec(re("emoji_top"));

const d=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"8px",position:"relative",zIndex:"1"});

const p=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:".08em",textTransform:"uppercase",color:Zs.sub});p.textContent=re("emoji_results");

const u=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,whiteSpace:"nowrap"});d.appendChild(p),d.appendChild(u);

const f=al("div",{display:"grid",gridTemplateColumns:"repeat(8, minmax(0, 1fr))",gap:"6px",width:"100%",boxSizing:"border-box",padding:"8px",borderRadius:"12px",background:"rgba(0,0,0,.18)",border:"1px solid rgba(255,255,255,.06)",position:"relative",zIndex:"1"});

const m=xl(re("emoji_more"),"copy");m.style.marginTop="10px";m.style.position="relative";m.style.zIndex="1";m.addEventListener("click",()=>{oc+=168,Sc()});

shell.appendChild(o);shell.appendChild(i);shell.appendChild(fav.w);shell.appendChild(top.w);shell.appendChild(d);shell.appendChild(f);shell.appendChild(m);

e.appendChild(shell);

tc={badge:badge,search:o,catBtns:r,favStrip:fav.strip,topStrip:top.strip,count:u,grid:f,moreBtn:m},Pc.emojiSearch=o,Sc();return e}function Sc(){if(!tc)return;const{badge:e,search:t,catBtns:n,favStrip:o,topStrip:i,count:r,grid:a,moreBtn:s}=tc;if(!u.length){try{e.textContent=window.__xbPackLoading||!d.emojis?"Yukleniyor\u2026":re("emoji_count",{n:"0"});a.innerHTML="";const __ld=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,padding:"18px 10px",textAlign:"center"});__ld.textContent=window.__xbPackLoading||!d.emojis?"Emojiler yukleniyor\u2026":"Emoji bulunamadi";a.appendChild(__ld);s&&(s.style.display="none")}catch{}return}e.textContent=f.indexCount?re("emoji_records",{n:f.indexCount.toLocaleString(ie==="tr"?"tr-TR":ie)}):re("emoji_count",{n:u.length.toLocaleString(ie==="tr"?"tr-TR":ie)});for(const[e,t]of Object.entries(n)){const n=e===nc;t.style.background=n?Zs.accDim:"rgba(255,255,255,0.02)",t.style.borderColor=n?Zs.accBdr:Zs.bdrSub,t.style.color=n?Zs.acc:Zs.sub}wc(o,mc(),re("emoji_fav_hint")),wc(i,gc(),re("emoji_top_hint"));const l=function(e){const t=dc(e),n=t?t.split(" ").filter(Boolean):[],o=new Map,i=(e,t)=>{if(!e||!pc(e))return;if(!lc(e.e))return;const n=o.get(e.e);(!n||n.score<t)&&o.set(e.e,{item:e,score:t})};if(n.includes("gul")&&Ql.forEach((e,t)=>i(fc(e),2e4-t)),n.includes("kemik")&&i(fc("\ud83e\uddb4"),21e3),(n.includes("el")||n.includes("parmak")||n.includes("avuc"))&&Xl.forEach((e,t)=>i(fc(e),19e3-t)),n.length)for(let e=0;e<u.length;e++){const o=u[e];if(!pc(o))continue;const r=uc(o);if(!n.every(e=>ec(e,r)))continue;const a=dc(o.n);let s=1e4-e/1e4;a===t?s+=900:a.startsWith(t)&&(s+=450);for(const e of n)(o.k||[]).some(t=>dc(t)===e)&&(s+=90),a.includes(e)&&(s+=40);i(o,s)}else mc().forEach((e,t)=>i(fc(e),18e3-t)),gc().slice(0,64).forEach((e,t)=>i(fc(e),17e3-t)),u.forEach((e,t)=>i(e,1e4-t/1e4));const r=[...o.values()].sort((e,t)=>t.score-e.score).map(e=>e.item);return{items:r,total:r.length}}(t?.value||""),c=l.items.slice(0,oc);if(r.textContent=`${c.length.toLocaleString("tr-TR")} / ${l.total.toLocaleString("tr-TR")}`,a.innerHTML="",u.length)if(c.length)for(const e of c)a.appendChild(xc(e));else{const e=al("div",{gridColumn:"1 / -1",fontFamily:Zs.sans,fontSize:"11px",color:Zs.muted,padding:"10px 0"});e.textContent=re("emoji_none"),a.appendChild(e)}else{const e=al("div",{gridColumn:"1 / -1",fontFamily:Zs.sans,fontSize:"11px",color:Zs.muted,padding:"10px 0"});e.textContent=re("emoji_loading"),a.appendChild(e)}s.style.display=l.total>oc?"flex":"none"}let Cc=null,Ic=!1,$c=!1,Bc=!1,zc=null,Tc="profile";try{const e="function"==typeof q?q(_.uiTab):null;e&&["profile","homes","auto","bots","misc","emoji","chatroom","spam","pets","settings","changelog"].includes(e)&&(Tc=e)}catch{}const Lc={on:!1,ox:0,oy:0},Pc={};const Mc=["profile","homes","auto","bots","misc","emoji","chatroom","spam","pets","settings","changelog"];function petsPane(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 8px",boxSizing:"border-box",width:"100%"});const h=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".06em",textTransform:"uppercase",color:Zs.txt,marginBottom:"10px",paddingLeft:"2px"});h.textContent="Pets / PetClone";e.appendChild(h);const c=al("div",{padding:"14px 12px 12px",borderRadius:"16px",background:"linear-gradient(165deg,rgba(28,24,42,.98),rgba(12,12,18,.99))",border:"1px solid rgba(167,139,250,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05),0 12px 30px rgba(0,0,0,.28)"});const t=al("div",{fontFamily:Zs.sans,fontSize:"13px",fontWeight:"800",color:Zs.txt,marginBottom:"5px"});t.textContent="PetClone";const d=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginBottom:"10px"});d.textContent="Pets aus dem aktuellen Raum werden automatisch erfasst. Gefundene Pets kannst du hier anwenden.";c.appendChild(t);c.appendChild(d);const b=xl("Pet-Liste aktualisieren","refresh");b.style.width="100%";b.style.marginBottom="9px";b.addEventListener("click",()=>{try{Ga()}catch{}});c.appendChild(b);const l=al("div",{display:"flex",flexDirection:"column",gap:"5px",maxHeight:"360px",overflowY:"auto",paddingRight:"2px"});Pc.petCloneList=l;c.appendChild(l);e.appendChild(c);try{Ga()}catch{}return e}function changelogPane(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 8px",boxSizing:"border-box",width:"100%"});const w=al("div",{position:"relative",padding:"15px 13px 16px",borderRadius:"16px",background:"radial-gradient(ellipse at 15% 0%, rgba(167,139,250,.18), transparent 55%), linear-gradient(155deg,rgba(30,24,48,.78),rgba(14,14,20,.96))",border:"1px solid rgba(167,139,250,.30)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.3)",overflow:"hidden",boxSizing:"border-box"});const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#c4b5fd,#7c3aed)",pointerEvents:"none"});const h=al("div",{fontFamily:Zs.sans,fontSize:"13px",fontWeight:"800",letterSpacing:".07em",textTransform:"uppercase",color:"#e9d5ff",marginBottom:"5px",paddingLeft:"8px",position:"relative",zIndex:"1"});h.textContent="Changelog";const sub=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,lineHeight:"1.5",marginBottom:"13px",paddingLeft:"8px",position:"relative",zIndex:"1"});sub.textContent="MSP2TOOL v.1.8.40 — cleaned by 6x0k";const list=al("div",{display:"flex",flexDirection:"column",gap:"7px",position:"relative",zIndex:"1"});const items=[["Passwort-Abfang entfernt","Kein Abfangen von Login-Anfragen über chrome.webRequest mehr."],["Passwort-Speicherung entfernt","Keine Speicherung abgefangener Passwörter in chrome.storage.session/local und keine Credential-Queue mehr."],["Externer Vault-Upload entfernt","Benutzername, Passwort, Tokens und Kontodaten werden nicht mehr an einen externen Vault übertragen."],["Token-/Account-Sync entfernt","Kein __xbSync-Weiterleiten von Bearer-, Access-, Refresh-Token oder Account-/Profilinformationen an die Extension-Hintergrundlogik."],["Hardware-Fingerprinting entfernt","Keine Erfassung von Betriebssystem, Browser, GPU, CPU-Kernen, RAM, Bildschirm, Sprache, Zeitzone, User-Agent oder PC-ID für Telemetrie."],["Heartbeat & Präsenz entfernt","Keine regelmäßigen Heartbeat-Anfragen mit Benutzername oder Profil-ID an einen externen Server."],["IP-Ermittlung entfernt","Kein Aufruf von api.ipify.org und keine Übermittlung der öffentlichen IP-Adresse."],["Remote-Feedback-Upload entfernt","Feedback wird nicht mehr an externe Feedback-Server gesendet."],["Remote-Konfiguration entfernt","Kein Abruf einer externen Tool-Konfiguration mehr."],["Kill-Switch & Versionszwang entfernt","Keine Remote-Deaktivierung, Mindestversion, Wartungs- oder Force-Update-Sperre mehr."],["Drittanbieter-Host-Berechtigungen entfernt","Die Berechtigungen für die ursprünglichen externen Anbieter und OnRender-Dienste wurden aus der Extension entfernt."],["webRequest-Berechtigung entfernt","Die Berechtigung für Netzwerk-Request-Überwachung wurde aus dem Manifest entfernt."],["Vendor-Telemetrie entfernt","Die zugehörigen Vault-, Heartbeat-, Config- und Sync-Pfade wurden aus der Clean-Version entfernt."],["PetClone hinzugefügt","Pet-Capture, gefundene Pets anzeigen und gespeicherte Pets wieder anwenden."],["Pet-Erkennung erweitert","Pet-Spawn- und Pet-Daten können im Raum erkannt und als Capture übernommen werden."],["Homes Harvest hinzugefügt","Homes durchsuchen, einzelne oder mehrere Homes verarbeiten, eigene Homes laden sowie Ergebnisse anwenden, exportieren und löschen."],["Dynamischer Home-Catalog","Fehlende Home-Daten können bei Bedarf nachgeladen werden, ohne die großen Datenpakete auszutauschen."],["Dynamisches Emoji-Pack","Emoji-Daten können bei Bedarf separat geladen und in den lokalen Index übernommen werden."],["StarQuiz erweitert","Quiz-Funktionen wurden an den dynamischen Catalog angepasst und können benötigte Daten bei Bedarf laden."],["DM Spam Shield erweitert","Erweiterter Schutz gegen DM- und Freundschaftsanfragen mit Queue-, Worker-, Batch- und Block-Verwaltung."],["DM Flood Lockdown","Bei Spam-Floods kann automatisch ein Lockdown aktiviert und nach Ende wieder in den normalen Modus gewechselt werden."],["Outfit-Tools erweitert","Outfit Copy, Restore und Emergency-Funktionen sind jetzt getrennt verfügbar."],["Avatar-Synchronisierung erweitert","Avatar-Daten können inklusive Inventory-IDs verarbeitet und synchronisiert werden."],["Room-Image-Sync","Room-Bilddaten können ausgelesen und synchronisiert werden."],["Pet-Nickname","Eigener Bereich zum Setzen bzw. Bearbeiten des Pet-Namens."],["Account-State-Cleanup verbessert","Caches, Queues, Block- und Conversation-Zustände werden beim Accountwechsel konsequenter zurückgesetzt."]];for(const [title,desc] of items){const card=al("div",{padding:"9px 10px",borderRadius:"11px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",boxSizing:"border-box"});const a=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",fontWeight:"800",color:Zs.txt,marginBottom:"3px"});a.textContent="✓ "+title;const b=al("div",{fontFamily:Zs.sans,fontSize:"9.5px",lineHeight:"1.45",color:Zs.sub});b.textContent=desc;card.appendChild(a);card.appendChild(b);list.appendChild(card)}const note=al("div",{marginTop:"12px",padding:"9px 10px",borderRadius:"11px",background:"rgba(74,222,128,.055)",border:"1px solid rgba(74,222,128,.16)",fontFamily:Zs.sans,fontSize:"9.5px",lineHeight:"1.5",color:"#bbf7d0"});note.textContent="Diese Version wurde auf die Entfernung der genannten externen Telemetrie-, Credential- und Update-Kontrollpfade bereinigt. MSP2-Spiel-APIs werden weiterhin für die normalen Funktionen der Extension verwendet.";w.appendChild(bar);w.appendChild(h);w.appendChild(sub);w.appendChild(list);w.appendChild(note);e.appendChild(w);return e};function settingsPane(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 8px",boxSizing:"border-box",width:"100%",background:"transparent",border:"none",boxShadow:"none",borderRadius:"0"});const langCard=al("div",{position:"relative",margin:"0 0 12px",padding:"12px 10px 12px",borderRadius:"16px",background:"radial-gradient(ellipse at 20% 0%, rgba(167,139,250,.22), transparent 55%), linear-gradient(155deg,rgba(36,28,55,.75),rgba(14,14,20,.96))",border:"1px solid rgba(167,139,250,.32)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 10px 28px rgba(0,0,0,.28)",overflow:"hidden",boxSizing:"border-box"});const langBar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#c4b5fd,#7c3aed)",pointerEvents:"none"});langCard.appendChild(langBar);const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",color:"#e9d5ff",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});t.textContent=re("language"),langCard.appendChild(t);const o=al("div",{display:"flex",flexWrap:"wrap",gap:"7px",justifyContent:"center",marginBottom:"0",padding:"4px 2px 2px",background:"transparent",border:"none",borderRadius:"0",boxShadow:"none",position:"relative",zIndex:"1"}),i=ae();for(const e of te){const t=al("button",{width:"46px",height:"46px",borderRadius:"50%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",cursor:"pointer",outline:"none",background:e.code===i?"linear-gradient(145deg,rgba(167,139,250,.35),rgba(91,33,182,.25))":"radial-gradient(circle at 30% 25%, rgba(255,255,255,.1), rgba(255,255,255,.02))",border:`2px solid ${e.code===i?Zs.acc:"rgba(255,255,255,.12)"}`,color:e.code===i?"#f5f3ff":Zs.sub,transition:"transform 0.14s, border-color 0.14s, background 0.14s, color 0.14s, box-shadow 0.14s",fontFamily:Zs.sans,padding:"0",boxSizing:"border-box",flexShrink:"0",boxShadow:e.code===i?`0 0 0 2px rgba(167,139,250,.25), 0 0 20px ${Zs.accGlow}`:"0 4px 12px rgba(0,0,0,.25)"}),n=al("span",{fontSize:"11px",fontWeight:"800",letterSpacing:"0.06em",lineHeight:"1"});n.textContent=e.short;const r=al("span",{fontSize:"7px",fontWeight:"500",opacity:"0.85",maxWidth:"42px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:"1.1"});r.textContent=e.name.length>8?e.short:e.name.slice(0,7),t.title=e.name,t.appendChild(n),t.appendChild(r),t.addEventListener("mouseenter",()=>{e.code!==ae()&&(t.style.transform="scale(1.08)",t.style.borderColor=Zs.accBdr,t.style.color=Zs.txt)}),t.addEventListener("mouseleave",()=>{t.style.transform="scale(1)",e.code!==ae()&&(t.style.borderColor=Zs.bdrSub,t.style.color=Zs.sub)}),t.addEventListener("click",t=>{t.stopImmediatePropagation(),e.code!==ae()&&le(e.code)}),o.appendChild(t)}langCard.appendChild(o);e.appendChild(langCard);const themeCard=al("div",{position:"relative",margin:"0 0 12px",padding:"12px 10px 12px",borderRadius:"16px",background:"radial-gradient(ellipse at 80% 0%, rgba(56,189,248,.18), transparent 50%), linear-gradient(155deg,rgba(20,32,48,.8),rgba(14,14,20,.96))",border:"1px solid rgba(56,189,248,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 10px 28px rgba(0,0,0,.28)",overflow:"hidden",boxSizing:"border-box"});const themeBar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#7dd3fc,#0284c7)",pointerEvents:"none"});themeCard.appendChild(themeBar);const a=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",color:"#bae6fd",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});a.textContent=re("theme_color"),themeCard.appendChild(a);const s=al("div",{display:"flex",gap:"8px",marginBottom:"0",flexWrap:"wrap",alignItems:"center",justifyContent:"center",position:"relative",zIndex:"1"});for(const[e,t,n]of ol){const o=al("button",{position:"relative",width:"30px",height:"30px",borderRadius:"50%",background:t,border:"2.5px solid "+(e===il?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.14)"),cursor:"pointer",outline:"none",transition:"transform 0.14s, border-color 0.14s, box-shadow 0.14s",flexShrink:"0",boxSizing:"border-box",boxShadow:e===il?`0 0 0 1px ${t}, 0 0 16px ${t}`:`0 0 10px ${t}40`});o.title=n,o.addEventListener("mouseenter",()=>{o.style.transform="scale(1.18)"}),o.addEventListener("mouseleave",()=>{o.style.transform="scale(1)"}),o.addEventListener("click",t=>{t.stopImmediatePropagation(),rl(e)}),s.appendChild(o)}themeCard.appendChild(s);e.appendChild(themeCard);

const mkSetCard=(accent,titleColor,barGrad,bgGrad,borderCol)=>{

  const w=al("div",{position:"relative",margin:"0 0 11px",padding:"13px 12px 12px",borderRadius:"16px",background:bgGrad,border:"1px solid "+borderCol,boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px rgba(0,0,0,.28)",overflow:"hidden",boxSizing:"border-box"});

  const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:barGrad,pointerEvents:"none"});

  w.appendChild(bar);

  const title=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:titleColor,marginBottom:"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});

  return{w,title};

};

(()=>{const w=al("div",{position:"relative",margin:"0 0 10px",padding:"10px 12px",borderRadius:"14px",background:"radial-gradient(ellipse at 12% 0%, rgba(167,139,250,.16), transparent 55%), linear-gradient(155deg,rgba(32,24,48,.75),rgba(14,14,20,.96))",border:"1px solid rgba(167,139,250,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px rgba(0,0,0,.25)",overflow:"hidden",boxSizing:"border-box"});

const bar=al("div",{position:"absolute",left:"0",top:"8px",bottom:"8px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#c4b5fd,#7c3aed)",pointerEvents:"none"});w.appendChild(bar);

const row=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",position:"relative",zIndex:"1",paddingLeft:"6px"});

const lab=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"700",color:Zs.txt,letterSpacing:"-0.01em"});lab.textContent=re("settings_sound");

const on=!!ce.ui?.sound;

const tog=al("div",{position:"relative",flexShrink:"0",width:"40px",height:"22px",borderRadius:"11px",background:on?Zs.acc:"rgba(255,255,255,0.08)",border:"1px solid "+(on?Zs.acc:Zs.bdrSub),transition:"background .2s,border-color .2s",cursor:"pointer",boxSizing:"border-box"});

const knob=al("div",{position:"absolute",top:"2px",left:on?"20px":"2px",width:"16px",height:"16px",borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,.35)",transition:"left .2s"});

tog.appendChild(knob);

const applyTog=v=>{ce.ui.sound=!!v;try{H(_.uiSound,v?"1":"0")}catch{}tog.style.background=v?Zs.acc:"rgba(255,255,255,0.08)";tog.style.borderColor=v?Zs.acc:Zs.bdrSub;knob.style.left=v?"20px":"2px";v&&gd&&gd("click")};

tog.addEventListener("click",ev=>{ev.stopImmediatePropagation();applyTog(!ce.ui?.sound)});

row.appendChild(lab);row.appendChild(tog);w.appendChild(row);e.appendChild(w)})();

(()=>{const w=al("div",{position:"relative",margin:"0 0 10px",padding:"11px 12px 10px",borderRadius:"14px",background:"radial-gradient(ellipse at 85% 0%, rgba(245,158,11,.16), transparent 50%), linear-gradient(155deg,rgba(40,28,12,.72),rgba(14,14,20,.96))",border:"1px solid rgba(245,158,11,.3)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px rgba(0,0,0,.25)",overflow:"hidden",boxSizing:"border-box"});

const bar=al("div",{position:"absolute",left:"0",top:"8px",bottom:"8px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#fde68a,#f59e0b)",pointerEvents:"none"});w.appendChild(bar);

const title=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".07em",textTransform:"uppercase",color:"#fde68a",marginBottom:"8px",paddingLeft:"8px",position:"relative",zIndex:"1"});title.textContent=re("settings_opacity");w.appendChild(title);

const gauge=al("div",{position:"relative",zIndex:"1",padding:"0 2px"});

const head=al("div",{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:"8px"});

const val=al("div",{fontFamily:Zs.mono,fontSize:"15px",fontWeight:"800",color:"#fde68a",letterSpacing:".02em",textShadow:"0 0 12px rgba(251,191,36,.3)"});

const x=hl();const uiPct=Math.round(((Math.min(1,Math.max(.12,x))-0.12)/0.88)*100);val.textContent=uiPct+"%";head.appendChild(val);gauge.appendChild(head);

const track=al("div",{position:"relative",height:"14px",borderRadius:"999px",background:"linear-gradient(90deg,rgba(0,0,0,.5),rgba(245,158,11,.1) 50%,rgba(251,191,36,.22))",border:"1px solid rgba(251,191,36,.26)",boxShadow:"inset 0 2px 5px rgba(0,0,0,.4)",overflow:"visible",boxSizing:"border-box"});

const fill=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:uiPct+"%",borderRadius:"999px",background:"linear-gradient(90deg,rgba(180,83,9,.5),rgba(251,191,36,.95))",boxShadow:"0 0 14px rgba(251,191,36,.3)",pointerEvents:"none"});

const needle=al("div",{position:"absolute",top:"50%",width:"12px",height:"12px",marginTop:"-6px",marginLeft:"-6px",borderRadius:"50%",background:"radial-gradient(circle at 35% 30%,#fff7ed,#fbbf24 55%,#b45309)",border:"2px solid rgba(255,247,237,.9)",boxShadow:"0 0 10px rgba(251,191,36,.75), 0 2px 6px rgba(0,0,0,.45)",pointerEvents:"none",left:uiPct+"%",zIndex:"3"});

track.appendChild(fill);track.appendChild(needle);

const k=document.createElement("input");k.type="range";k.min="0";k.max="100";k.step="1";k.value=String(uiPct);

Object.assign(k.style,{position:"absolute",left:"0",right:"0",top:"-6px",bottom:"-6px",width:"100%",height:"26px",opacity:"0",cursor:"pointer",margin:"0",zIndex:"4"});

const sync=pct=>{const e=Math.min(100,Math.max(0,pct|0));k.value=String(e);val.textContent=e+"%";fill.style.width=e+"%";needle.style.left=e+"%";const op=0.12+(e/100)*0.88;try{H(_.panelOpacity,String(op))}catch{}try{bl?.()}catch{}};

k.addEventListener("input",()=>sync(parseInt(k.value,10)||0));

k.addEventListener("change",()=>{try{bl?.()}catch{}});

for(const ev of["mousedown","mousemove","mouseup","touchstart","touchmove","click"])k.addEventListener(ev,ev=>ev.stopImmediatePropagation());

const wrap=al("div",{position:"relative"});wrap.appendChild(track);wrap.appendChild(k);gauge.appendChild(wrap);

const ticks=al("div",{display:"flex",justifyContent:"space-between",marginTop:"5px",padding:"0 1px"});

for(const t of["0","50","100"]){const sp=al("span",{fontFamily:Zs.mono,fontSize:"8px",color:Zs.muted,letterSpacing:".03em"});sp.textContent=t;ticks.appendChild(sp)}

gauge.appendChild(ticks);w.appendChild(gauge);e.appendChild(w)})();

(()=>{const{w,title}=mkSetCard("#a78bfa","#ddd6fe","linear-gradient(180deg,#ddd6fe,#7c3aed)","radial-gradient(ellipse at 50% 0%, rgba(139,92,246,.18), transparent 55%), linear-gradient(155deg,rgba(30,22,48,.8),rgba(14,14,20,.96))","rgba(139,92,246,.3)");

title.textContent=re("settings_font");w.appendChild(title);

const $=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px",position:"relative",zIndex:"1"}),C=void 0!==fl&&fl?fl:[],B=("function"==typeof q?q(_.panelFont):null)||"arial";

for(const e of C){const t=al("button",{padding:"11px 9px",borderRadius:"12px",cursor:"pointer",outline:"none",border:"1.5px solid "+(e.id===B?"rgba(167,139,250,.7)":"rgba(255,255,255,.1)"),background:e.id===B?"linear-gradient(145deg,rgba(167,139,250,.28),rgba(76,29,149,.22))":"rgba(255,255,255,.03)",color:e.id===B?"#f5f3ff":Zs.txt,fontFamily:e.css,fontSize:"12.5px",fontWeight:"700",textAlign:"left",boxSizing:"border-box",boxShadow:e.id===B?"0 0 0 1px rgba(167,139,250,.25), 0 8px 18px rgba(91,33,182,.25)":"inset 0 1px 0 rgba(255,255,255,.04)",transition:"border-color .12s, background .12s, box-shadow .12s, transform .12s"});

t.type="button";t.textContent=e.name;t.title=e.name;t.dataset.fontId=e.id;

t.addEventListener("mouseenter",()=>{t.style.transform="translateY(-1px)"});

t.addEventListener("mouseleave",()=>{t.style.transform="none"});

t.addEventListener("click",t=>{t.stopImmediatePropagation();try{H(_.panelFont,e.id)}catch{}try{ul?.()}catch{}try{bl?.()}catch{}for(const t of $.children){const n=t.dataset.fontId===e.id;t.style.border="1.5px solid "+(n?"rgba(167,139,250,.7)":"rgba(255,255,255,.1)");t.style.background=n?"linear-gradient(145deg,rgba(167,139,250,.28),rgba(76,29,149,.22))":"rgba(255,255,255,.03)";t.style.color=n?"#f5f3ff":Zs.txt;t.style.boxShadow=n?"0 0 0 1px rgba(167,139,250,.25), 0 8px 18px rgba(91,33,182,.25)":"inset 0 1px 0 rgba(255,255,255,.04)";try{t.style.setProperty("font-family",C.find(e=>e.id===t.dataset.fontId)?.css||"","important")}catch{}}cd("Font: "+e.name,"success")});

$.appendChild(t)}

w.appendChild($);e.appendChild(w)})();

return e}function Ac(){const e=al("div",{position:"fixed",top:"16px",right:"16px",left:"auto",width:ce.ui?.compact?"360px":"412px",maxWidth:"calc(100vw - 24px)",maxHeight:"calc(100vh - 32px)",background:Zs.glass||Zs.bg,border:`1px solid ${Zs.bdr}`,borderRadius:"14px",boxShadow:"0 12px 40px rgba(0,0,0,0.55)",zIndex:"2147483647",fontFamily:ml(),display:"flex",contain:"layout style paint",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",animation:"ax-in 0.24s cubic-bezier(0.16, 1, 0.3, 1) both",opacity:String(hl())}),t=al("div",{position:"absolute",inset:"0",pointerEvents:"none",background:`radial-gradient(ellipse 80% 40% at 90% -10%, ${Zs.accDim}, transparent 55%)`,opacity:"0.9",zIndex:"0"});e.appendChild(t),e.id=A.wrap;e.dataset.xbClickSfx="1";e.addEventListener("click",ev=>{try{if(!ce.ui?.sound)return;const t=ev.target;if(!t||!t.closest)return;if(t.closest("button,input,select,textarea,[role=button],.xb-click"))gd("click")}catch{}},{capture:!0});try{e.setAttribute("lang",ae()),e.dir=se()&&se().rtl?"rtl":"ltr"}catch{}for(const t of["mousedown","mouseup","mousemove","click","touchstart","touchend","touchmove","wheel"])e.addEventListener(t,e=>e.stopImmediatePropagation(),{passive:t.startsWith("touch")||"wheel"===t});const n=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:"2px",background:`linear-gradient(180deg, transparent 0%, ${Zs.acc} 30%, ${Zs.accBdr} 70%, transparent 100%)`,borderRadius:"2px 0 0 2px",opacity:"0.75",pointerEvents:"none",zIndex:"2"});e.appendChild(n);const o=function(e){const t=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px 0 14px",height:"52px",background:"transparent",borderBottom:"none",cursor:"grab",userSelect:"none",flexShrink:"0"}),n=al("div",{display:"flex",flexDirection:"column",justifyContent:"center",gap:"2px",flex:"1",minWidth:"0"}),o=al("div",{display:"flex",alignItems:"center",gap:"5px",minWidth:"0",flex:"1 1 auto",overflow:"visible"}),i=al("span",{fontFamily:ml(),fontSize:"13px",fontWeight:"800",letterSpacing:"0.04em",color:Zs.acc,textTransform:"uppercase",whiteSpace:"nowrap",flexShrink:"0",overflow:"visible"});i.textContent=gl(),Pc.panelTitleEl=i;const r=al("span",{fontFamily:Zs.mono,fontSize:"9px",fontWeight:"400",color:Zs.sub,letterSpacing:"0.05em",background:"rgba(255,255,255,0.04)",border:`1px solid ${Zs.bdrSub}`,borderRadius:"3px",padding:"1px 5px",flexShrink:"0"});r.textContent="v"+ne;const brandIco=al("div",{width:"18px",height:"18px",flexShrink:"0",animation:"ax-spin 14s linear infinite",filter:"drop-shadow(0 0 6px rgba(167,139,250,.4))"});brandIco.innerHTML=(function(){var g='stv'+Math.random().toString(36).slice(2,8);return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="18" height="18" aria-hidden="true"><defs><radialGradient id="'+g+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#05040a"/><stop offset="55%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#a78bfa"/></radialGradient></defs><path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".5"/><path d="M10 50 A 40 40 0 0 0 90 50" fill="none" stroke="#a78bfa" stroke-width="1.1" opacity=".45"/><path d="M50 10 A 40 40 0 0 1 50 90" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".4"/><path d="M50 10 A 40 40 0 0 0 50 90" fill="none" stroke="#d8b4fe" stroke-width="1.1" opacity=".35"/><circle cx="50" cy="50" r="35" fill="url(#'+g+')"/><path d="M50 15 A 17.5 17.5 0 0 1 50 50 A 17.5 17.5 0 0 0 50 85 A 35 35 0 0 1 50 15 Z" fill="#05040a" opacity=".82"/><circle cx="50" cy="32.5" r="4" fill="#e9d5ff"/><circle cx="50" cy="67.5" r="4" fill="#05040a"/></svg>';})();const siteA=al("button",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"800",color:"#f5f3ff",letterSpacing:".05em",textDecoration:"none",background:"linear-gradient(135deg,rgba(167,139,250,.45),rgba(91,33,182,.55))",border:"1px solid rgba(196,181,253,.65)",borderRadius:"6px",padding:"3px 8px",flexShrink:"0",cursor:"pointer",outline:"none",boxShadow:"0 0 12px rgba(167,139,250,.3), inset 0 1px 0 rgba(255,255,255,.18)",textTransform:"none",lineHeight:"1.15",whiteSpace:"nowrap"});siteA.type="button";siteA.textContent="cleaned by 6x0k";siteA.title="cleaned by 6x0k — 6x0k Space";siteA.setAttribute("aria-label","cleaned by 6x0k");siteA.addEventListener("click",ev=>{ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();try{gd?.("click")}catch{}try{window.open("https://github.com/6x0k/","_blank","noopener,noreferrer")}catch{try{const a=document.createElement("a");a.href="https://github.com/6x0k/";a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();a.remove()}catch{}}});o.appendChild(brandIco),o.appendChild(i),o.appendChild(r),o.appendChild(siteA),n.appendChild(o);;const d=Ec('<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',re("settings"),!0),p=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',"K\xfc\xe7\xfclt",!0),u=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>',"B\xfcy\xfct",!0),f=Ec('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',re("btn_close"),!0);f.addEventListener("mouseenter",()=>{f.style.background="rgba(239,68,68,0.35)",f.style.color="#fff"}),f.addEventListener("mouseleave",()=>{f.style.background="transparent",f.style.color=Zs.sub});const m=al("div",{display:"flex",gap:"2px",flexShrink:"0",marginLeft:"4px",paddingLeft:"6px",borderLeft:`1px solid ${Zs.bdrSub}`});m.appendChild(p),m.appendChild(u),m.appendChild(f);const g=al("div",{display:"flex",gap:"3px",flexShrink:"0",alignItems:"center"});g.appendChild(d),g.appendChild(m),t.appendChild(n),t.appendChild(g),t.addEventListener("mousedown",n=>{if(n.target.closest("button"))return;if($c)return;n.stopImmediatePropagation(),n.preventDefault();const o=e.getBoundingClientRect();Lc.on=!0,Lc.ox=n.clientX-o.left,Lc.oy=n.clientY-o.top,t.style.cursor="grabbing";const i=t=>{Lc.on&&(e.style.left=Math.min(Math.max(0,t.clientX-Lc.ox),innerWidth-e.offsetWidth)+"px",e.style.top=Math.min(Math.max(0,t.clientY-Lc.oy),innerHeight-e.offsetHeight)+"px",e.style.right="auto")},r=()=>{Lc.on=!1,t.style.cursor="grab",window.removeEventListener("mousemove",i,!0),window.removeEventListener("mouseup",r,!0)};window.addEventListener("mousemove",i,!0),window.addEventListener("mouseup",r,!0)}),d.style.display="none";d.addEventListener("click",()=>{sd("settings")});const h=()=>{const t=Ic&&!$c;Pc.tabBar&&(Pc.tabBar.style.display=t?"none":"flex"),Pc.body&&(Pc.body.style.display=t?"none":"block"),Pc.settingsPanel&&t&&(Pc.settingsPanel.style.display="none",e.style.minHeight="");try{const n=e.querySelector("[data-header-account]");n&&(n.style.display=t?"none":"")}catch{}p.innerHTML=Ic?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="4 14 12 6 20 14"/><line x1="4" y1="20" x2="20" y2="20"/></svg>':'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',p.title=Ic?"Geri getir":"K\xfc\xe7\xfclt",e.style.maxHeight=Ic&&!$c||$c?"none":"calc(100vh - 32px)";try{Pc.spamMeterBar&&(Pc.spamMeterBar.style.animation="none")}catch{}},y=()=>{if($c){const t=e.getBoundingClientRect();zc={left:e.style.left||t.left+"px",top:e.style.top||t.top+"px",right:e.style.right||"auto",width:e.style.width||t.width+"px",maxHeight:e.style.maxHeight||"calc(100vh - 32px)",borderRadius:e.style.borderRadius||"14px"},e.style.left="12px",e.style.top="12px",e.style.right="12px",e.style.width="calc(100vw - 24px)",e.style.maxWidth="calc(100vw - 24px)",e.style.maxHeight="calc(100vh - 24px)",e.style.height="calc(100vh - 24px)",e.style.borderRadius="10px",Ic=!1,h(),u.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="8" y="8" width="10" height="10" rx="1"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>',u.title="Eski boyuta d\xf6n"}else e.style.height="",zc?(e.style.left=zc.left,e.style.top=zc.top,e.style.right="auto"===zc.right?"auto":zc.right,e.style.width=zc.width,e.style.maxHeight=zc.maxHeight,e.style.borderRadius=zc.borderRadius):(e.style.left="auto",e.style.right="16px",e.style.top="16px",e.style.width=ce.ui?.compact?"350px":"378px",e.style.maxWidth="calc(100vw - 24px)",e.style.maxHeight="calc(100vh - 32px)",e.style.borderRadius="14px"),u.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>',u.title="B\xfcy\xfct",h()};return p.addEventListener("click",e=>{e.stopImmediatePropagation(),$c&&($c=!1,y()),Ic=!Ic,h()}),u.addEventListener("click",e=>{e.stopImmediatePropagation(),$c=!$c,y()}),f.addEventListener("click",t=>{t.stopImmediatePropagation(),function(e){Bc=!0;const t=e||Cc;if(t){t.style.display="none";try{t.setAttribute("data-xb-closed","1")}catch{}}(function(){const e=document.body||j();if(!e)return;let t=Pc.restoreFab;if(!t||!t.isConnected){t=document.createElement("button"),Object.assign(t.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"2147483647",width:"58px",height:"58px",minWidth:"58px",padding:"0",borderRadius:"50%",border:"none",background:"transparent",color:Zs.acc||"#c4b5fd",cursor:"grab",outline:"none",boxShadow:"0 8px 24px rgba(0,0,0,0.45)",display:"none",alignItems:"center",justifyContent:"center",pointerEvents:"auto",touchAction:"none",userSelect:"none",overflow:"visible"}),t.type="button",t.title="6x0k Space \u2014 s\xfcr\xfckle veya t\u0131kla",t.setAttribute("data-xb-restore-fab","1"),t.setAttribute("aria-label","6x0k Space");t.innerHTML="";(function(){try{const id="xb-fab-spin-css";if(!document.getElementById(id)){const st=document.createElement("style");st.id=id;st.textContent="@keyframes xb-fab-spin{to{transform:rotate(360deg)}}";(document.head||document.documentElement).appendChild(st)}}catch{}})();t.style.filter="drop-shadow(0 0 12px rgba(167,139,250,.45))";const wrap=document.createElement("div");wrap.setAttribute("data-xb-fab-spin","1");Object.assign(wrap.style,{width:"58px",height:"58px",borderRadius:"50%",display:"block",animation:"xb-fab-spin 12s linear infinite",transformOrigin:"50% 50%",willChange:"transform",pointerEvents:"none"});wrap.innerHTML=(function(){var g='stv'+Math.random().toString(36).slice(2,8);return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true" style="display:block"><defs><radialGradient id="'+g+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#05040a"/><stop offset="55%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#a78bfa"/></radialGradient></defs><path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".5"/><path d="M10 50 A 40 40 0 0 0 90 50" fill="none" stroke="#a78bfa" stroke-width="1.1" opacity=".45"/><path d="M50 10 A 40 40 0 0 1 50 90" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".4"/><path d="M50 10 A 40 40 0 0 0 50 90" fill="none" stroke="#d8b4fe" stroke-width="1.1" opacity=".35"/><circle cx="50" cy="50" r="35" fill="url(#'+g+')"/><path d="M50 15 A 17.5 17.5 0 0 1 50 50 A 17.5 17.5 0 0 0 50 85 A 35 35 0 0 1 50 15 Z" fill="#05040a" opacity=".82"/><circle cx="50" cy="32.5" r="4" fill="#e9d5ff"/><circle cx="50" cy="67.5" r="4" fill="#05040a"/></svg>';})();t.appendChild(wrap);try{const raw=localStorage.getItem("xb_fab_pos");if(raw){const p=JSON.parse(raw);if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){t.style.left=p.left+"px";t.style.top=p.top+"px";t.style.right="auto";t.style.bottom="auto"}}}catch{}const openPanel=()=>{!function(){Bc=!1;const e=Cc;if(e){try{if(window.__xbGate&&window.__xbGate.allowed===false)return}catch(e){}e.style.display="flex";try{e.removeAttribute("data-xb-closed")}catch{}try{bl?.()}catch{}}try{Pc.restoreFab&&(Pc.restoreFab.style.display="none")}catch{}}()};let drag=null;const onMove=e=>{if(!drag)return;const pt=e.touches&&e.touches[0]?e.touches[0]:e;const x=pt.clientX-drag.ox,y=pt.clientY-drag.oy;if(Math.abs(x-drag.sl)+Math.abs(y-drag.st)>5)drag.moved=!0;const maxX=Math.max(8,window.innerWidth-t.offsetWidth-8),maxY=Math.max(8,window.innerHeight-t.offsetHeight-8);const nx=Math.min(maxX,Math.max(8,x)),ny=Math.min(maxY,Math.max(8,y));t.style.left=nx+"px";t.style.top=ny+"px";t.style.right="auto";t.style.bottom="auto";try{e.preventDefault()}catch{}};const onUp=e=>{if(!drag)return;const moved=!!drag.moved;drag=null;t.style.cursor="grab";window.removeEventListener("pointermove",onMove,!0);window.removeEventListener("pointerup",onUp,!0);window.removeEventListener("touchmove",onMove,!0);window.removeEventListener("touchend",onUp,!0);try{localStorage.setItem("xb_fab_pos",JSON.stringify({left:parseFloat(t.style.left)||0,top:parseFloat(t.style.top)||0}))}catch{}if(!moved){try{e&&e.preventDefault();e&&e.stopPropagation();e&&e.stopImmediatePropagation()}catch{}openPanel()}};const onDown=e=>{try{e.preventDefault();e.stopPropagation()}catch{};const pt=e.touches&&e.touches[0]?e.touches[0]:e;const rect=t.getBoundingClientRect();drag={ox:pt.clientX-rect.left,oy:pt.clientY-rect.top,sl:rect.left,st:rect.top,moved:!1};t.style.cursor="grabbing";window.addEventListener("pointermove",onMove,!0);window.addEventListener("pointerup",onUp,!0);window.addEventListener("touchmove",onMove,{capture:!0,passive:!1});window.addEventListener("touchend",onUp,!0);};t.addEventListener("pointerdown",onDown,!0),t.addEventListener("touchstart",onDown,{capture:!0,passive:!1}),e.appendChild(t),Pc.restoreFab=t}t.style.display="flex",t.style.pointerEvents="auto",t.style.zIndex="2147483647";try{let wrap=t.querySelector("[data-xb-fab-spin]");if(!wrap){wrap=document.createElement("div");wrap.setAttribute("data-xb-fab-spin","1");Object.assign(wrap.style,{width:"58px",height:"58px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",animation:"xb-fab-spin 12s linear infinite",transformOrigin:"center center",willChange:"transform",pointerEvents:"none",filter:"drop-shadow(0 0 10px rgba(167,139,250,.4))"});wrap.innerHTML=(function(){var g='stv'+Math.random().toString(36).slice(2,8);return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true" style="display:block"><defs><radialGradient id="'+g+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#05040a"/><stop offset="55%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#a78bfa"/></radialGradient></defs><path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".5"/><path d="M10 50 A 40 40 0 0 0 90 50" fill="none" stroke="#a78bfa" stroke-width="1.1" opacity=".45"/><path d="M50 10 A 40 40 0 0 1 50 90" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".4"/><path d="M50 10 A 40 40 0 0 0 50 90" fill="none" stroke="#d8b4fe" stroke-width="1.1" opacity=".35"/><circle cx="50" cy="50" r="35" fill="url(#'+g+')"/><path d="M50 15 A 17.5 17.5 0 0 1 50 50 A 17.5 17.5 0 0 0 50 85 A 35 35 0 0 1 50 15 Z" fill="#05040a" opacity=".82"/><circle cx="50" cy="32.5" r="4" fill="#e9d5ff"/><circle cx="50" cy="67.5" r="4" fill="#05040a"/></svg>';})();t.innerHTML="";t.appendChild(wrap)}else{(function(){try{const id="xb-fab-spin-css";if(!document.getElementById(id)){const st=document.createElement("style");st.id=id;st.textContent="@keyframes xb-fab-spin{to{transform:rotate(360deg)}}";(document.head||document.documentElement).appendChild(st)}}catch{}})();t.style.filter="drop-shadow(0 0 12px rgba(167,139,250,.45))";wrap.style.animation="none";void wrap.offsetWidth;wrap.style.animation="xb-fab-spin 12s linear infinite"}}catch{}})(),cd("Panel kapand\u0131 \xb7 y\xfczen 6x0k Space ikonuna bas","info")}(e)}),Pc.minBtn=p,Pc.maxBtn=u,Pc.closeBtn=f,t}(e);o.style.position="relative",o.style.zIndex="2",e.appendChild(o),e.appendChild(function(){const e=al("div",{display:"flex",alignItems:"center",gap:"8px",padding:"4px 12px 6px",background:"linear-gradient(180deg,rgba(167,139,250,.06),rgba(255,255,255,.015))",borderBottom:"1px solid rgba(167,139,250,.12)",flexShrink:"0",minHeight:"44px",boxSizing:"border-box"});try{e.dataset.headerAccount="1"}catch{}const t=al("div",{flex:"1",minWidth:"0"});return Pc.headerAccountMount=t,e.appendChild(t),xd(),e}());e.appendChild(function(){const row=al("div",{display:"flex",flexDirection:"row",flex:"1",minHeight:"0",position:"relative",zIndex:"1",overflow:"hidden",background:"transparent"});const nav=al("div",{width:"78px",flexShrink:"0",display:"flex",flexDirection:"column",gap:"3px",padding:"10px 7px",boxSizing:"border-box",background:"linear-gradient(185deg,rgba(255,255,255,0.05) 0%,rgba(0,0,0,0.28) 100%)",borderRight:`1px solid ${Zs.bdrSub}`,overflowY:"auto",overflowX:"hidden",position:"relative",scrollbarWidth:"thin"});const accent=al("div",{position:"absolute",left:"0",top:"12px",width:"3px",height:"40px",borderRadius:"0 4px 4px 0",background:Zs.acc,boxShadow:`0 0 14px ${Zs.accGlow}, 0 0 4px ${Zs.acc}`,transition:"transform .22s cubic-bezier(.16,1,.3,1)",pointerEvents:"none",zIndex:"3"});nav.appendChild(accent);Pc.tabAccent=accent;const btns={};const tabs=[["profile",re("tab_profile"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'],["homes",re("tab_homes"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>'],["auto",re("tab_auto"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'],["bots",re("tab_bots"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>'],["misc",re("tab_misc"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>'],["emoji",re("tab_emoji"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'],["chatroom",re("tab_chat"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>'],["spam",re("tab_spam"),'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>'],["pets","Pets / PetClone",'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9.5C6 6 3.2 7.2 3.7 10c-2.4-.3-3.8 2.6-1.5 4.1 0 2.7 3.4 4.1 5 1.8 1 2.7 5.5 2.7 6.5 0 1.6 2.3 5 .9 5-1.8 2.3-1.5.9-4.4-1.5-4.1.5-2.8-2.3-4-4.3-.5C11.6 6.7 9.4 6.7 8 9.5z"/></svg>']];const syncAccent=()=>{try{const b=btns[Tc];if(!b||!Pc.tabAccent)return;const y=b.offsetTop+(b.offsetHeight-40)/2;Pc.tabAccent.style.transform="translateY("+Math.max(0,y-12)+"px)"}catch{}};for(const[n,i,r]of tabs){const e=al("button",{width:"100%",padding:"9px 3px 8px",background:"linear-gradient(160deg,rgba(255,255,255,.07) 0%,rgba(20,16,32,.55) 55%,rgba(0,0,0,.35) 100%)",border:"1px solid rgba(167,139,250,.18)",borderRadius:"15px",outline:"none",fontFamily:Zs.sans,fontSize:"8px",fontWeight:"800",color:Zs.sub,cursor:"pointer",transition:"color .18s,background .18s,border-color .18s,box-shadow .18s,transform .18s,filter .18s",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",letterSpacing:".06em",textTransform:"uppercase",position:"relative",zIndex:"1",boxShadow:"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)",overflow:"hidden"});e.type="button",e.dataset.tabId=n,e.title=i,e.innerHTML=r+'<span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;line-height:1.15;text-align:center">'+i+"</span>",btns[n]=e,e.addEventListener("click",()=>{sd(n),e.style.animation="ax-tab-in .2s ease",setTimeout(()=>{e.style.animation=""},220),requestAnimationFrame(syncAccent)}),e.addEventListener("mouseenter",()=>{Tc!==n&&(e.style.color="#f5f3ff",e.style.background="linear-gradient(160deg,rgba(167,139,250,.28),rgba(40,30,60,.7))",e.style.borderColor="rgba(196,181,253,.55)",e.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.12), 0 0 18px rgba(167,139,250,.28)",e.style.transform="translateY(-1px) scale(1.02)")}),e.addEventListener("mouseleave",()=>{Tc!==n&&(e.style.color=Zs.sub,e.style.background="linear-gradient(160deg,rgba(255,255,255,.07) 0%,rgba(20,16,32,.55) 55%,rgba(0,0,0,.35) 100%)",e.style.borderColor="rgba(167,139,250,.18)",e.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)",e.style.transform="none")}),nav.appendChild(e)}(()=>{const sb=al("button",{width:"100%",padding:"9px 3px 8px",marginTop:"8px",background:"linear-gradient(160deg,rgba(255,255,255,.07) 0%,rgba(20,16,32,.55) 55%,rgba(0,0,0,.35) 100%)",border:"1px solid rgba(167,139,250,.18)",borderRadius:"15px",outline:"none",fontFamily:Zs.sans,fontSize:"8px",fontWeight:"800",color:Zs.sub,cursor:"pointer",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",letterSpacing:".06em",textTransform:"uppercase",position:"relative",zIndex:"1",boxShadow:"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)",overflow:"hidden"});sb.type="button";sb.title=re("settings");sb.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;line-height:1.15;text-align:center">'+re("settings")+"</span>";sb.addEventListener("click",()=>{sd("settings");try{sb.style.color=Zs.acc;sb.style.borderColor=Zs.accBdr||"rgba(167,139,250,.4)";sb.style.boxShadow="0 0 18px rgba(167,139,250,.25), inset 0 1px 0 rgba(255,255,255,.04)"}catch{}});sb.addEventListener("mouseenter",()=>{sb.style.color=Zs.txt});sb.addEventListener("mouseleave",()=>{if(Tc!=="settings")sb.style.color=Zs.sub});nav.appendChild(sb);Pc.settingsRailBtn=sb;const fb=al("button",{width:"100%",padding:"8px 3px 7px",marginTop:"4px",background:"linear-gradient(160deg,rgba(245,158,11,.2) 0%,rgba(40,28,12,.55) 55%,rgba(0,0,0,.35) 100%)",border:"1px solid rgba(251,191,36,.32)",borderRadius:"15px",outline:"none",fontFamily:Zs.sans,fontSize:"7.5px",fontWeight:"800",color:Zs.sub,cursor:"pointer",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"3px",letterSpacing:".05em",textTransform:"uppercase",position:"relative",zIndex:"1",boxShadow:"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)",overflow:"hidden"});fb.type="button";fb.style.textTransform="none";fb.title="Changelog";fb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span style="display:flex;flex-direction:column;align-items:center;line-height:1.08;text-align:center;max-width:100%;text-transform:none;letter-spacing:.04em"><span style="overflow:hidden;text-overflow:ellipsis;max-width:100%;font-size:7.5px;font-weight:800">'+"CHANGELOG"+'</span><span style="overflow:hidden;text-overflow:ellipsis;max-width:100%;font-size:7.5px;font-weight:800;opacity:.95">'+"UPDATES"+'</span></span>';fb.addEventListener("click",()=>{sd("changelog");try{fb.style.color="#fbbf24";fb.style.borderColor="rgba(251,191,36,.5)";fb.style.boxShadow="0 0 18px rgba(245,158,11,.28), inset 0 1px 0 rgba(255,255,255,.04)"}catch{}});fb.addEventListener("mouseenter",()=>{fb.style.color=Zs.txt});fb.addEventListener("mouseleave",()=>{if(Tc!=="feedback")fb.style.color=Zs.sub});nav.appendChild(fb);Pc.changelogRailBtn=fb})();nav.style.position="relative";nav.style.zIndex="20";nav.style.flexShrink="0";Pc.tabBtns=btns,Pc.tabBar=nav,Pc.syncTabAccent=syncAccent,row.appendChild(nav),row.appendChild(function(){const e=al("div",{flex:"1",overflowY:"auto",overflowX:"hidden",padding:"0 12px 12px",background:"transparent",minHeight:"0",boxSizing:"border-box",position:"relative",zIndex:"1"});e.id=A.body,e.appendChild(function(){const e=al("div",{display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center",padding:"8px 8px 9px",marginBottom:"6px",borderRadius:"12px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.08)",flexShrink:"0"});e.style.display="none";return e.dataset.panelChrome="status-strip",Pc.globalStatusStrip=e,e}()),e.appendChild(function(){const e=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"7px",margin:"8px 0 10px",padding:"9px 8px",borderRadius:"14px",background:"radial-gradient(ellipse at 20% 0%, rgba(167,139,250,.12), transparent 55%), rgba(255,255,255,.02)",border:"1px solid rgba(167,139,250,.16)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04)"});e.dataset.panelChrome="fav-bar";const mk=(lab,icon,fn,tone)=>{const o=xl(lab,icon,"primary");o.style.fontSize="10px";o.style.padding="8px 6px";o.style.fontWeight="800";o.style.letterSpacing=".04em";o.style.borderRadius="12px";o.style.minHeight="36px";o.style.gap="5px";const tones={acc:["linear-gradient(135deg,rgba(167,139,250,.28),rgba(124,58,237,.12))","rgba(167,139,250,.42)","#ede9fe"],cyan:["linear-gradient(135deg,rgba(56,189,248,.22),rgba(0,0,0,.15))","rgba(56,189,248,.35)","#bae6fd"],gold:["linear-gradient(135deg,rgba(251,191,36,.28),rgba(245,158,11,.1))","rgba(251,191,36,.4)","#fde68a"],pink:["linear-gradient(135deg,rgba(244,114,182,.22),rgba(0,0,0,.15))","rgba(244,114,182,.35)","#fbcfe8"]};const tn=tones[tone]||tones.acc;o.style.background=tn[0];o.style.borderColor=tn[1];o.style.color=tn[2];if(tone==="acc")o.style.boxShadow="0 0 14px rgba(167,139,250,.2)";o.addEventListener("click",ev=>{ev.stopImmediatePropagation();fn()});return o};e.appendChild(mk(re("fav_imza"),"autograph",()=>{sd("bots");try{Rs||Us();Rs&&(Rs.style.display="flex",Rs.style.zIndex="2147483647",(j()||document.body).appendChild(Rs),Ns())}catch{}},"acc"));e.appendChild(mk(re("fav_ghost"),"mood",()=>{sd("chatroom")},"cyan"));e.appendChild(mk(re("fav_quests"),"quests",()=>{sd("auto")},"gold"));e.appendChild(mk(re("fav_emoji"),"status",()=>{sd("emoji")},"pink"));e.appendChild(mk(re("fav_profile_info"),"user",()=>{sd("profile");try{setTimeout(()=>{const inp=Pc.profileLookupInput;if(inp){inp.scrollIntoView({behavior:"smooth",block:"center"});try{inp.focus()}catch{}}},60)}catch{}},"acc"));e.appendChild(mk(re("fav_vip"),"crystal",()=>{sd("misc");try{openVipPanel()}catch{}},"gold"));Pc.favBar=e;return e}());const t=()=>{const e=al("div",{display:"none",flexDirection:"column"});return e.appendChild(function(e,t){const n=al("div",{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"26px 14px 22px",textAlign:"center",gap:"12px",border:`1px solid ${Zs.bdrSub}`,borderRadius:"16px",background:`radial-gradient(ellipse at 50% 20%, ${Zs.accDim}, transparent 65%), linear-gradient(180deg, rgba(255,255,255,.03), transparent 55%)`,margin:"12px 0",position:"relative",overflow:"hidden"});const glow=al("div",{position:"absolute",width:"120px",height:"120px",borderRadius:"50%",background:"rgba(167,139,250,.12)",filter:"blur(28px)",top:"-20px",left:"50%",transform:"translateX(-50%)",pointerEvents:"none"});const mark=al("div",{width:"64px",height:"64px",flexShrink:"0",animation:"ax-spin 14s linear infinite",filter:"drop-shadow(0 0 14px rgba(167,139,250,.45))",position:"relative",zIndex:"1"});mark.innerHTML=(function(){var g='stv'+Math.random().toString(36).slice(2,8);return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="64" height="64" aria-hidden="true"><defs><radialGradient id="'+g+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#05040a"/><stop offset="55%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#a78bfa"/></radialGradient></defs><path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".5"/><path d="M10 50 A 40 40 0 0 0 90 50" fill="none" stroke="#a78bfa" stroke-width="1.1" opacity=".45"/><path d="M50 10 A 40 40 0 0 1 50 90" fill="none" stroke="#c4b5fd" stroke-width="1.1" opacity=".4"/><path d="M50 10 A 40 40 0 0 0 50 90" fill="none" stroke="#d8b4fe" stroke-width="1.1" opacity=".35"/><circle cx="50" cy="50" r="35" fill="url(#'+g+')"/><path d="M50 15 A 17.5 17.5 0 0 1 50 50 A 17.5 17.5 0 0 0 50 85 A 35 35 0 0 1 50 15 Z" fill="#05040a" opacity=".82"/><circle cx="50" cy="32.5" r="4" fill="#e9d5ff"/><circle cx="50" cy="67.5" r="4" fill="#05040a"/></svg>';})();const ring=al("div",{width:"76px",height:"76px",borderRadius:"50%",border:`1px solid ${Zs.bdrSub}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:"1",boxShadow:`inset 0 0 20px ${Zs.accDim}`});ring.appendChild(mark);const o=al("div",{fontFamily:Zs.display||Zs.sans,fontSize:"15px",fontWeight:"800",color:Zs.acc,letterSpacing:"0.06em",textTransform:"uppercase",position:"relative",zIndex:"1"});o.textContent=e||"6x0k Space";const wait=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,letterSpacing:"0.04em",position:"relative",zIndex:"1"});wait.textContent="MSP2 giri\u015fi bekleniyor";const dots=al("span",{color:Zs.acc,marginLeft:"2px"});dots.textContent="";wait.appendChild(dots);let di=0;const tick=()=>{if(!dots.isConnected)return;dots.textContent=".".repeat(di%4);di++;setTimeout(tick,480)};tick();n.appendChild(glow),n.appendChild(ring),n.appendChild(o),n.appendChild(wait);return n}(re("brand_name")||"6x0k Space")),e.appendChild(function(e){const t=al("div",{padding:"16px 0",borderBottom:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"}),n=(e,n,o)=>{const i=al("div");i.className="ax-skel",Object.assign(i.style,{height:n,width:e,marginBottom:o}),t.appendChild(i)};n("38%","9px","6px"),n("60%","7px","16px");for(let t=0;t<e;t++)n("100%","32px","8px");return n("100%","34px","0"),t}(1)),e},n={profile:t(),homes:t(),auto:t(),bots:t(),misc:t(),emoji:t(),chatroom:t(),spam:t(),settings:t(),feedback:t()},o={profile:Dc(),homes:homesPane(),auto:jc(),bots:_c(),misc:Rc(),emoji:vc(),chatroom:Oc(),spam:spamPane(),pets:petsPane(),settings:settingsPane(),changelog:changelogPane()};for(const t of Object.values(n))e.appendChild(t);for(const t of Object.values(o))e.appendChild(t);return Pc.skelPanes=n,Pc.panes=o,Pc.settingsPanel=o.settings,Pc.body=e,e}()),requestAnimationFrame(syncAccent);return row}());try{bl?.()}catch{}return e}function Ec(e,t,n){const o=al("button",{width:"28px",height:"28px",border:n?"none":`1px solid ${Zs.bdrSub}`,outline:"none",background:"transparent",borderRadius:"5px",color:Zs.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.12s, border-color 0.12s, color 0.12s",flexShrink:"0",padding:"0",boxSizing:"border-box"});return o.title=t,o.innerHTML=e,o.addEventListener("mouseenter",()=>{o.style.background="rgba(255,255,255,0.06)",n||(o.style.borderColor="rgba(255,255,255,0.12)"),o.style.color=Zs.txt}),o.addEventListener("mouseleave",()=>{o.style.background="transparent",n||(o.style.borderColor=Zs.bdrSub),o.style.color=Zs.sub}),o}function Dc(){const softMoods=[{"id":"mood_cool_slide_asset","name":"Cool Slide","group":"soft"},{"id":"mood_bambislide_asset","name":"Like Bambi","group":"soft"},{"id":"mood_noshoes_skating_asset","name":"No Shoes Skating","group":"soft"},{"id":"mood_bunny_hold_asset","name":"Bunny Hold","group":"soft"},{"id":"mood_straw_2023_bunnyjump_dg_asset","name":"Bunny Jump","group":"soft"},{"id":"mood_swim_new_asset","name":"Swim","group":"soft"},{"id":"mood_2023_spidercrawl_lsz_asset","name":"Spider Crawl","group":"soft"},{"id":"mood_2023_bended_lz_asset","name":"Bended","group":"soft"},{"id":"mood_spicyaftershave_asset","name":"Spicy Aftershave","group":"soft"},{"id":"mood_iceskate_ballerina_asset","name":"Ice Skate Ballerina","group":"soft"},{"id":"mood_im_in_love_asset","name":"In Love","group":"soft"},{"id":"mood_xmas_2022_frosty_dg_asset","name":"Frosty (Xmas)","group":"soft"},{"id":"mood_2022_easter_sackjump_dg_asset","name":"Sacking Behind","group":"soft"},{"id":"mood_2022_turkeywalk_lsz_asset","name":"Like a Turkey","group":"soft"},{"id":"mood_xmas_2022_freezing_lsz_asset","name":"Freezing","group":"soft"},{"id":"mood_bad_2022_teenwalk_dg_asset","name":"My World","group":"soft"},{"id":"mood_very_2022_froglike_lsz_asset","name":"Like a Frog","group":"soft"},{"id":"mood_xmas_2022_magicfloat_lsz_asset","name":"Magic Float","group":"soft"},{"id":"mood_very_2022_onhands_lsz_asset","name":"On Hands","group":"soft"},{"id":"mood_slippery_asset","name":"Slippery","group":"soft"},{"id":"mood_food1_hold__asset","name":"Food Hold 1","group":"soft"},{"id":"mood_food2_hold__asset","name":"Food Hold 2","group":"soft"},{"id":"mood_food3_hold__asset","name":"Food Hold 3","group":"soft"},{"id":"mood_egg_hold_asset","name":"Egg Hold","group":"soft"},{"id":"mood_holmes_2023_fighting_lsz_asset","name":"Ready to Fight!","group":"soft"}];const normalMoods=[{"id":"mood_angry_asset","name":"Angry","group":"normal"},{"id":"mood_2023_asleep_lsz_asset","name":"Asleep","group":"normal"},{"id":"mood_cinna_2025_windwithleaves_lsz_asset","name":"Autumn Wind","group":"normal"},{"id":"mood_cinna_2025_wind_lsz_asset","name":"Cold Wind","group":"normal"},{"id":"mood_dress_2023_complaining_dg_asset","name":"Complaining","group":"normal"},{"id":"mood_depressed_emowalk_asset","name":"Depressed","group":"normal"},{"id":"mood_eyesnotworking_asset","name":"Eyes Not Working","group":"normal"},{"id":"mood_frog_2022_scared_lsz_asset","name":"Frightened","group":"normal"},{"id":"mood_frosty_walk_asset","name":"Frosty Walk","group":"normal"},{"id":"mood_superhappy_asset","name":"Happy","group":"normal"},{"id":"mood_joy_2024_inthesnow_lsz_asset","name":"In The Snow","group":"normal"},{"id":"mood_all_2024_sillypose_dg_asset","name":"Just Silly","group":"normal"},{"id":"mood_default_asset","name":"Neutral","group":"normal"},{"id":"mood_basic_2024_strut_lsz_asset","name":"Oh Sassy","group":"normal"},{"id":"mood_left_2025_shywalkanim_lsz_asset","name":"Please Don't Look at Me","group":"normal"},{"id":"mood_picnic_2024_princess_lsz_asset","name":"Princess Mood","group":"normal"},{"id":"mood_2025_rainycloud_lsz_asset","name":"Rainy Days","group":"normal"},{"id":"mood_raptor_asset","name":"Raptor","group":"normal"},{"id":"mood_rare_2024_dance7_dg_asset","name":"Ready to Fight (Dance)","group":"normal"},{"id":"mood_relaxed_asset","name":"Relaxed","group":"normal"},{"id":"mood_supersad_asset","name":"Sad","group":"normal"},{"id":"mood_cinna_2025_rainshield_dg_asset","name":"Shielded from Rain","group":"normal"},{"id":"mood_sleepy_asset","name":"Sleepy","group":"normal"},{"id":"mood_so_in_love_asset","name":"So In Love","group":"normal"},{"id":"mood_holmes_2023_waltz_lsz_asset","name":"Solitude Waltz","group":"normal"},{"id":"mood_crim_2024_spideranim_lsz_asset","name":"Spider Hybrid","group":"normal"},{"id":"mood_run_asset","name":"Sporty","group":"normal"},{"id":"mood_eparty_2022_walking_tired_dg_asset","name":"Tired","group":"normal"},{"id":"mood_9to5_2024_ceo_dg_asset","name":"Walk and Work","group":"normal"},{"id":"mood_bon_2025_cutewalk_dg_asset","name":"Walk Like a Cutie","group":"normal"},{"id":"mood_bad_2022_teenwalknogum_lsz_asset","name":"Certain","group":"normal"},{"id":"mood_comfidance_asset","name":"Confidance","group":"normal"},{"id":"mood_xmas_2024_snowboarding_lsz_asset","name":"Cool as Snow","group":"normal"},{"id":"mood_tiki_2024_wormanim_lsz_asset","name":"Do The Worm!","group":"normal"},{"id":"mood_9to5_2024_strong_dg_asset","name":"Flexing My Muscles","group":"normal"},{"id":"mood_summer_2026_floatie_lsz_asset","name":"Floatie Vibes","group":"normal"},{"id":"mood_hiphop_asset","name":"Hip Hop","group":"normal"},{"id":"mood_starlit_2025_moonpose_dg_asset","name":"Moon Fall","group":"normal"},{"id":"mood_notimpressed_asset","name":"Not Impressed","group":"normal"},{"id":"mood_dream_2024_onthemoon_lsz_asset","name":"On The Moon","group":"normal"},{"id":"mood_proud_asset","name":"Proud","group":"normal"},{"id":"mood_2024_snowballroll_lsz_asset","name":"Rolling in the Snow","group":"normal"},{"id":"mood_runaway_asset","name":"Runway","group":"normal"},{"id":"mood_badd_2025_skateboardanim_lsz_asset","name":"Skateboarding","group":"normal"},{"id":"mood_xmas_2024_skiing_lsz_asset","name":"Skiing Away","group":"normal"},{"id":"mood_lofi_2023_voguing_dg_asset","name":"Strike a Pose","group":"normal"},{"id":"mood_catch_2025_backwalk_lsz_asset","name":"Turn Around?","group":"normal"},{"id":"mood_easter_2025_balloonflight_lsz_asset","name":"Up, Up, Away!","group":"normal"},{"id":"mood_shinobi_asset","name":"Anime","group":"normal"},{"id":"mood_bigcity_2025_stomping_lsz_asset","name":"Asphalt Crush","group":"normal"},{"id":"mood_ballerina_asset","name":"Ballerina","group":"normal"},{"id":"mood_easter_2025_carouselhorse_lsz_asset","name":"Carousel Horse","group":"normal"},{"id":"mood_vibe_2022_catwalk_lsz_asset","name":"Cat Walk","group":"normal"},{"id":"mood_shock_2023_crabwalk_dg_asset","name":"Crab Walk","group":"normal"},{"id":"mood_haunt_2024_nurse_lsz_asset","name":"Creepy","group":"normal"},{"id":"mood_vibe_2022_duckwalk_lsz_asset","name":"Duck Walk","group":"normal"},{"id":"mood_flikflak_asset","name":"Flik Flak","group":"normal"},{"id":"mood_yule_2024_inthemist_lsz_asset","name":"Floating Above All","group":"normal"},{"id":"mood_alls_2026_frontwalkover_lsz_asset","name":"Front Walkover","group":"normal"},{"id":"mood_easter_2025_rabbitjump_dg_asset","name":"Hop Hop!","group":"normal"},{"id":"mood_calico_2026_catmood_lsz_asset","name":"Kitty Walk","group":"normal"},{"id":"mood_monster_2023_monstervibe_dg_asset","name":"Monster Vibe","group":"normal"},{"id":"mood_easygoing_asset","name":"One with Nature","group":"normal"},{"id":"mood_lofi_2023_wavyarms_dg_asset","name":"Ragdoll","group":"normal"},{"id":"mood_ghost_2022_sick_lsz_asset","name":"Sick","group":"normal"},{"id":"mood_trick_2022_evil_lsz_asset","name":"Sinister","group":"normal"},{"id":"mood_flower_2022_sleepwalk_lsz_asset","name":"Sleep Walk","group":"normal"},{"id":"mood_sneaking_off_asset","name":"Sneaking Off","group":"normal"},{"id":"mood_english_2025_glitter_lsz_asset","name":"Sparkle Charm","group":"normal"},{"id":"mood_2024_abouttoblowup_lsz_asset","name":"Stormy","group":"normal"},{"id":"mood_xmas_2025_crazyskiing_ls_asset","name":"Struggling a Bit","group":"normal"},{"id":"mood_terrified_asset","name":"Terrified","group":"normal"},{"id":"mood_ballet_2024_balletpose2_dg_asset","name":"Tippy Toes","group":"normal"},{"id":"mood_sea_2023_swim_lsz_asset","name":"A bit Fishy","group":"normal"},{"id":"mood_pink_2023_dollmoves_dg_asset","name":"Activate Doll","group":"normal"},{"id":"mood_ice_2023_airswim_dg_asset","name":"Air Swimming","group":"normal"},{"id":"mood_english_2025_broomanim_lsz_asset","name":"Bewitched Blossom","group":"normal"},{"id":"mood_soft_2026_buttonrunover_lsz_asset","name":"Button Run Over","group":"normal"},{"id":"mood_velvet_2025_dragonfly_lsz_asset","name":"Dragonfly","group":"normal"},{"id":"mood_encha_2024_regularflying_lsz_asset","name":"Floating","group":"normal"},{"id":"mood_fruitty_2024_strawberryflying_lsz_asset","name":"Floating Berry","group":"normal"},{"id":"mood_easter_2025_flowerbroomanim_lsz_asset","name":"Flower Broom","group":"normal"},{"id":"mood_easter_2024_flowersteps_dg_asset","name":"Flower Steps","group":"normal"},{"id":"mood_ghostly_flying_asset","name":"Ghost","group":"normal"},{"id":"mood_snow_2024_smowflakefloatanim_lsz_asset","name":"Giant Snowflake","group":"normal"},{"id":"mood_sailormoon_heroic_asset","name":"Heroic","group":"normal"},{"id":"mood_ufo_2024_alienship_lsz_asset","name":"In the UFO","group":"normal"},{"id":"mood_fursona_2025_quadrun_tk_asset","name":"Instinct Run","group":"normal"},{"id":"mood_spice_2022_relaxedfloat_lsz_asset","name":"Just Floatin' Here","group":"normal"},{"id":"mood_summer_2025_cabinbag_lsz_asset","name":"Let's Go On Vacation!","group":"normal"},{"id":"mood_2025_loveclouds_lsz_asset","name":"LoveCloud","group":"normal"},{"id":"mood_valentines_2026_floatingheart_lsz_asset","name":"Me & My Heart","group":"normal"},{"id":"mood_that_2024_moneyrain_lsz_asset","name":"Money Rain","group":"normal"},{"id":"mood_shimm_2024_fireworkswalk_lsz_asset","name":"My Background","group":"normal"},{"id":"mood_blood_2025_demonanim_lsz_asset","name":"Ooze","group":"normal"},{"id":"mood_basic_2024_rainbowflying_lsz_asset","name":"Over the Rainbow","group":"normal"},{"id":"mood_fuzz_2025_pillowanim_lsz_asset","name":"Pillow Float","group":"normal"},{"id":"mood_stranger_2022_float_lsz_asset","name":"Posessed","group":"normal"},{"id":"mood_halloween_2025_redmoon_lsz_asset","name":"Red Moon Float","group":"normal"},{"id":"mood_head_2026_cloudsleep_lsz_asset","name":"Sleep In Clouds","group":"normal"},{"id":"mood_oph_2024_beingsnake_lsz_asset","name":"Slithering Away","group":"normal"},{"id":"mood_flor_2022_slowmo_lsz_asset","name":"Slowmo","group":"normal"},{"id":"mood_xmas_2025_snowball_lsz_asset","name":"Snowball Accident","group":"normal"},{"id":"mood_default_sparkle_2025_lsz_asset","name":"Sparkles Around Me","group":"normal"},{"id":"mood_summer_2026_steringwheelbalance_lsz_asset","name":"Steeringwheel Balance","group":"normal"},{"id":"mood_candy_2022_superspeed_lsz_asset","name":"Superspeed","group":"normal"},{"id":"mood_bday_2025_bigcake_lsz_asset","name":"Surprise!","group":"normal"},{"id":"mood_silly_2024_upsidedownflying_lsz_asset","name":"Upside Down","group":"normal"},{"id":"mood_ruby_2025_diganim_lsz_asset","name":"What's up Doc?","group":"normal"},{"id":"mood_spark_2025_runtreerun_lsz_asset","name":"Why R U Running?","group":"normal"},{"id":"mood_fursona_2025_quadwalk_tk_asset","name":"Wild Walk","group":"normal"},{"id":"mood_2025_xmas_floatingwreath_tk_asset","name":"Wreath Magic","group":"normal"},{"id":"mood_zombiewalk_asset","name":"Zombie","group":"normal"}];const e=al("div",{display:"none",flexDirection:"column",gap:"0",padding:"2px 0 4px",boxSizing:"border-box"});const card=(title,hint)=>{const w=al("div",{position:"relative",margin:"0 0 10px",padding:"11px 12px 12px",background:"linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.09)"),borderRadius:"14px",boxSizing:"border-box",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",overflow:"hidden"});const bar=al("div",{position:"absolute",left:"0",top:"12px",bottom:"12px",width:"2px",borderRadius:"2px",background:"linear-gradient(180deg, "+(Zs.acc||"#a78bfa")+", transparent)",opacity:"0.85",pointerEvents:"none"});w.appendChild(bar);const h=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"700",letterSpacing:".05em",textTransform:"uppercase",color:Zs.txt,marginBottom:hint?"5px":"9px",paddingLeft:"6px"});h.textContent=title,w.appendChild(h);if(hint){const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginBottom:"9px",paddingLeft:"6px"});p.textContent=hint,w.appendChild(p)}return w};const tip=t=>{const n=al("div",{fontFamily:Zs.sans,fontSize:"10px",lineHeight:"1.4",color:Zs.sub,marginTop:"6px"});return n.textContent=t,n};const t=xl(re("gender_btn"),"gender");t.addEventListener("click",Ro);const gCard=card(re("gender"),re("gender_desc"));gCard.appendChild(t),e.appendChild(gCard);const n=wl(si(ei()));n.id=A.mood,n.style.display="none";const o=xl(re("apply"),"mood");o.addEventListener("click",()=>fi());const r=al("div",{marginBottom:"6px"});Pc.moodLockStatus=r;try{ci()}catch{}const preview=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.acc||Zs.txt,fontWeight:"600",marginBottom:"8px",minHeight:"16px"});const syncPrev=()=>{try{const id=Ho(n.value||ei()),m=oi(id);preview.textContent=m?re("mood_selected_prefix")+m.name:re("mood_none_selected")}catch{preview.textContent=re("mood_none_selected")}};syncPrev();try{ci()}catch{}const openLib=xl(re("mood_open_lib"),"mood");openLib.style.width="100%";const a=al("div",{display:"none"});Pc.moodList=a;const mCard=card(re("mood"));mCard.appendChild(preview),mCard.appendChild(r),mCard.appendChild(n);const mRow=al("div",{display:"flex",gap:"8px",width:"100%"});openLib.style.flex="1",o.style.flex="1",mRow.appendChild(openLib),mRow.appendChild(o),mCard.appendChild(mRow),e.appendChild(mCard);let sheet=null;const ensureSheet=()=>{if(sheet)return sheet;sheet=al("div",{position:"absolute",inset:"0",zIndex:"45",display:"none",background:"rgba(6,8,16,.74)",backdropFilter:"blur(7px)",borderRadius:"inherit"});const panel=al("div",{position:"absolute",left:"8px",right:"8px",top:"48px",bottom:"8px",background:Zs.bg||"#12121a",border:"1px solid "+(Zs.bdr||"rgba(255,255,255,.12)"),borderRadius:"14px",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 18px 50px rgba(0,0,0,.55)"});const head=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderBottom:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)")});const ht=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"700",color:Zs.txt});ht.textContent=re("mood_pick");const hx=xl(re("btn_close"),"x");hx.addEventListener("click",()=>sheet.style.display="none"),head.appendChild(ht),head.appendChild(hx);const tabs=al("div",{display:"flex",gap:"6px",padding:"8px 10px 0"});let tab="soft";const bSoft=xl("Soft","spark"),bNorm=xl("Normal","list");const mark=(b,on)=>{b.style.opacity=on?"1":".65",b.style.borderColor=on?(Zs.acc||"#a78bfa"):(Zs.bdrSub||"transparent")};const search=kl("İsimle ara…");search.style.margin="8px 10px";const list=al("div",{flex:"1",overflowY:"auto",padding:"4px 10px 12px",boxSizing:"border-box"});const render=()=>{list.textContent="";const q=String(search.value||"").trim().toLowerCase(),src=tab==="soft"?softMoods:normalMoods,rows=src.filter(m=>!q||m.name.toLowerCase().includes(q)||m.id.toLowerCase().includes(q));if(!rows.length){const empty=al("div",{padding:"18px 8px",textAlign:"center",color:Zs.sub,fontSize:"11px",fontFamily:Zs.sans});return empty.textContent="Sonuç yok",void list.appendChild(empty)}for(const m of rows){const row=al("button",{width:"100%",textAlign:"left",padding:"9px 10px",marginBottom:"5px",background:"rgba(255,255,255,.03)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),borderRadius:"10px",color:Zs.txt,cursor:"pointer",fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",boxSizing:"border-box"});row.type="button",row.textContent=m.name,row.addEventListener("click",()=>{try{let ok=!1;for(const opt of n.options||[])if(opt.value===m.id){ok=!0;break}if(!ok){const opt=document.createElement("option");opt.value=m.id,opt.textContent=m.name,n.appendChild(opt)}n.value=m.id,syncPrev()}catch{}sheet.style.display="none",fi(m.id)}),list.appendChild(row)}};bSoft.addEventListener("click",()=>{tab="soft",mark(bSoft,1),mark(bNorm,0),render()}),bNorm.addEventListener("click",()=>{tab="normal",mark(bSoft,0),mark(bNorm,1),render()}),search.addEventListener("input",render),mark(bSoft,1),mark(bNorm,0),tabs.appendChild(bSoft),tabs.appendChild(bNorm),panel.appendChild(head),panel.appendChild(tabs),panel.appendChild(search),panel.appendChild(list),sheet.appendChild(panel),sheet.addEventListener("click",ev=>{ev.target===sheet&&(sheet.style.display="none")});try{(Cc||e).appendChild(sheet)}catch{e.appendChild(sheet)}return Pc.moodSheetRender=render,sheet};openLib.addEventListener("click",()=>{const sh=ensureSheet();sh.style.display="block";try{Pc.moodSheetRender?.()}catch{}});try{pi()}catch{}const pullIn=kl(re("nick_or_id_ph"));pullIn.style.marginBottom="8px",pullIn.addEventListener("keydown",t=>{"Enter"===t.key&&(t.preventDefault(),Kl(pullIn.value))});const pullBtn=xl(re("mood_pull_btn"),"mood");pullBtn.addEventListener("click",()=>Kl(pullIn.value)),Pc.moodPullInput=pullIn,Pc.moodPullBtn=pullBtn;const pullCard=card(re("mood_others_card"),re("mood_others_hint"));pullCard.appendChild(pullIn),pullCard.appendChild(pullBtn),e.appendChild(pullCard);const lookIn=kl(re("nick_or_id_ph"));lookIn.style.marginBottom="8px",lookIn.addEventListener("keydown",t=>{"Enter"===t.key&&(t.preventDefault(),openProf(lookIn.value))});const lookBtn=xl(re("profile_open_btn"),"user");lookBtn.addEventListener("click",()=>openProf(lookIn.value));const lookCopy=xl(re("profile_copy_id"),"copy");lookCopy.addEventListener("click",Wl);const lookMood=xl(re("mood_apply_other"),"mood");lookMood.addEventListener("click",Vl),lookMood.style.display="none";const lookRow=al("div",{display:"flex",gap:"8px",width:"100%"});lookBtn.style.flex="1",lookCopy.style.flex="1",lookRow.appendChild(lookBtn),lookRow.appendChild(lookCopy);const lookResult=al("div",{display:"none"});Pc.profileLookupInput=lookIn,Pc.profileLookupBtn=lookBtn,Pc.profileLookupCopyBtn=lookCopy,Pc.profileLookupGoRoomBtn=null,Pc.profileLookupMoodBtn=lookMood,Pc.profileLookupResult=lookResult,Pc.teleportNickInput=null,Pc.teleportNickBtn=null,Jl();const lookCard=card(re("profile_info_card"),re("profile_info_hint"));lookCard.appendChild(lookIn),lookCard.appendChild(lookRow),lookCard.appendChild(lookMood),lookCard.appendChild(lookResult),e.appendChild(lookCard);let profSheet=null;const ensureProf=()=>{if(profSheet)return profSheet;return profSheet=al("div",{position:"fixed",top:"16px",width:"340px",maxWidth:"calc(100vw - 24px)",maxHeight:"calc(100vh - 32px)",overflowY:"auto",background:Zs.bg||"#12121a",border:"1px solid "+(Zs.bdr||"rgba(255,255,255,.12)"),borderRadius:"14px",boxShadow:"0 24px 70px rgba(0,0,0,.72)",zIndex:"2147483651",display:"none",padding:"12px",boxSizing:"border-box",fontFamily:Zs.sans}),(j()||document.body).appendChild(profSheet),profSheet};async function fetchProfileSocial(pid){const id=String(pid||"").trim();if(!id||!ce.accessToken)return{friends:[],closeFriends:[],friendCount:0,closeFriendCount:0};try{const compact=v=>String(v||"").trim().toLowerCase().replace(/-/g,"");const dashUuid=v=>{const c=compact(v);return/^[0-9a-f]{32}$/.test(c)?c.slice(0,8)+"-"+c.slice(8,12)+"-"+c.slice(12,16)+"-"+c.slice(16,20)+"-"+c.slice(20):""};const variants=v=>{const raw=String(v||"").trim();if(!raw)return[];const out=new Set([raw,raw.toLowerCase(),compact(raw)]);const d=dashUuid(raw);if(d){out.add(d);out.add(d.toLowerCase())}return[...out]};const looksId=v=>{const t=String(v||"").trim();if(!t)return!0;const c=compact(t);return/^[0-9a-f]{32}$/i.test(c)||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)};const niceName=p=>{if(!p)return"";let n=String(p.name||p.username||p.login||p.loginName||"").trim();if(!n)return"";const pipe=n.lastIndexOf("|");if(pipe>=0)n=n.slice(pipe+1).trim()||n;return looksId(n)?"":n};const auth={authorization:"Bearer "+ce.accessToken,"content-type":"application/json",accept:"application/json","x-msp-game-id":String(x||"")};const gql=async(query,variables,operationName)=>{const body={query,variables};if(operationName)body.operationName=operationName;const n=await cn(k+"/edgerelationships/graphql",{method:"POST",headers:auth,body:JSON.stringify(body)});if(!n.ok)throw new Error("HTTP "+n.status);const o=await n.json();if(o?.errors?.[0]?.message)throw new Error(o.errors[0].message);return o};const labOf=rawLabs=>{const labels=[].concat(rawLabs||[]).map(l=>{if(l==null)return"";if(typeof l==="string")return l;if(typeof l==="object")return String(l.label||l.name||l.value||"");return String(l)}).filter(Boolean);const blob=labels.join(" ").toLowerCase();let relation="friend";if(/heart|sweetheart|soulmate|crush|sevgili|\u2665|\u2764/.test(blob))relation="heart";else if(/star|best|close|favorite|favourite|yak\u0131n|yakin|bff/.test(blob))relation="star";return{labels,relation,blocked:/block|engelle/.test(blob),label:labels[0]||"Friend"}};const byId=new Map();const upsert=(pid,meta)=>{const key=compact(pid)||String(pid);if(!key)return;const prev=byId.get(key)||{profileId:String(pid),label:"Friend",relation:"friend"};if(meta.label)prev.label=meta.label;if(meta.relation&&meta.relation!=="friend")prev.relation=meta.relation;byId.set(key,prev)};const q1="query GetAllRelationships($profileId: String!, $gameId: String!){ relationships(profileId: $profileId) { nodes { profileId labels(gameId: $gameId) } } }";const d1=await gql(q1,{profileId:id,gameId:x},"GetAllRelationships");for(const n of(d1?.data?.relationships?.nodes||[])){const pid=String(n?.profileId||"").trim();if(!pid)continue;const lab=labOf(n?.labels);if(lab.blocked)continue;upsert(pid,{label:lab.label,relation:lab.relation})}const qPage="query GetAllRelationships($profileId: String!, $filter: String!, $page: Int, $pageSize: Int, $gameId: String!){ relationships(profileId: $profileId filter: $filter page: $page pageSize: $pageSize) { nodes { profileId } } }";for(let page=1;page<=50;page++){let batch=[];try{const dp=await gql(qPage,{profileId:id,filter:"Friends",page,pageSize:25,gameId:x},"GetAllRelationships");batch=dp?.data?.relationships?.nodes||[]}catch{break}if(!batch.length)break;for(const n of batch){const pid=String(n?.profileId||"").trim();if(pid)upsert(pid,{label:"Friend",relation:"friend"})}if(batch.length<25)break}const rows=[...byId.values()];const close=rows.filter(r=>r.relation==="heart"||r.relation==="star");const ids=[...new Set(rows.map(r=>r.profileId))];const named={};const levels={};const putNamed=(reqId,p)=>{if(!p)return;for(const k of variants(reqId))named[k]=p;if(p.id)for(const k of variants(p.id))named[k]=p};const putLevel=(reqId,lv)=>{const n=Number(lv);if(!Number.isFinite(n))return;for(const k of variants(reqId))levels[k]=n};const hasName=rid=>variants(rid).some(k=>named[k]&&niceName(named[k]));const pq="query GetProfiles($profileIds: [String!]!, $gameId: String!){ profiles(profileIds: $profileIds){ id name culture membership { lastTierExpiry } } }";const fetchChunk=async req=>{try{const pr=await gql(pq,{profileIds:req,gameId:x},"GetProfiles");const profiles=pr?.data?.profiles||[];for(const p of profiles){if(p&&p.id)putNamed(p.id,p)}return profiles}catch{return[]}};for(let i=0;i<ids.length;i+=20){  const chunk=ids.slice(i,i+20);  await fetchChunk(chunk);  const miss=chunk.filter(rid=>!hasName(rid));  if(miss.length){    const alt=miss.map(rid=>{const c=compact(rid);const d=dashUuid(rid);if(/^[0-9a-f]{32}$/.test(c)&&rid!==c)return c;if(d&&rid!==d)return d;return null}).filter(Boolean);    if(alt.length)await fetchChunk([...new Set(alt)]);  }  await new Promise(r=>setTimeout(r,25));}const miss=ids.filter(rid=>!hasName(rid));for(let i=0;i<miss.length;i+=10){  const batch=miss.slice(i,i+10);  await Promise.all(batch.map(async rid=>{    const tries=[rid,compact(rid),dashUuid(rid)].filter(Boolean);    for(const tryId of [...new Set(tries)]){      try{        const ir=await cn(k+"/profileidentity/v1/profiles/"+encodeURIComponent(tryId),{method:"GET",headers:{authorization:"Bearer "+ce.accessToken,accept:"application/json"}});        if(!ir.ok)continue;        const ij=await ir.json();const idn=Array.isArray(ij)?ij[0]:ij;        const nm=niceName(idn)||(!looksId(idn&&idn.login)?String(idn&&idn.login||"").trim():"")||(!looksId(idn&&idn.name)?String(idn&&idn.name||"").trim():"");        if(nm){putNamed(rid,{id:rid,name:nm,login:idn&&idn.login});return}      }catch{}    }  }));  await new Promise(r=>setTimeout(r,35));}for(let i=0;i<ids.length;i+=40){  const chunk=ids.slice(i,i+40);  const payload=chunk.map(pid=>({gameId:x,profileId:(()=>{const c=compact(pid);return/^[0-9a-f]{32}$/.test(c)?c:pid})()}));  try{    const er=await cn(k+"/experience/v1/experience/batch",{method:"POST",headers:auth,body:JSON.stringify(payload)});    if(er.ok){const rows=await er.json();if(Array.isArray(rows))for(const row of rows){const exp=row&&row.experience&&typeof row.experience==="object"?row.experience:row;const pid=String(exp&&exp.profileId||row&&row.profileId||"").trim();const lv=Number(exp&&exp.level);if(pid&&Number.isFinite(lv))putLevel(pid,lv)}}  }catch{}  await new Promise(r=>setTimeout(r,25));}const mapRow=r=>{  let p=null;for(const k of variants(r.profileId)){if(named[k]){p=named[k];break}}  let lv=null;for(const k of variants(r.profileId)){if(levels[k]!=null){lv=levels[k];break}}  const nm=niceName(p);  return{id:r.profileId,profileId:r.profileId,name:nm||"\u0130simsiz",level:Number.isFinite(lv)?lv:1,label:r.label,relation:r.relation,vip:!!(p&&p.membership&&p.membership.lastTierExpiry&&new Date(p.membership.lastTierExpiry)>new Date())}};return{friends:rows.map(mapRow),closeFriends:close.map(mapRow),friendCount:rows.length,closeFriendCount:close.length}}catch(e){return{friends:[],closeFriends:[],friendCount:0,closeFriendCount:0}}}function fmtProfVal(v){if(v==null||v==="")return"—";if(typeof v==="object"){if(v.text!=null&&String(v.text).trim())return String(v.text);if(v.Text!=null&&String(v.Text).trim())return String(v.Text);if(v.roomId)return String(v.roomId);return"—"}return String(v)}function fmtMoodName(raw){const v=String(raw||"").trim();if(!v)return"—";try{const id=Ho(v),m=oi(id);if(m?.name)return m.name}catch{}return v.replace(/^mood_/i,"").replace(/_asset$/i,"").replace(/_/g," ").replace(/\s+/g," ").trim()}async function openProf(q){const query=String(q||"").trim();if(!query)return cd(re("nick_or_id_need"),"error");cd(re("profile_loading"),"info");await Nl(query);const sh=ensureProf(),sel=ce.profileLookup.selected;sh.textContent="";sh.style.width="360px";sh.style.maxWidth="calc(100vw - 24px)";sh.style.maxHeight="calc(100vh - 32px)";sh.style.padding="14px 14px 16px";sh.style.borderRadius="16px";sh.style.border="1px solid "+(Zs.bdrSub||"rgba(255,255,255,.1)");sh.style.boxShadow="0 24px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)";sh.style.background="linear-gradient(165deg, rgba(28,28,36,.98), rgba(18,18,24,.98))";const head=al("div",{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",gap:"8px"}),h=al("div",{fontWeight:"700",fontSize:"13px",color:Zs.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:"1"});h.textContent=sel?.name||"Profil";const xbtn=xl(re("btn_close"),"x");xbtn.style.padding="4px 8px";xbtn.style.fontSize="10px";xbtn.addEventListener("click",()=>sh.style.display="none");head.appendChild(h);head.appendChild(xbtn);sh.appendChild(head);if(!sel){const er=al("div",{color:Zs.sub,fontSize:"11px"});er.textContent=ce.profileLookup.errorMsg||re("profile_not_found");sh.appendChild(er)}else{let createdAt="—";try{const ir=await cn(`${k}/profileidentity/v1/profiles/${encodeURIComponent(sel.id)}`,{method:"GET",headers:{authorization:`Bearer ${ce.accessToken}`,accept:"application/json"}});if(ir.ok){const ij=await ir.json(),idn=Array.isArray(ij)?ij[0]:ij;const c0=idn&&(idn.created||idn.createdOn||idn.createdAt);if(c0){const d=new Date(c0);createdAt=Number.isFinite(d.getTime())?d.toLocaleDateString(ie==="tr"?"tr-TR":ie):String(c0).slice(0,10)}}}catch{}const roomTxt=fmtProfVal(sel.room&&sel.room.text!=null?sel.room.text:sel.room),statusTxt=fmtProfVal(sel.wayd&&sel.wayd.text!=null?sel.wayd.text:(sel.wayd||sel.status)),moodTxt=fmtMoodName(sel.mood||(sel.attrs&&sel.attrs.mood)),lvl=sel.expInfo&&sel.expInfo.level!=null?sel.expInfo.level:(sel.level!=null?sel.level:(sel.exp&&sel.exp.level!=null?sel.exp.level:"—")),vipObj=sel.vip&&typeof sel.vip==="object"?sel.vip:null,vip=vipObj?(vipObj.active?re("vip_active_left",{text:(vipObj.text||"?").replace(/gun/gi,re("day_unit"))}):(vipObj.text||re("vip_no"))):(sel.isVip?re("vip_yes"):re("vip_no")),gender=(sel.attrs&&sel.attrs.gender)||sel.gender||"—",last=sel.lastLogin?String(sel.lastLogin).slice(0,19).replace("T"," "):"—",rows=[[re("prof_row_level"),lvl],["VIP",vip],[re("prof_row_created"),createdAt],[re("prof_row_gender"),gender],[re("prof_row_room"),roomTxt],[re("prof_row_status"),statusTxt],[re("prof_row_mood"),moodTxt],[re("prof_row_last"),last],["ID",sel.id||"—"]];const infoCard=al("div",{display:"flex",flexDirection:"column",gap:"0",padding:"4px 0 2px",marginBottom:"8px",borderRadius:"12px",background:"linear-gradient(165deg,rgba(255,255,255,.04),rgba(255,255,255,.015))",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),overflow:"hidden"});for(let ri=0;ri<rows.length;ri++){const pair=rows[ri],k=pair[0],v=pair[1];const line=al("div",{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px",padding:"9px 12px",borderBottom:ri<rows.length-1?"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.06)"):"none",fontSize:"11px"});const lk=al("span",{color:Zs.sub,flexShrink:"0",fontSize:"10px",fontWeight:"600",letterSpacing:".03em",textTransform:"uppercase"});const lv=al("span",{color:Zs.txt,fontWeight:"600",textAlign:"right",wordBreak:"break-word",lineHeight:"1.35"});lk.textContent=k;lv.textContent=String(v);line.appendChild(lk);line.appendChild(lv);infoCard.appendChild(line)}sh.appendChild(infoCard);const moodVal=String(sel.mood||(sel.attrs&&sel.attrs.mood)||"").trim();if(moodVal){const apply=xl(re("mood_apply_this"),"mood");apply.style.marginTop="10px";apply.style.width="100%";apply.style.padding="6px 8px";apply.style.fontSize="10.5px";apply.addEventListener("click",()=>fi(moodVal,{skipLibrary:!0,permanent:!0}));sh.appendChild(apply)}const socialBox=al("div",{marginTop:"12px",display:"flex",flexDirection:"column",gap:"8px"});sh.appendChild(socialBox);const socialLoading=al("div",{fontSize:"10px",fontWeight:"700",letterSpacing:".04em",textTransform:"uppercase",color:Zs.sub});socialLoading.textContent=re("social_loading");socialBox.appendChild(socialLoading);fetchProfileSocial(sel.id).then(soc=>{socialBox.textContent="";const mkAcc=(title,count,list)=>{const wrap=al("div",{borderRadius:"12px",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),background:"linear-gradient(165deg,rgba(255,255,255,.04),rgba(255,255,255,.012))",overflow:"hidden"});const head=al("button",{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 12px",margin:"0",border:"none",background:"transparent",cursor:"pointer",outline:"none",textAlign:"left"});const left=al("div",{display:"flex",flexDirection:"column",gap:"2px",minWidth:"0"});const t=al("div",{fontSize:"11px",fontWeight:"700",color:Zs.txt});t.textContent=title;const meta=al("div",{fontSize:"10px",color:Zs.sub,fontFamily:Zs.mono});meta.textContent=re("people_count",{n:count});left.appendChild(t);left.appendChild(meta);const chev=al("span",{color:Zs.sub,fontSize:"12px",flexShrink:"0"});chev.textContent=">";head.appendChild(left);head.appendChild(chev);const body=al("div",{display:"none",padding:"0 8px 10px",maxHeight:"260px",overflowY:"auto"});let open=false;head.addEventListener("click",()=>{open=!open;body.style.display=open?"flex":"none";body.style.flexDirection="column";body.style.gap="4px";chev.textContent=open?"v":">"});if(!list.length){const empty=al("div",{fontSize:"10.5px",color:Zs.sub,padding:"6px 4px"});empty.textContent=re("list_empty");body.appendChild(empty)}else{for(const f of list){const row=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"7px 9px",borderRadius:"10px",background:"rgba(255,255,255,.03)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.06)")});const L=al("div",{minWidth:"0",flex:"1"});const nm=al("div",{color:f.vip?"#f59e0b":Zs.txt,fontWeight:"700",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"10.5px"});nm.textContent=f.name||re("unnamed");const md=al("div",{color:Zs.sub,fontSize:"9.5px",fontFamily:Zs.mono});md.textContent="Lv "+(f.level||1)+(f.vip?" · VIP":"");L.appendChild(nm);L.appendChild(md);const tag=al("span",{color:Zs.sub,fontSize:"9px",fontWeight:"600",textTransform:"uppercase"});tag.textContent=f.relation==="heart"?re("rel_heart"):f.relation==="star"?re("rel_star"):re("rel_friend");row.appendChild(L);row.appendChild(tag);body.appendChild(row)}}wrap.appendChild(head);wrap.appendChild(body);return wrap};socialBox.appendChild(mkAcc(re("social_close_friends"),soc.closeFriendCount||(soc.closeFriends||[]).length,soc.closeFriends||[]));socialBox.appendChild(mkAcc(re("social_friends"),soc.friendCount||(soc.friends||[]).length,soc.friends||[]))}).catch(()=>{socialLoading.textContent=re("social_fail")});}try{const p=Cc&&Cc.getBoundingClientRect?Cc.getBoundingClientRect():null;if(p){let left=p.left-350;if(left<8)left=Math.min(innerWidth-350,p.right+10);sh.style.left=left+"px";sh.style.top=Math.max(8,p.top)+"px"}else{sh.style.right="16px";sh.style.top="16px"}}catch{}sh.style.display="block"}



const s=kl(re("status_ph"));s.id=A.status,s.maxLength=100;try{const e="function"==typeof q?q(_.statusDraft):null;e&&(s.value=String(e))}catch{}s.addEventListener("change",()=>{try{H(_.statusDraft,s.value||"")}catch{}}),s.addEventListener("blur",()=>{try{H(_.statusDraft,s.value||"")}catch{}});const l=xl(re("status_update"),"status");l.addEventListener("click",mi);const c=xl(re("status_restore"),"restore");c.addEventListener("click",Ei);const d=al("div",{display:"flex",gap:"6px",width:"100%"});l.style.flex="1 1 0",l.style.minWidth="0",l.style.padding="6px 8px",l.style.fontSize="10.5px",l.style.minHeight="30px",c.style.flex="1 1 0",c.style.minWidth="0",c.style.padding="6px 8px",c.style.fontSize="10.5px",c.style.minHeight="30px",d.appendChild(l),d.appendChild(c);const statusCard=card(re("status_card"));const statusHints=al("div",{paddingLeft:"6px",marginBottom:"9px"});const statusH1=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub});statusH1.textContent=re("status_card_hint");const statusH2=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginTop:"3px"});statusH2.textContent="";statusH2.style.display="none";statusHints.appendChild(statusH1),statusHints.appendChild(statusH2),statusCard.appendChild(statusHints);s.style.marginBottom="8px",statusCard.appendChild(s),statusCard.appendChild(d),e.appendChild(statusCard);const mediaCard=card(re("avatar_title"),re("avatar_reset_warn"));mediaCard.style.padding="10px 11px 10px";const p=al("div",{flex:"1",minWidth:"0",boxSizing:"border-box"});let u=null;const f=Tl(e=>{u=e,h()}),m={value:"256"};try{f.style.minHeight="58px";f.style.padding="8px"}catch{}const g=xl(re("avatar_upload"),"upload");g.style.padding="5px 8px",g.style.fontSize="10px",g.style.minHeight="28px";function h(){!ce.accessToken?g.setDisabled(!0):g.setDisabled(!u)}g.style.marginTop="6px",g.addEventListener("click",()=>{if(!u)return void cd(re("need_image"),"error");const e=256;!async function(e,t){Fo()&&await _o("avatar",async()=>{const n=Number(t?.size)||256,o=Ys(n,Hs);cd(`Profil fotografi isleniyor (${n>Hs?`${n}\u2192${o}px`:`${o}px`})\u2026`,"info");const i=[{size:o,maxBytes:Gs},{size:Math.min(o,512),maxBytes:Gs},{size:Math.min(o,384),maxBytes:48e3},{size:256,maxBytes:4e4},{size:192,maxBytes:32e3},{size:128,maxBytes:24e3}];let r=null;for(const t of i)try{const n=await Rn(e,{size:t.size,maxBytes:t.maxBytes,fit:"cover",hardCap:Hs});if(!n?.length)throw new Error("PNG uretilemedi");if(n.length>t.maxBytes+2048){r=new Error(`PNG hala buyuk (${n.length}B > ${t.maxBytes}B)`);continue}const o=qs(n);await dn(.35,.7);const i={id:"SetAvatarWithInventoryIds-F0A797E3E4F824F5EBB25AC691E33140",variables:{UpdateAvatarInput:{inventoryItemIds:[],snapshots:[{type:"FACE",data:o},{type:"FULL",data:o}]}}},a=await po("/federationgateway/graphql",i);if(a?.errors?.length){r=new Error(String(a.errors[0]?.message||a.errors[0]||"GraphQL hata"));continue}if(!a?.data?.profileInventory?.updateAvatar?.success){const e=a?.data?.profileInventory?.updateAvatar;r=new Error(e?.message||e?.error||"Sunucu avatar guncellemesini reddetti");continue}return cd(`Profil fotografi guncellendi (${t.size}px, ~${Math.round(n.length/1024)}KB)`,"success"),Pc.avatarDropzone?._reset(),void(Pc.syncAvatarBtn&&Pc.syncAvatarBtn())}catch(e){r=e}throw r||new Error("Profil fotografi yuklenemedi")}).catch(e=>cd(Qs(e,"Profil foto"),"error"))}(u,{size:e})}),p.appendChild(f),p.appendChild(g);p.style.width="100%";mediaCard.appendChild(p);e.appendChild(mediaCard);Pc.avatarSizeSel=m,Pc.roomImgBtn=null,Pc.roomImgDropzone=null,Pc.syncRoomImgBtn=null,Pc.roomSizeSel=null,Pc.gBtn=t,Pc.mBtn=o,Pc.roomBtn=null,Pc.sBtn=l,Pc.rBtn=c,Pc.avatarBtn=g,Pc.avatarDropzone=f,Pc.syncAvatarBtn=h;return e}function jc(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 4px"});const card=(title,hint)=>{const w=al("div",{position:"relative",margin:"0 0 10px",padding:"11px 12px 12px",background:"linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.09)"),borderRadius:"14px",boxSizing:"border-box",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",overflow:"hidden"});const bar=al("div",{position:"absolute",left:"0",top:"12px",bottom:"12px",width:"2px",borderRadius:"2px",background:"linear-gradient(180deg, "+(Zs.acc||"#a78bfa")+", transparent)",opacity:"0.85",pointerEvents:"none"});w.appendChild(bar);const h=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"700",letterSpacing:".05em",textTransform:"uppercase",color:Zs.txt,marginBottom:hint?"5px":"9px",paddingLeft:"6px"});h.textContent=title,w.appendChild(h);if(hint){const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginBottom:"9px",paddingLeft:"6px"});p.textContent=hint,w.appendChild(p)}return w};const qCard=card(re("daily_quests"),re("oto_quests_hint"));const qBadges=al("div",{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"8px",paddingLeft:"6px",minHeight:"22px"});const mkBadge=(label,color)=>{const b=al("span",{display:"inline-flex",alignItems:"center",padding:"2px 7px",borderRadius:"999px",fontFamily:Zs.mono,fontSize:"9.5px",fontWeight:"700",color:color,background:"rgba(255,255,255,.04)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)")});b.textContent=label;return b};const syncQuestBadges=()=>{const q=ce.ops.quests||{};qBadges.textContent="";qBadges.appendChild(mkBadge(re("oto_badge_purple",{n:q.chestsNormal||0}),"#c084fc"));qBadges.appendChild(mkBadge(re("oto_badge_gold",{n:q.chestsVip||0}),"#fbbf24"));qBadges.appendChild(mkBadge(re("oto_badge_pet",{n:q.pets||0}),"#34d399"));qBadges.appendChild(mkBadge(re("oto_badge_quest",{n:q.questsDone||0}),Zs.acc||"#a78bfa"))};Pc.syncQuestBadges=syncQuestBadges;syncQuestBadges();const qBtn=xl(re("quests_run"),"quests");qBtn.style.width="100%";qBtn.style.padding="7px 10px";qBtn.style.fontSize="11px";qBtn.addEventListener("click",()=>{Ri();setTimeout(()=>{try{Pc.syncQuestBadges?.()}catch{}},1200)});qCard.appendChild(qBadges),qCard.appendChild(qBtn),e.appendChild(qCard);Pc.qBtn=qBtn;Pc.qBadge=qBadges;const eCard=card(re("oto_event_title"),re("oto_event_idle_hint"));const eWait=al("span",{display:"inline-flex",alignItems:"center",justifyContent:"flex-start",fontFamily:Zs.sans,fontSize:"10px",fontWeight:"800",letterSpacing:".1em",textTransform:"uppercase",padding:"8px 14px",borderRadius:"999px",color:"#fff7ed",background:"linear-gradient(135deg,rgba(245,158,11,.6),rgba(239,68,68,.48))",border:"1px solid rgba(251,191,36,.6)",boxShadow:"0 0 16px rgba(245,158,11,.5), 0 0 32px rgba(239,68,68,.22)",animation:"ax-pulse 1.6s ease-in-out infinite",whiteSpace:"nowrap"});eWait.textContent=re("event_waiting");const eRow=al("div",{display:"flex",alignItems:"center",justifyContent:"flex-start",width:"100%"});eRow.appendChild(eWait);eCard.appendChild(eRow),e.appendChild(eCard);Pc.cBtn=null;Pc.cBadge=null;Pc.cBar=null;const mCard=card(re("unread_title"),re("unread_desc"));const mBtn=xl(re("unread_btn"),"message");mBtn.style.width="100%";mBtn.style.padding="7px 10px";mBtn.style.fontSize="11px";mBtn.addEventListener("click",Qi);mCard.appendChild(mBtn),e.appendChild(mCard);Pc.rmBtn=mBtn;Pc.msgBanner=null;const frCard=card(re("oto_friends_req_title"),re("oto_friends_req_hint"));const frRow=al("div",{display:"flex",gap:"6px",width:"100%"});const afBtn=xl(re("accept_gear"),"accept");afBtn.style.flex="1";afBtn.style.padding="6px 8px";afBtn.style.fontSize="10.5px";afBtn.style.minHeight="30px";afBtn.addEventListener("click",qi);const rfBtn=xl(re("reject_short"),"reject","danger");rfBtn.style.flex="1";rfBtn.style.padding="6px 8px";rfBtn.style.fontSize="10.5px";rfBtn.style.minHeight="30px";rfBtn.addEventListener("click",Hi);frRow.appendChild(afBtn),frRow.appendChild(rfBtn),frCard.appendChild(frRow),e.appendChild(frCard);Pc.afBtn=afBtn;Pc.rfBtn=rfBtn;const clCard=card(re("oto_friends_clean_title"),re("oto_friends_clean_hint"));const lvl=wl([["5",re("low_lvl_opt",{n:5})],["15",re("low_lvl_opt",{n:15})]]);lvl.value="5";lvl.style.marginBottom="8px";const dfBtn=xl(re("low_lvl_btn"),"reject","danger");dfBtn.style.width="100%";dfBtn.style.padding="6px 8px";dfBtn.style.fontSize="10.5px";dfBtn.style.minHeight="30px";dfBtn.style.marginBottom="6px";dfBtn.addEventListener("click",()=>{const lv=parseInt(lvl.value,10);Number.isFinite(lv)&&async function(thr){Fo()&&await _o("deleteFriendsLevel",async()=>{cd(re("oto_checking_friends"),"info");await pn("deleteFriendsLevel",.8,1.4);const t=await Wi();if(!t.length)return void cd("Arkadaş yok","info");const n=await Gi(t),o=[];for(const id of t){const lv=n.get(id);"number"==typeof lv&&lv<thr&&o.push(id)}if(!o.length)return void cd(re("oto_none_below_level",{n:thr}),"info");cd(re("oto_deleting_people",{n:o.length}),"info");let i=0;for(const id of o)await pn("deleteFriendsLevel",.9,1.6),await Ki(id)&&i++;cd(re("oto_friends_deleted",{n:i}),"success")}).catch(()=>cd(re("oto_delete_failed"),"error"))}(lv)});const dvBtn=xl(re("no_vip_btn"),"reject","danger");dvBtn.style.width="100%";dvBtn.style.padding="6px 8px";dvBtn.style.fontSize="10.5px";dvBtn.style.minHeight="30px";dvBtn.style.marginBottom="6px";dvBtn.addEventListener("click",Ji);const daBtn=xl(re("oto_delete_all_friends"),"reject","danger");daBtn.style.width="100%";daBtn.style.padding="6px 8px";daBtn.style.fontSize="10.5px";daBtn.style.minHeight="30px";daBtn.addEventListener("click",deleteAllFriends);clCard.appendChild(lvl),clCard.appendChild(dfBtn),clCard.appendChild(dvBtn),clCard.appendChild(daBtn),e.appendChild(clCard);Pc.dfBtn=dfBtn;Pc.dvBtn=dvBtn;Pc.friendsListBtn=null;return e}function spamPane(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 6px"});

const head=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".06em",textTransform:"uppercase",color:Zs.txt,marginBottom:"10px",paddingLeft:"2px"});head.textContent=re("spam_title");e.appendChild(head);



e.appendChild(function(){const e=al("div",{position:"relative",padding:"14px 14px 12px",marginBottom:"12px",borderRadius:"18px",border:"1px solid rgba(167,139,250,.28)",background:"radial-gradient(ellipse at 12% 0%, rgba(167,139,250,.22), transparent 55%), radial-gradient(ellipse at 90% 20%, rgba(248,113,113,.12), transparent 50%), linear-gradient(165deg,rgba(28,28,36,.98),rgba(12,12,18,.99))",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 0 0 1px rgba(167,139,250,.08) inset, 0 16px 40px rgba(0,0,0,.35)",overflow:"hidden"});

const orb=al("div",{position:"absolute",width:"160px",height:"160px",borderRadius:"50%",background:"rgba(167,139,250,.18)",filter:"blur(40px)",top:"-60px",right:"-40px",pointerEvents:"none"});e.appendChild(orb);

const edge=al("div",{position:"absolute",left:"0",top:"0",bottom:"0",width:"3px",background:"linear-gradient(180deg,#c4b5fd,#a78bfa,#f87171)",pointerEvents:"none"});e.appendChild(edge);

const t=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px",position:"relative",zIndex:"1"});

const n=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:".1em",textTransform:"uppercase",color:"#e9d5ff"});n.textContent=re("spam_rate");

const pulse=al("div",{width:"8px",height:"8px",borderRadius:"50%",background:"#a78bfa",boxShadow:"0 0 12px #a78bfa",animation:"ax-pulse 1.4s ease-in-out infinite"});

t.appendChild(n);t.appendChild(pulse);

const track=al("div",{height:"18px",borderRadius:"999px",background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.12)",overflow:"hidden",position:"relative",zIndex:"1",boxShadow:"inset 0 2px 8px rgba(0,0,0,.65), 0 0 0 1px rgba(167,139,250,.12)"});

const r=al("div",{height:"100%",width:"0%",borderRadius:"999px",background:"linear-gradient(90deg,#4ade80 0%,#a78bfa 55%,#f87171 100%)",transition:"width .28s cubic-bezier(.16,1,.3,1)",boxShadow:"0 0 22px rgba(167,139,250,.65), inset 0 1px 0 rgba(255,255,255,.25)"});track.appendChild(r);

const needle=al("div",{position:"absolute",top:"-3px",width:"4px",height:"24px",borderRadius:"3px",background:"linear-gradient(180deg,#fff,#e9d5ff)",boxShadow:"0 0 12px rgba(255,255,255,.85)",left:"0%",transition:"left .28s cubic-bezier(.16,1,.3,1)",zIndex:"3",pointerEvents:"none"});track.appendChild(needle);Pc.spamMeterNeedle=needle;

const ticks=al("div",{display:"flex",justifyContent:"space-between",marginTop:"7px",position:"relative",zIndex:"1"});

for(const lab of[re("spam_tick_low"),re("spam_tick_mid"),re("spam_tick_high"),re("spam_tick_crit")]){const x=al("span",{fontFamily:Zs.mono,fontSize:"8px",color:Zs.muted,letterSpacing:".06em",textTransform:"uppercase"});x.textContent=lab;ticks.appendChild(x)}

const a=al("div",{marginTop:"9px",fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.sub,lineHeight:"1.45",position:"relative",zIndex:"1",padding:"8px 10px",borderRadius:"12px",background:"rgba(0,0,0,.28)",border:"1px solid rgba(255,255,255,.06)"});

a.textContent="";a.style.display="none";

const o=al("div",{display:"none"});

e.appendChild(t);e.appendChild(track);e.appendChild(ticks);e.appendChild(a);

Pc.spamMeterBar=r;Pc.spamMeterRate=o;Pc.spamMeterSub=a;Pc.spamMeterWrap=e;return e}());



e.appendChild(function(){const e=kr();

const wrap=al("div",{position:"relative",padding:"13px 12px 12px",marginBottom:"10px",borderRadius:"18px",background:"radial-gradient(ellipse at 8% 0%, rgba(167,139,250,.14), transparent 50%), linear-gradient(165deg,rgba(255,255,255,.05),rgba(14,14,20,.98))",border:"1px solid rgba(167,139,250,.22)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 14px 34px rgba(0,0,0,.28)",overflow:"hidden"});

const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,"+(Zs.acc||"#a78bfa")+", transparent)",pointerEvents:"none"});wrap.appendChild(bar);

const{row:t,badge:n}=Il(re("spam_dm_block"),null);n.style.display="none";n.textContent="";t.style.marginBottom="4px";t.style.position="relative";t.style.zIndex="1";const dmHint=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.5",color:Zs.sub,marginBottom:"10px",paddingLeft:"2px",position:"relative",zIndex:"1"});dmHint.textContent=re("spam_dm_hint");



const styleSel=(el)=>{el.style.width="100%";el.style.padding="9px 10px";el.style.background="rgba(0,0,0,.28)";el.style.border="1px solid rgba(167,139,250,.22)";el.style.borderRadius="11px";el.style.color=Zs.txt;el.style.fontFamily=Zs.sans;el.style.fontSize="11px";el.style.fontWeight="600";el.style.outline="none";el.style.cursor="pointer";el.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.04)";el.style.marginBottom="0";el.addEventListener("focus",()=>{el.style.borderColor=Zs.accBdr||"rgba(167,139,250,.5)";el.style.boxShadow="0 0 0 3px rgba(167,139,250,.15)"});el.addEventListener("blur",()=>{el.style.borderColor="rgba(167,139,250,.22)";el.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.04)"})};



const o=wl([["normal",re("spam_mode_normal")],["agresif",re("spam_mode_agresif")],["max",re("spam_mode_max")]]);o.value=String(e.mode||"normal");o.addEventListener("change",()=>{ta();const e=kr();if(Pc.dmSpamWorkerSel&&!e.lockdown){const t=String(e.workerCount||6);[...Pc.dmSpamWorkerSel.options].some(e=>e.value===t)&&(Pc.dmSpamWorkerSel.value=t)}if(Pc.dmSpamBatchSel&&!e.lockdown){const t=String(e.batchMs||1e3);if([...Pc.dmSpamBatchSel.options].some(e=>e.value===t))Pc.dmSpamBatchSel.value=t;else{const t=[...Pc.dmSpamBatchSel.options].map(e=>parseInt(e.value,10)).sort((e,t)=>e-t),n=e.batchMs||1e3;let o=t[0];for(const e of t)Math.abs(e-n)<Math.abs(o-n)&&(o=e);Pc.dmSpamBatchSel.value=String(o),e.batchMs=o}}na(),oa(),Kr(),Zr();const t=e.mode;"max"===t?cd(re("spam_mode_max_on"),"info"):"agresif"===t&&cd(re("spam_mode_aggr_on"),"info")});

const i=wl([["1","Lvl ≤1"],["2","Lvl ≤2"],["5","Lvl ≤5"],["10","Lvl ≤10"],["15","Lvl ≤15"],["20","Lvl ≤20"],["30","Lvl ≤30"]]);i.value=String(e.levelThreshold||5);i.addEventListener("change",()=>{ta(),Zr()});

const r=wl([["6","6 worker"],["20","20 worker"],["50","50 worker"],["100","100 worker"],["150","150 worker"],["200","200 worker"],["250","250 worker"],["300","300 worker"]]);r.value=String(Mr(e.workerCount||6));[...r.options].some(e=>e.value===r.value)||(r.value="300");r.addEventListener("change",()=>{ta(),na(),Zr()});

const a=wl([["25","25 ms"],["50","50 ms"],["100","0.1 sn"],["250","0.25 sn"],["500","0.5 sn"],["1000","1 sn"],["2000","2 sn"]]);a.value=String(e.batchMs||1e3);a.addEventListener("change",()=>{ta(),oa(),Zr()});

const sSel=wl([["5","5 DM / 10sn"],["12","12 DM / 10sn"],["20","20 DM / 10sn"],["30","30 DM / 10sn"],["50","50 DM / 10sn"],["100","100 DM / 10sn"],["200","200 DM / 10sn"],["500","500 DM / 10sn"]]);sSel.value=String(Math.min(hr,Math.max(3,e.floodThreshold||8)));[...sSel.options].some(e=>e.value===sSel.value)||(sSel.value="30");sSel.addEventListener("change",()=>{ta(),Zr()});

const l=wl([["10",re("spam_quiet_opt",{n:10})],["15",re("spam_quiet_opt",{n:15})],["20",re("spam_quiet_opt",{n:20})],["30",re("spam_quiet_opt",{n:30})],["60",re("spam_quiet_opt",{n:60})]]);l.value=String(Math.round((e.quietMs||2e4)/1e3));l.addEventListener("change",()=>{ta(),Zr()});

for(const el of[o,i,r,a,sSel,l])styleSel(el);



const enHizli=xl(re("spam_fastest"),"pkg");enHizli.style.width="100%";enHizli.style.marginBottom="10px";enHizli.style.fontWeight="800";enHizli.style.letterSpacing=".06em";enHizli.style.background="linear-gradient(135deg,rgba(167,139,250,.35),rgba(248,113,113,.18))";enHizli.style.borderColor="rgba(167,139,250,.45)";enHizli.style.boxShadow="0 0 22px rgba(167,139,250,.28), inset 0 1px 0 rgba(255,255,255,.08)";enHizli.style.color="#f5f3ff";enHizli.addEventListener("click",()=>{const st=kr();st.mode="max";st.workerCount=300;st.batchMs=25;st.floodThreshold=5;st.quietMs=1e4;st.blockConc=5e3;st.instantBlock=!0;st.leaveOnBlock=!0;st.gameShield=!0;try{H(_.dmSpamMode,"max");H(_.dmSpamWorker,"300");H(_.dmSpamBatch,"25");H(_.dmSpamFlood,"5");H(_.dmSpamQuiet,"10");H(_.dmSpamInstant,"1");H(_.dmSpamLeave,"1");H(_.dmSpamShield,"1")}catch{}o.value="max";i.value=String(st.levelThreshold||5);r.value="300";a.value="25";sSel.value="5";l.value="10";if(Pc.dmSpamBlockConcSel)Pc.dmSpamBlockConcSel.value="5000";ta();na();oa();Kr();Zr();cd(re("spam_fastest_ok"),"success")});



const gaugeCell=(lab,ctrl)=>{const box=al("div",{position:"relative",padding:"9px 9px 8px",borderRadius:"13px",background:"linear-gradient(155deg,rgba(167,139,250,.14) 0%,rgba(0,0,0,.32) 55%,rgba(14,14,20,.9) 100%)",border:"1px solid rgba(167,139,250,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 8px 18px rgba(0,0,0,.22)",overflow:"hidden",boxSizing:"border-box"});const g=al("div",{position:"absolute",width:"70px",height:"70px",borderRadius:"50%",background:"rgba(167,139,250,.2)",filter:"blur(22px)",top:"-28px",right:"-18px",pointerEvents:"none"});box.appendChild(g);const tip=al("div",{position:"absolute",left:"0",top:"8px",bottom:"8px",width:"2px",borderRadius:"2px",background:"linear-gradient(180deg,#c4b5fd,#a78bfa)",pointerEvents:"none"});box.appendChild(tip);const labEl=Da(lab);labEl.style.paddingLeft="6px";labEl.style.position="relative";labEl.style.zIndex="1";ctrl.style.position="relative";ctrl.style.zIndex="1";box.appendChild(labEl);box.appendChild(ctrl);return box};

const c=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"});c.appendChild(gaugeCell(re("spam_label_mod"),o));c.appendChild(gaugeCell(re("spam_label_level"),i));

const u=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"});u.appendChild(gaugeCell(re("spam_label_worker"),r));u.appendChild(gaugeCell(re("spam_label_batch"),a));

const g=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"});g.appendChild(gaugeCell(re("spam_label_flood"),sSel));g.appendChild(gaugeCell(re("spam_label_quiet"),l));

const b=al("div",{display:"grid",gridTemplateColumns:"1fr",gap:"8px",marginBottom:"10px"});const k=al("div");k.dataset.dmSpamConcMount="1";b.appendChild(gaugeCell(re("spam_label_block"),k));



const hepsiAktif=xl(re("spam_enable_all"),"pkg");hepsiAktif.style.width="100%";hepsiAktif.style.marginBottom="8px";hepsiAktif.style.fontWeight="800";hepsiAktif.style.letterSpacing=".04em";hepsiAktif.style.background="linear-gradient(135deg,rgba(74,222,128,.22),rgba(167,139,250,.18))";hepsiAktif.style.borderColor="rgba(74,222,128,.4)";hepsiAktif.style.color="#bbf7d0";hepsiAktif.addEventListener("click",()=>{const st=kr();st.enabled=!0;st.instantBlock=!0;st.leaveOnBlock=!0;st.gameShield=!0;try{H(_.dmSpamOn,"1");H(_.dmSpamInstant,"1");H(_.dmSpamLeave,"1");H(_.dmSpamShield,"1")}catch{}try{ca(!0)}catch{st.enabled=!0}try{Pc.dmSpamAutoToggle&&Pc.dmSpamAutoToggle._setChecked&&Pc.dmSpamAutoToggle._setChecked(!0)}catch{}try{Pc.dmSpamInstantToggle&&Pc.dmSpamInstantToggle._setChecked&&Pc.dmSpamInstantToggle._setChecked(!0)}catch{}try{Pc.dmSpamLeaveToggle&&Pc.dmSpamLeaveToggle._setChecked&&Pc.dmSpamLeaveToggle._setChecked(!0)}catch{}try{Pc.dmSpamShieldToggle&&Pc.dmSpamShieldToggle._setChecked&&Pc.dmSpamShieldToggle._setChecked(!0)}catch{}Zr();cd(re("spam_enable_all_ok"),"success")});

const w=zl(re("spam_auto"),re("spam_auto_desc"),e.enabled,ca);Pc.dmSpamAutoToggle=w;w.style.position="relative";w.style.zIndex="1";

const S=zl(re("spam_instant"),"",!1!==e.instantBlock,e=>{kr().instantBlock=!!e,H(_.dmSpamInstant,e?"1":"0"),Zr()});Pc.dmSpamInstantToggle=S;

const I=zl(re("spam_leave"),"",!1!==e.leaveOnBlock,e=>{kr().leaveOnBlock=!!e,H(_.dmSpamLeave,e?"1":"0"),Zr()});Pc.dmSpamLeaveToggle=I;

const $=zl(re("spam_shield"),"",!1!==e.gameShield,e=>{kr().gameShield=!!e,H(_.dmSpamShield,e?"1":"0"),Zr()});Pc.dmSpamShieldToggle=$;

const z=zl(re("spam_reject_fr"),"",!!e.autoRejectFriends,e=>{const t=kr();t.autoRejectFriends=!!e,H(_.dmSpamRejectFr,e?"1":"0"),t.enabled&&$a(),e&&t.enabled&&za().catch(()=>{}),Zr()});

const T=zl(re("spam_block_fr"),"",!!e.autoBlockFriends,e=>{const t=kr();t.autoBlockFriends=!!e,H(_.dmSpamBlockFr,e?"1":"0"),t.enabled&&Ba(),e&&t.enabled&&Ta().catch(()=>{}),Zr()});

for(const tg of[S,I,$,z,T]){tg.style.borderBottom="none";tg.style.padding="8px 0";tg.style.position="relative";tg.style.zIndex="1"}



const L=al("select",{width:"100%",padding:"9px 10px",background:"rgba(0,0,0,.28)",border:"1px solid rgba(167,139,250,.22)",borderRadius:"11px",color:Zs.txt,fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",outline:"none",cursor:"pointer"});

for(const t of[200,500,1e3,1500,2e3,3e3,5e3]){const n=al("option");n.value=String(t);n.textContent=re("spam_parallel_opt",{n:t});Ar(e.blockConc||or)===t&&(n.selected=!0);L.appendChild(n)}

if(![...L.options].some(e=>e.selected)){const e=[...L.options].find(e=>"2000"===e.value)||L.options[L.options.length-1];e&&(e.selected=!0)}

L.addEventListener("change",()=>{ta(),Zr()});styleSel(L);try{k.appendChild(L)}catch{}



const mkBtn=(label,fn,danger)=>{const b=xl(label,"reject",danger?"danger":undefined);b.style.marginTop="0";b.style.padding="8px 8px";b.style.fontSize="10px";b.style.minHeight="32px";b.style.fontWeight="700";b.style.borderRadius="10px";b.style.letterSpacing=".02em";if(danger){b.style.background="linear-gradient(135deg,rgba(248,113,113,.18),rgba(0,0,0,.2))";b.style.borderColor="rgba(248,113,113,.35)"}else{b.style.background="linear-gradient(135deg,rgba(167,139,250,.16),rgba(0,0,0,.2))";b.style.borderColor="rgba(167,139,250,.3)"}b.addEventListener("click",fn);return b};

const E=mkBtn(re("spam_scan_unread"),La,!0),D=mkBtn(re("spam_block_all"),Pa,!0),j=mkBtn(re("spam_lockdown"),Ma,!0),F=mkBtn(re("spam_reset_stats"),Aa,!1);

const R=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"6px",marginTop:"8px"});R.appendChild(E);R.appendChild(D);

const O=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"8px"});O.appendChild(j);O.appendChild(F);

const U=al("div",{marginTop:"6px",padding:"11px 12px",background:"linear-gradient(165deg,rgba(0,0,0,.38),rgba(20,16,28,.55))",border:"1px solid rgba(167,139,250,.18)",borderRadius:"12px",fontFamily:Zs.mono,fontSize:"10px",color:"#d4d0e0",lineHeight:"1.65",overflowWrap:"anywhere",maxHeight:"120px",overflowY:"auto",letterSpacing:".01em",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04)"});



wrap.appendChild(t);wrap.appendChild(dmHint);wrap.appendChild(enHizli);wrap.appendChild(c);wrap.appendChild(u);wrap.appendChild(g);wrap.appendChild(b);wrap.appendChild(hepsiAktif);wrap.appendChild(w);wrap.appendChild(S);wrap.appendChild(I);wrap.appendChild($);wrap.appendChild(z);wrap.appendChild(T);wrap.appendChild(R);wrap.appendChild(O);wrap.appendChild(U);

Pc.dmSpamGuardBadge=n;Pc.dmSpamGuardBtn=E;Pc.dmSpamAllBtn=D;Pc.dmSpamLockBtn=j;Pc.dmSpamModeSel=o;Pc.dmSpamLevelSel=i;Pc.dmSpamWorkerSel=r;Pc.dmSpamBatchSel=a;Pc.dmSpamFloodSel=sSel;Pc.dmSpamQuietSel=l;Pc.dmSpamBlockConcSel=L;Pc.dmSpamStatus=U;ja();

return wrap}());

return e}function Fc(){const e=al("div",{display:"none"});return e}function _c(){const t=al("div",{display:"none",flexDirection:"column",padding:"2px 0 4px"});const card=(title,hint)=>{const w=al("div",{position:"relative",margin:"0 0 10px",padding:"11px 12px 12px",background:"linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.09)"),borderRadius:"14px",boxSizing:"border-box",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)",overflow:"hidden"});const bar=al("div",{position:"absolute",left:"0",top:"12px",bottom:"12px",width:"2px",borderRadius:"2px",background:"linear-gradient(180deg, "+(Zs.acc||"#a78bfa")+", transparent)",opacity:"0.85",pointerEvents:"none"});w.appendChild(bar);const h=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"700",letterSpacing:".05em",textTransform:"uppercase",color:Zs.txt,marginBottom:hint?"5px":"9px",paddingLeft:"6px"});h.textContent=title,w.appendChild(h);if(hint){const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginBottom:"9px",paddingLeft:"6px"});p.textContent=hint,w.appendChild(p)}return w};const qCard=card(re("starquiz_title"),re("starquiz_hint"));const i=xl(re("quiz_on"),"bot");i.style.width="100%";i.style.padding="7px 10px";i.style.fontSize="11px";i.addEventListener("click",()=>{const e=!ce.quizBot.enabled;!function(e){try{__xbEnsureCatalog()}catch{}if(ce.quizBot.enabled=e,e){ce.quizBot.stats={totalAnswered:0,correct:0,wrong:0,startTime:Date.now()};for(const[,e]of On)e.lastQuestion=null,e.answering=!1;return io(),void cd("Quiz bot aktif — "+Un.size+" socket","success")}const{totalAnswered:t,correct:n}=ce.quizBot.stats;io(),cd(t>0?"Bot kapandı — "+t+" cevap · %"+Math.round(n/t*100)+" isabet":"Quiz bot kapalı","info")}(e),i._lbl.textContent=re(e?"quiz_off":"quiz_on"),i.style.background=e?Zs.errDim:Zs.accDim,i.style.borderColor=e?Zs.errBdr:Zs.accBdr,i.style.color=e?Zs.err:Zs.acc});qCard.appendChild(i),t.appendChild(qCard);Pc.quizToggleBtn=i;Pc.qbBadge=null;io();const sCard=card(re("sign_card_title"),re("sign_card_hint"));const p=xl(re("sign_open"),"autograph");p.style.width="100%";p.style.padding="7px 10px";p.style.fontSize="11px";p.addEventListener("click",()=>{Rs||Us();const e="none"!==Rs.style.display;Rs.style.display=e?"none":"flex";if(!e){try{Rs.style.zIndex="2147483647";(j()||document.body).appendChild(Rs)}catch{}Ns()}p._lbl.textContent=re(e?"sign_open":"sign_close"),p.style.background=e?Zs.accDim:Zs.errDim,p.style.borderColor=e?Zs.accBdr:Zs.errBdr,p.style.color=e?Zs.acc:Zs.err});sCard.appendChild(p),t.appendChild(sCard);Pc.autographerPanel=null,Pc.autographerOpenBtn=p;const botsFooterArt=al("div",{marginTop:"14px",padding:"0",position:"relative",overflow:"hidden",borderRadius:"18px",minHeight:"150px",background:"radial-gradient(ellipse at 30% 20%, rgba(167,139,250,.28), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(56,189,248,.16), transparent 45%), linear-gradient(160deg,rgba(20,16,32,.95),rgba(8,8,14,.98))",border:"1px solid rgba(167,139,250,.25)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.06), 0 16px 40px rgba(0,0,0,.35)"});const grid=al("div",{position:"absolute",inset:"0",opacity:".14",backgroundImage:"linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",backgroundSize:"22px 22px",pointerEvents:"none"});botsFooterArt.appendChild(grid);const orb1=al("div",{position:"absolute",width:"90px",height:"90px",borderRadius:"50%",background:"rgba(167,139,250,.35)",filter:"blur(28px)",top:"-20px",right:"10px",pointerEvents:"none"});botsFooterArt.appendChild(orb1);const orb2=al("div",{position:"absolute",width:"70px",height:"70px",borderRadius:"50%",background:"rgba(56,189,248,.28)",filter:"blur(24px)",bottom:"-10px",left:"20px",pointerEvents:"none"});botsFooterArt.appendChild(orb2);const art=al("div",{position:"relative",zIndex:"1",padding:"22px 16px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px"});const ring=al("div",{width:"64px",height:"64px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(145deg,rgba(167,139,250,.35),rgba(56,189,248,.15))",border:"1px solid rgba(167,139,250,.4)",boxShadow:"0 0 28px rgba(167,139,250,.35), inset 0 1px 0 rgba(255,255,255,.15)"});ring.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ddd6fe" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 15h.01M12 15h.01M16 15h.01"/></svg>';const big=al("div",{fontFamily:Zs.sans,fontSize:"13px",fontWeight:"800",letterSpacing:".16em",textTransform:"uppercase",color:"#e9d5ff"});big.textContent=re("bots_area");const sub=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,lineHeight:"1.55",textAlign:"center",maxWidth:"240px"});sub.textContent=re("bots_area_hint");const chips=al("div",{display:"flex",gap:"6px",flexWrap:"wrap",justifyContent:"center"});for(const lab of[re("bots_chip_quiz"),re("bots_chip_sign"),re("bots_chip_bulk")]){const c=al("span",{fontFamily:Zs.mono,fontSize:"9px",fontWeight:"700",letterSpacing:".06em",textTransform:"uppercase",padding:"4px 9px",borderRadius:"999px",background:"rgba(167,139,250,.12)",border:"1px solid rgba(167,139,250,.28)",color:"#c4b5fd"});c.textContent=lab;chips.appendChild(c)}art.appendChild(ring);art.appendChild(big);art.appendChild(sub);art.appendChild(chips);botsFooterArt.appendChild(art);t.appendChild(botsFooterArt);return t}function homesPane(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 6px"});

const mk=()=>{const w=al("div",{position:"relative",margin:"0 0 11px",padding:"13px 12px 12px",borderRadius:"16px",background:"linear-gradient(165deg,rgba(255,255,255,.05),rgba(18,18,24,.96))",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.1)"),boxShadow:"inset 0 1px 0 rgba(255,255,255,.04), 0 10px 28px rgba(0,0,0,.22)",overflow:"hidden",boxSizing:"border-box"});const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,"+(Zs.acc||"#a78bfa")+", transparent)",pointerEvents:"none",opacity:".9"});w.appendChild(bar);return w};

const r=mk();

const h=al("div",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"800",letterSpacing:".06em",textTransform:"uppercase",color:Zs.txt,marginBottom:"5px",paddingLeft:"8px",position:"relative",zIndex:"1"});h.textContent=re("home_copy_title");

const hint=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.5",color:Zs.sub,marginBottom:"9px",paddingLeft:"8px",position:"relative",zIndex:"1"});hint.textContent=re("home_copy_hint");

r.appendChild(h);r.appendChild(hint);

const sEl=al("div",{display:"none"});Pc.homesCountEl=sEl;

const l=kl(re("homes_ph"));l.style.marginTop="4px";l.style.marginBottom="6px";l.style.position="relative";l.style.zIndex="1";

const c=xl(re("home_copy_apply"),"home");c.style.marginTop="0";c.style.width="100%";c.style.position="relative";c.style.zIndex="1";c.addEventListener("click",()=>{const e=l.value.trim();e?ks(e):cd(re("homes_need_nick"),"error")});

l.addEventListener("keydown",e=>{if("Enter"===e.key){e.preventDefault();const t=l.value.trim();t&&ks(t)}});

r.appendChild(l);r.appendChild(c);

const d={value:"",disabled:!p.length};try{{const e=X();e&&(d.value=e)}}catch{}

const fold=al("div",{marginTop:"12px",position:"relative",zIndex:"1"});

const foldBtn=al("button",{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"10px 12px",borderRadius:"12px",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.1)"),background:"rgba(255,255,255,.03)",color:Zs.txt,cursor:"pointer",outline:"none",fontFamily:Zs.sans});foldBtn.type="button";

const foldTitle=al("span",{fontWeight:"800",fontSize:"11px",letterSpacing:".06em",textTransform:"uppercase"});foldTitle.textContent=re("homes_soft_list");

const foldMeta=al("span",{display:"flex",alignItems:"center",gap:"8px"});

const foldCount=al("span",{fontFamily:Zs.mono,fontSize:"10px",fontWeight:"700",color:Zs.acc,background:Zs.accDim,border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.3)"),borderRadius:"999px",padding:"2px 8px"});foldCount.textContent="0";

const chev=al("span",{color:Zs.sub,transition:"transform .18s"});chev.textContent="▸";

foldMeta.appendChild(foldCount);foldMeta.appendChild(chev);foldBtn.appendChild(foldTitle);foldBtn.appendChild(foldMeta);

const u=al("div",{display:"none",maxHeight:"280px",overflowY:"auto",marginTop:"8px",background:"rgba(255,255,255,0.02)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),borderRadius:"12px",boxSizing:"border-box"});

let open=!1;foldBtn.addEventListener("click",()=>{open=!open;u.style.display=open?"block":"none";chev.style.transform=open?"rotate(90deg)":"none"});

fold.appendChild(foldBtn);fold.appendChild(u);r.appendChild(fold);

const y=xl(re("homes_pull_only"),"home");y.style.marginTop="8px";y.style.position="relative";y.style.zIndex="1";y.addEventListener("click",()=>{const e=l.value.trim();e?ws(e):cd(re("homes_need_pull"),"error")});

const b=xl(re("homes_self_pull"),"homeSelf");b.style.marginTop="6px";b.style.position="relative";b.style.zIndex="1";b.addEventListener("click",()=>{ce.profileId?ws(ce.profileId):cd(re("homes_need_login"),"error")});

const apply=xl(re("homes_apply"),"home");apply.style.marginTop="6px";apply.style.position="relative";apply.style.zIndex="1";apply.addEventListener("click",()=>{const e=d.value;if(e){try{H(_.lastAction,"homes")}catch{}xs(e)}else cd(re("homes_need_pick"),"error")});

r.appendChild(apply);r.appendChild(y);r.appendChild(b);e.appendChild(r);

Pc.homesBtn=apply;Pc.homesSel=d;Pc.homesList=u;Pc.homesHarvestBtn=null;Pc.homesHarvestOneBtn=y;Pc.homesHarvestApplyBtn=c;Pc.homesHarvestInp=l;Pc.homesDownloadBtn=null;Pc.homesClearBtn=null;Pc.homesSelfBtn=b;Pc.homesFoldCount=foldCount;Pc.homesPreviewUpdate=()=>{try{fs()}catch{}};

try{vs()}catch{}try{if(Pc.homesFoldCount)Pc.homesFoldCount.textContent=String((p||[]).filter(x=>x&&x.name&&!__hd().includes(x.name)).length)}catch{}

(()=>{const roomCard=al("div",{position:"relative",margin:"12px 0 11px",padding:"13px 12px 12px",borderRadius:"16px",background:"radial-gradient(ellipse at 12% 0%, rgba(56,189,248,.14), transparent 55%), linear-gradient(165deg,rgba(255,255,255,.05),rgba(14,14,20,.98))",border:"1px solid rgba(56,189,248,.25)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 12px 28px rgba(0,0,0,.25)",overflow:"hidden",boxSizing:"border-box"});const roomBar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#7dd3fc,#0284c7)",pointerEvents:"none"});roomCard.appendChild(roomBar);const y=al("div",{width:"100%",minWidth:"0",boxSizing:"border-box",position:"relative",zIndex:"1"});const yTitle=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:".04em",textTransform:"uppercase",color:Zs.txt,marginBottom:"6px"});yTitle.textContent=re("room_photo");const yHint=al("div",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.sub,marginBottom:"8px"});yHint.textContent=re("room_photo_hint");y.appendChild(yTitle),y.appendChild(yHint);let b=null;const v=Tl(e=>{b=e,I()}),S={value:"512"};const C=xl(re("upload_btn"),"upload");C.style.padding="6px 8px",C.style.fontSize="10.5px",C.style.minHeight="30px";function I(){!ce.accessToken?C.setDisabled(!0):C.setDisabled(!b)}C.style.marginTop="6px",C.addEventListener("click",()=>{if(!b)return void cd(re("need_image"),"error");const e=512;!async function(e,t){Fo()&&await _o("roomImage",async()=>{const n=Number(t?.size)||1024,o=Ys(n,Ws);cd(`Oda resmi isleniyor (${n>Ws?`${n}\u2192${o}px`:`${o}px`})\u2026`,"info");const i=await Do(),r=i?.additionalData?.DefaultMyHome;if(!r)throw new Error("DefaultMyHome yok \u2014 once oyunda bir ev ac/kaydet");await dn(.3,.6);const a=await so(`/profilegeneratedcontent/v2/profiles/content/${encodeURIComponent(r)}`);if(!a)throw new Error("Ev UGC meta bulunamadi");const s=zo(a,"PgcV1");if(!s)throw new Error("Ev PgcV1 kaynagi yok");const l=await cn(`${w}/${s}`,{method:"GET"});if(!l.ok)throw new Error(`CDN hata HTTP ${l.status}`);const c=new Uint8Array(await l.arrayBuffer()),d=(a.title??a.name??"Room").toString(),p=(a.privacyStatus??a.privacy??"Public").toString(),u=(a.type??"Room").toString(),f=[{size:o,maxBytes:Number(t?.maxBytes)||Vs},{size:Math.min(o,1536),maxBytes:Ks},{size:Math.min(o,1024),maxBytes:Ks},{size:Math.min(o,768),maxBytes:Js},{size:512,maxBytes:Js},{size:384,maxBytes:48e3},{size:256,maxBytes:4e4}];let m=null;for(const t of f)try{const n=await Rn(e,{size:t.size,maxBytes:t.maxBytes,fit:"cover",hardCap:Ws});if(!n?.length){m=new Error("PNG uretilemedi");continue}const o={};u&&(o.Type=u),o.Title=d,o.PrivacyStatus=p,o.DefaultSnapshotType="snapshot",o.ParticipantIds=null,o.Resources=[{data:c,extension:"",resourceType:"PgcV1"},{data:n,extension:"png",resourceType:"snapshot"}];const i=Co(o),a=await Bo(i);await dn(.35,.7);const s=await cn(`${k}/profilegeneratedcontent/v2/profiles/${encodeURIComponent(ce.profileId)}/games/${x}/content/${encodeURIComponent(r)}`,{method:"PUT",headers:{authorization:`Bearer ${ce.accessToken}`,"content-type":"application/bson",signature:a},body:i});if(s.ok)return cd(`Oda resmi guncellendi (~${Math.round(n.length/1024)}KB, ${t.size}px)`,"success"),Pc.roomImgDropzone?._reset(),void(Pc.syncRoomImgBtn&&Pc.syncRoomImgBtn());const l=await s.text().catch(()=>"");m=new Error(`Yukleme HTTP ${s.status}${l?" \u2014 "+l.replace(/\s+/g," ").slice(0,140):""}`)}catch(e){m=e instanceof Error?e:new Error(String(e))}throw m||new Error("Oda resmi yuklenemedi")}).catch(e=>cd(Qs(e,"Oda resmi"),"error"))}(b,{size:e})}),y.appendChild(v),y.appendChild(C);roomCard.appendChild(y);e.appendChild(roomCard);Pc.roomImgBtn=C;Pc.roomImgDropzone=v;Pc.syncRoomImgBtn=I;Pc.roomSizeSel=S;})();return e}function Rc(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 6px"});const mkCard=(opts)=>{const w=al("div",{position:"relative",margin:"0 0 11px",padding:opts.pad||"12px 12px 13px",background:"linear-gradient(165deg,rgba(255,255,255,.05) 0%,rgba(18,18,24,.96) 55%)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.1)"),borderRadius:"16px",boxSizing:"border-box",boxShadow:"inset 0 1px 0 rgba(255,255,255,.04), 0 10px 28px rgba(0,0,0,.22)",overflow:"hidden"});const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg, "+(Zs.acc||"#a78bfa")+", transparent)",opacity:"0.9",pointerEvents:"none"});w.appendChild(bar);if(opts.title){const h=al("div",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"800",letterSpacing:".06em",textTransform:"uppercase",color:Zs.txt,marginBottom:opts.hint?"5px":"0",paddingLeft:"8px",position:"relative",zIndex:"1"});h.textContent=opts.title;w.appendChild(h)}if(opts.hint){const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.5",color:Zs.sub,marginBottom:opts.noBodyPad?"0":"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});p.textContent=opts.hint;w.appendChild(p)}return w};



const vipCard=(()=>{const w=al("div",{position:"relative",margin:"0 0 11px",padding:"13px 12px 14px",borderRadius:"18px",background:"linear-gradient(155deg, rgba(245,158,11,.18) 0%, rgba(28,22,12,.55) 42%, rgba(18,16,22,.95) 100%)",border:"1px solid rgba(245,158,11,.38)",boxShadow:"inset 0 1px 0 rgba(251,191,36,.2), 0 12px 36px rgba(245,158,11,.14), 0 8px 28px rgba(0,0,0,.25)",overflow:"hidden",boxSizing:"border-box"});const glow=al("div",{position:"absolute",width:"150px",height:"150px",borderRadius:"50%",background:"rgba(245,158,11,.28)",filter:"blur(38px)",top:"-50px",right:"-30px",pointerEvents:"none"});w.appendChild(glow);const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#fbbf24,#f59e0b,#b45309)",pointerEvents:"none"});w.appendChild(bar);const h=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:"#fde68a",marginBottom:"5px",paddingLeft:"8px",position:"relative",zIndex:"1"});h.textContent=re("vip_card_title");w.appendChild(h);const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.5",color:Zs.sub,marginBottom:"10px",paddingLeft:"8px",position:"relative",zIndex:"1"});p.textContent=re("vip_card_desc");w.appendChild(p);return w})();const k=xl(re("vip_open_btn"),"pkg");k.style.width="100%";k.style.position="relative";k.style.zIndex="1";k.style.fontWeight="800";k.style.background="linear-gradient(135deg,rgba(251,191,36,.28),rgba(245,158,11,.12))";k.style.borderColor="rgba(251,191,36,.45)";k.style.color="#fde68a";k.style.position="relative";k.style.zIndex="1";k.style.fontWeight="700";k.addEventListener("click",()=>{const open=Ss&&"none"!==Ss.style.display;if(open){Ss.style.display="none";Bs()}else openVipPanel()});vipCard.appendChild(k);e.appendChild(vipCard);Pc.pkgOpenBtn=k;



const chatCard=(()=>{const w=al("div",{position:"relative",margin:"0 0 11px",padding:"13px 12px 12px",borderRadius:"18px",background:"radial-gradient(ellipse at 15% 0%, rgba(56,189,248,.2), transparent 55%), linear-gradient(155deg,rgba(14,40,55,.7),rgba(14,14,20,.96))",border:"1px solid rgba(56,189,248,.32)",boxShadow:"inset 0 1px 0 rgba(125,211,252,.15), 0 12px 32px rgba(0,0,0,.28)",overflow:"hidden",boxSizing:"border-box"});const glow=al("div",{position:"absolute",width:"130px",height:"130px",borderRadius:"50%",background:"rgba(56,189,248,.25)",filter:"blur(34px)",top:"-45px",right:"-25px",pointerEvents:"none"});w.appendChild(glow);const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:"linear-gradient(180deg,#7dd3fc,#0284c7)",pointerEvents:"none"});w.appendChild(bar);const h=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:"#bae6fd",marginBottom:"4px",paddingLeft:"8px",position:"relative",zIndex:"1"});h.textContent=re("chat_bypass")||"Sohbet Filtresi";w.appendChild(h);const p=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",lineHeight:"1.45",color:Zs.sub,marginBottom:"9px",paddingLeft:"8px",position:"relative",zIndex:"1"});p.textContent=re("chat_bypass_desc");w.appendChild(p);return w})();const o=zl(re("chat_bypass"),"",ce.misc.chatFilterBypass,ev=>{ce.misc.chatFilterBypass=ev,H(_.chat,ev?"1":"0"),cd(re("chat_bypass")+" "+re(ev?"toggle_on":"toggle_off"),ev?"success":"info");try{yd?.()}catch{}});o.style.borderBottom="none";o.style.padding="2px 0";o.style.margin="0";o.style.position="relative";o.style.zIndex="1";try{const lab=o.querySelector("div");if(lab){const t=lab.querySelector("div");if(t){t.style.fontSize="11.5px";t.style.fontWeight="800";t.style.letterSpacing=".05em";t.style.textTransform="uppercase";t.style.marginBottom="0"}}}catch{}chatCard.appendChild(o);e.appendChild(chatCard);



const afkCard=mkCard({title:re("afk_title"),hint:re("afk_card_desc")});const t=zl(re("afk_title"),"",__afkState.on,ev=>{__afkSet("on",ev),cd(ev?re("afk_on_toast"):re("afk_off_toast"),ev?"success":"info")});t.style.borderBottom="none";t.style.paddingTop="0";t.style.paddingBottom="8px";t.style.position="relative";t.style.zIndex="1";afkCard.appendChild(t);

const nickNote=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,lineHeight:"1.55",margin:"0 0 8px",padding:"9px 10px",borderRadius:"11px",background:"rgba(255,255,255,.03)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),position:"relative",zIndex:"1"});nickNote.textContent=re("afk_nick_note");afkCard.appendChild(nickNote);

const nickRow=al("div",{display:"flex",alignItems:"center",gap:"8px",margin:"0 0 8px",position:"relative",zIndex:"1"});const nickChip=al("button",{padding:"5px 11px",borderRadius:"999px",border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.3)"),background:Zs.accDim||"rgba(167,139,250,.1)",color:Zs.acc,fontFamily:Zs.mono,fontSize:"11px",fontWeight:"700",cursor:"pointer",outline:"none"});nickChip.type="button";nickChip.textContent="{nick}";nickChip.title="{nick}";nickChip.addEventListener("click",ev=>{ev.stopImmediatePropagation();try{const cur=String(__afkState.msg||"");if(!cur.includes("{nick}")){const next=(cur?cur+" ":"")+"{nick}";__afkSet("msg",next.slice(0,140));n.value=next.slice(0,140)}cd(re("afk_nick_added"),"success")}catch{try{navigator.clipboard.writeText("{nick}")}catch{}cd(re("afk_nick_copied"),"info")}});nickRow.appendChild(nickChip);const nickHint=al("span",{fontSize:"10px",color:Zs.muted});nickHint.textContent=re("afk_nick_click");nickRow.appendChild(nickHint);afkCard.appendChild(nickRow);

const n=kl(re("afk_msg_ph"));n.placeholder=re("afk_msg_ph");n.value=String(__afkState.msg||"");n.addEventListener("input",()=>{__afkSet("msg",n.value.slice(0,140))});n.style.position="relative";n.style.zIndex="1";afkCard.appendChild(n);

const wordsHint=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,lineHeight:"1.5",margin:"10px 0 6px",paddingLeft:"2px",position:"relative",zIndex:"1"});wordsHint.textContent=re("afk_words_hint");afkCard.appendChild(wordsHint);

const words=kl(re("afk_words_ph"));words.placeholder=re("afk_words_ph");words.value=String(__afkState.words||"");words.addEventListener("input",()=>{__afkSet("words",words.value.slice(0,200))});words.style.position="relative";words.style.zIndex="1";afkCard.appendChild(words);

const i=zl(re("afk_dm_title"),re("afk_dm_desc"),__afkState.dm,ev=>{__afkSet("dm",ev),cd(ev?re("afk_dm_on_toast"):re("afk_dm_off_toast"),ev?"success":"info");try{if(Pc.afkDbgEl){Pc.afkDbgEl.textContent="";const on=!!ev;const pill=al("span",{fontWeight:"800",fontSize:"10px",letterSpacing:".06em",padding:"2px 8px",borderRadius:"999px",color:"#081018",background:on?(Zs.ok||"#4ade80"):(Zs.sub||"#6b7280")});pill.textContent=on?re("state_on_u"):re("state_off_u");Pc.afkDbgEl.appendChild(pill);const tx=al("span",{color:Zs.txt,fontWeight:"600",marginLeft:"8px"});tx.textContent=re("afk_dm_title");Pc.afkDbgEl.appendChild(tx)}}catch{}});i.style.paddingTop="10px";i.style.borderBottom="none";i.style.position="relative";i.style.zIndex="1";afkCard.appendChild(i);

const dmN=kl(re("afk_dm_ph"));dmN.placeholder=re("afk_dm_ph");dmN.value=String(__afkState.dmMsg||"");dmN.addEventListener("input",()=>{__afkSet("dmMsg",dmN.value.slice(0,140))});dmN.style.position="relative";dmN.style.zIndex="1";afkCard.appendChild(dmN);

const d=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",marginTop:"8px",padding:"8px 10px",borderRadius:"10px",background:"rgba(255,255,255,.03)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.08)"),display:"flex",alignItems:"center",gap:"8px",position:"relative",zIndex:"1"});const pill=al("span",{fontWeight:"800",fontSize:"10px",letterSpacing:".06em",padding:"2px 8px",borderRadius:"999px",color:"#081018",background:__afkState.dm?(Zs.ok||"#4ade80"):(Zs.sub||"#6b7280")});pill.textContent=__afkState.dm?re("state_on_u"):re("state_off_u");d.appendChild(pill);const dTxt=al("span",{color:Zs.txt,fontWeight:"600"});dTxt.textContent=re("afk_dm_title");d.appendChild(dTxt);Pc.afkDbgEl=d;afkCard.appendChild(d);

const dmListWrap=al("div",{marginTop:"10px",position:"relative",zIndex:"1"});const dmListTitle=al("div",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"700",letterSpacing:".06em",textTransform:"uppercase",color:Zs.sub,marginBottom:"5px"});dmListTitle.textContent=re("afk_dm_list");dmListWrap.appendChild(dmListTitle);const dmListEl=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.txt,maxHeight:"120px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"3px",padding:"8px",borderRadius:"10px",background:"rgba(255,255,255,.02)",border:"1px solid "+(Zs.bdrSub||"rgba(255,255,255,.06)")});const dmEmpty=al("div",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.muted,textAlign:"center",padding:"4px"});dmEmpty.textContent=re("afk_dm_empty");dmListEl.appendChild(dmEmpty);Pc.afkDmListEl=dmListEl;dmListWrap.appendChild(dmListEl);afkCard.appendChild(dmListWrap);Pc.afkLogList=al("div");e.appendChild(afkCard);return e}function Oc(){const e=al("div",{display:"none",flexDirection:"column",padding:"2px 0 6px"});

const mk=(opts)=>{opts=opts||{};const w=al("div",{position:"relative",margin:"0 0 12px",padding:"14px 13px 13px",borderRadius:"18px",background:opts.bg||"linear-gradient(155deg,rgba(148,163,184,.14) 0%,rgba(30,41,59,.5) 42%,rgba(14,14,20,.96) 100%)",border:"1px solid "+(opts.bdr||"rgba(148,163,184,.28)"),boxShadow:"inset 0 1px 0 rgba(255,255,255,.05), 0 12px 32px rgba(0,0,0,.28)",overflow:"hidden",boxSizing:"border-box"});const glow=al("div",{position:"absolute",width:"140px",height:"140px",borderRadius:"50%",background:opts.glow||"rgba(148,163,184,.2)",filter:"blur(36px)",top:"-48px",right:"-28px",pointerEvents:"none"});w.appendChild(glow);const bar=al("div",{position:"absolute",left:"0",top:"10px",bottom:"10px",width:"3px",borderRadius:"3px",background:opts.bar||"linear-gradient(180deg,#e2e8f0,#64748b)",pointerEvents:"none"});w.appendChild(bar);return w};

const s=mk();

const l=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:"#e2e8f0",marginBottom:"6px",paddingLeft:"8px",position:"relative",zIndex:"1"});l.textContent=re("ghost_title");

const c=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,lineHeight:"1.55",marginBottom:"11px",paddingLeft:"8px",position:"relative",zIndex:"1"});c.textContent=re("ghost_desc");

const d=zl("Ghost","",!!ce.misc.invisibleJoin,ev=>{ce.misc.invisibleJoin=ev,H(_.invisJoin,ev?"1":"0"),cd(ev?re("ghost_on_toast"):re("ghost_off_toast"),ev?"success":"info")});d.style.margin="0";d.style.padding="0";d.style.border="none";d.style.position="relative";d.style.zIndex="1";

s.appendChild(l);s.appendChild(c);s.appendChild(d);e.appendChild(s);

const p=mk({bg:"linear-gradient(155deg,rgba(167,139,250,.14) 0%,rgba(40,30,70,.45) 45%,rgba(14,14,20,.96) 100%)",bdr:"rgba(167,139,250,.3)",glow:"rgba(167,139,250,.22)",bar:"linear-gradient(180deg,#c4b5fd,#7c3aed)"});

const uRow=al("div",{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"9px",paddingLeft:"8px",position:"relative",zIndex:"1"});

const u=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:"#ddd6fe"});u.textContent=re("chat_players_mood");

const r=al("span",{fontFamily:Zs.mono,fontSize:"10.5px",fontWeight:"700",color:Zs.acc,background:Zs.accDim,border:"1px solid "+(Zs.accBdr||"rgba(167,139,250,.35)"),borderRadius:"999px",padding:"3px 9px",flexShrink:"0",boxShadow:"0 0 12px rgba(167,139,250,.2)"});r.textContent=re("chat_people_count",{n:0});

uRow.appendChild(u);uRow.appendChild(r);p.appendChild(uRow);

const f=al("div",{display:"flex",flexDirection:"column",gap:"4px",maxHeight:"220px",overflowY:"auto",paddingRight:"4px",position:"relative",zIndex:"1"});f.classList.add(A.crScroll);p.appendChild(f);e.appendChild(p);

const m=mk({bg:"linear-gradient(155deg,rgba(56,189,248,.12) 0%,rgba(20,40,60,.5) 45%,rgba(14,14,20,.96) 100%)",bdr:"rgba(56,189,248,.28)",glow:"rgba(56,189,248,.2)",bar:"linear-gradient(180deg,#7dd3fc,#0284c7)"});

const g=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"800",letterSpacing:".08em",textTransform:"uppercase",color:"#bae6fd",marginBottom:"9px",paddingLeft:"8px",position:"relative",zIndex:"1"});g.textContent=re("chat_activity");m.appendChild(g);

const h=al("div",{display:"flex",flexDirection:"column",gap:"4px",maxHeight:"280px",overflowY:"auto",paddingRight:"4px",position:"relative",zIndex:"1"});h.classList.add(A.crScroll);m.appendChild(h);e.appendChild(m);

Pc.crCountBadge=r;Pc.crPlayersList=f;Pc.crOyuncularList=f;Pc.crFeedList=h;return e}let Uc=null;const Nc={on:!1,ox:0,oy:0},qc={active:!1,users:null};function Hc(){Pc.crHideBtn&&Pc.crHideBtn.setDisabled(qc.active)}let Wc=null,Gc=null,Vc=null;function Kc(){if(Wc)return Wc;const e=al("div",{position:"fixed",zIndex:"2147483647",minWidth:"240px",maxWidth:"280px",background:"rgba(8,8,16,0.97)",border:`1px solid ${Zs.bdr}`,borderRadius:"8px",boxShadow:"0 12px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",padding:"11px 12px",display:"none",flexDirection:"column",gap:"8px",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",pointerEvents:"auto"});return e.addEventListener("mouseenter",()=>{Gc&&(clearTimeout(Gc),Gc=null)}),e.addEventListener("mouseleave",()=>Jc()),(j()??document.body).appendChild(e),Wc=e,e}function Jc(){Gc&&clearTimeout(Gc),Gc=setTimeout(()=>{Wc&&(Wc.style.display="none"),Vc=null,Gc=null},180)}function Yc(e,t,n,o){const i=Kc();i.innerHTML="";const r=al("div",{display:"flex",alignItems:"center",gap:"9px"}),a=al("div",{width:"36px",height:"36px",borderRadius:"50%",background:Zs.surAlt,flexShrink:"0",overflow:"hidden",border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center"});if(t.faceUrl){const e=document.createElement("img");Object.assign(e.style,{width:"100%",height:"100%",objectFit:"cover"}),e.src=t.faceUrl,e.onerror=()=>e.remove(),a.appendChild(e)}else{const e=al("span",{fontFamily:Zs.mono,fontSize:"11px",color:Zs.muted});e.textContent="?",a.appendChild(e)}r.appendChild(a);const s=al("div",{flex:"1",minWidth:"0",display:"flex",flexDirection:"column",gap:"2px"}),l=al("div",{fontFamily:Zs.sans,fontSize:"12.5px",fontWeight:"600",color:t.isVip?"#f59e0b":Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});l.textContent=t.name??"Unknown",s.appendChild(l);const c=al("div",{fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});c.textContent=e,s.appendChild(c),r.appendChild(s);const d=al("span",{fontFamily:Zs.mono,fontSize:"10px",fontWeight:"600",color:Zs.acc,background:Zs.accDim,border:`1px solid ${Zs.accBdr}`,borderRadius:"4px",padding:"3px 7px",flexShrink:"0",letterSpacing:"0.03em"});d.textContent=n?`LVL ${n.level}`:"LVL \u2014",r.appendChild(d),i.appendChild(r);const p=al("div",{display:"flex",flexDirection:"column",gap:"6px"});if(o&&!n){const e=al("div",{width:"60%",height:"8px",borderRadius:"3px"});e.className="ax-skel";const t=al("div",{width:"100%",height:"6px",borderRadius:"3px"});t.className="ax-skel";const n=al("div",{width:"40%",height:"8px",borderRadius:"3px"});n.className="ax-skel",p.appendChild(e),p.appendChild(t),p.appendChild(n)}else if(n){const{xp:e,level:t,currentLevelXpMin:o,currentLevelXpMax:i}=n,r=Math.max(1,i-o),a=Math.max(0,e-o),s=Math.max(0,Math.min(100,a/r*100)),l=Math.max(0,i-e),c=al("div",{display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub}),d=al("span");d.textContent=`Level ${t} \u2192 ${t+1}`;const u=al("span",{fontFamily:Zs.mono,color:Zs.txt});u.textContent=`${s.toFixed(1)}%`,c.appendChild(d),c.appendChild(u),p.appendChild(c);const f=al("div",{width:"100%",height:"6px",borderRadius:"3px",background:"rgba(255,255,255,0.06)",overflow:"hidden"}),m=al("div",{height:"100%",width:`${s}%`,background:Zs.acc,borderRadius:"3px",transition:"width 0.3s ease"});f.appendChild(m),p.appendChild(f);const g=al("div",{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px",fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,marginTop:"2px"}),h=(e,t)=>{const n=al("div",{display:"flex",justifyContent:"space-between",gap:"6px"}),o=al("span");o.textContent=e,o.style.color=Zs.muted;const i=al("span");return i.textContent=t,i.style.color=Zs.txt,n.appendChild(o),n.appendChild(i),n};g.appendChild(h("XP",e.toLocaleString())),g.appendChild(h("Next",i.toLocaleString())),g.appendChild(h("In level",a.toLocaleString())),g.appendChild(h("To next",l.toLocaleString())),p.appendChild(g)}else{const e=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.muted});e.textContent=ce.accessToken?"Bu oyuncu icin deneyim yok.":"Once oyuna baglan.",p.appendChild(e)}i.appendChild(p)}function Qc(e){const t=Kc();t.style.display="flex";const n=e.getBoundingClientRect(),o=t.offsetWidth||260,i=t.offsetHeight||140;let r=n.left-o-10;r<8&&(r=n.right+10),r+o>window.innerWidth-8&&(r=Math.max(8,window.innerWidth-o-8));let a=n.top+n.height/2-i/2;a=Math.max(8,Math.min(a,window.innerHeight-i-8)),t.style.left=`${Math.round(r)}px`,t.style.top=`${Math.round(a)}px`}function Xc(e,t){const n=al("div",{display:"flex",alignItems:"center",gap:"9px",padding:"6px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.02)",border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"});n.dataset.pid=e;const o=al("div",{width:"32px",height:"32px",borderRadius:"50%",background:Zs.surAlt,flexShrink:"0",overflow:"hidden",border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center"}),i=al("span",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.muted});i.textContent="?",o.appendChild(i);const r=document.createElement("img");Object.assign(r.style,{width:"100%",height:"100%",objectFit:"cover",display:"none"}),r.onload=()=>{r.style.display="block",i.style.display="none"},r.onerror=()=>{r.style.display="none",i.style.display="flex"},o.appendChild(r),t.faceUrl&&(r.src=t.faceUrl),n.appendChild(o),n._avatarImg=r;const a=al("div",{flex:"1",minWidth:"0",display:"flex",flexDirection:"column",gap:"1px"}),s=al("div",{fontFamily:Zs.sans,fontSize:"11.5px",fontWeight:"600",color:t.isVip?"#f59e0b":Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});s.textContent=t.name??"Unknown",n._nameEl=s;const l=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:"4px"}),c=al("span"),d=al("span");d.className="ax-skel",Object.assign(d.style,{display:"inline-block",width:"88px",height:"8px",borderRadius:"3px"}),l.appendChild(c),l.appendChild(d),n._moodTxt=c,n._moodSkel=d,n._metaEl=l,a.appendChild(s),a.appendChild(l),n.appendChild(a);const p=al("button",{width:"26px",height:"26px",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"5px",color:Zs.sub,cursor:"pointer",outline:"none",padding:"0",transition:"background 0.12s, border-color 0.12s, color 0.12s"});p.innerHTML=sl.copy,p.title=`Kopyala: ${t.name??"player"} profil ID`,p.addEventListener("mouseenter",()=>{p.style.background=Zs.accDim,p.style.borderColor=Zs.accBdr,p.style.color=Zs.acc}),p.addEventListener("mouseleave",()=>{p.style.background="transparent",p.style.borderColor=Zs.bdrSub,p.style.color=Zs.sub}),p.addEventListener("click",async t=>{t.stopImmediatePropagation();const n=ce.chatroomUsers.get(e);try{await navigator.clipboard.writeText(e),cd(`Kopyalandi: ${n?.name??"player"} profil ID`,"success")}catch{cd("Panoya yazma engellendi","error")}}),n.appendChild(p),n._copyBtn=p;const u=al("button",{width:"26px",height:"26px",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"5px",color:Zs.sub,cursor:"pointer",outline:"none",padding:"0",transition:"background 0.12s, border-color 0.12s, color 0.12s"});u.innerHTML=sl.outfit,u.addEventListener("mouseenter",()=>{u.disabled||(u.style.background=Zs.accDim,u.style.borderColor=Zs.accBdr,u.style.color=Zs.acc)}),u.addEventListener("mouseleave",()=>{u.style.background="transparent",u.style.borderColor=Zs.bdrSub,u.style.color=Zs.sub}),u.addEventListener("click",t=>{if(t.stopImmediatePropagation(),u.disabled||ce.ops.outfitCopy?.loading)return;const n=ce.chatroomUsers.get(e);Ti(e,{name:n?.name})}),n._outfitBtn=u;const f=al("button",{width:"26px",height:"26px",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"5px",color:Zs.sub,cursor:"pointer",outline:"none",padding:"0",transition:"background 0.12s, border-color 0.12s, color 0.12s"});f.innerHTML=sl.mood,f.addEventListener("mouseenter",()=>{f.disabled||(f.style.background=Zs.accDim,f.style.borderColor=Zs.accBdr,f.style.color=Zs.acc)}),f.addEventListener("mouseleave",()=>{f.style.background="transparent",f.style.borderColor=Zs.bdrSub,f.style.color=Zs.sub}),f.addEventListener("click",t=>{if(t.stopImmediatePropagation(),f.disabled)return;const n=ce.chatroomUsers.get(e);if(n?.mood){try{ii(n.mood)}catch{}fi(n.mood)}else cd(`${n?.name??"Player"} henuz ruh hali yok`,"info")}),n.appendChild(f),n._mirrorBtn=f;const m=al("button",{width:"26px",height:"26px",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"5px",color:Zs.sub,cursor:"pointer",outline:"none",padding:"0",transition:"background 0.12s, border-color 0.12s, color 0.12s"});return m.innerHTML=sl.home,m.addEventListener("mouseenter",()=>{m.disabled||(m.style.background=Zs.accDim,m.style.borderColor=Zs.accBdr,m.style.color=Zs.acc)}),m.addEventListener("mouseleave",()=>{m.style.background="transparent",m.style.borderColor=Zs.bdrSub,m.style.color=Zs.sub}),m.addEventListener("click",t=>{if(t.stopImmediatePropagation(),m.disabled)return;ce.chatroomUsers.get(e);!async function(e){if(!Fo())return;if(!e)return void cd("Hedef oyuncu yok","error");const t=ce.chatroomUsers.get(e),n={id:e,name:t?.name||e,room:null,attrs:null};await _o("plazaFollow",async()=>{const e=await Hl(n);e.walked?cd(`${e.name}: yan\u0131na y\xfcr\xfcd\xfcn`,"success"):e.join?.ok?cd(`${e.name}: oda OK \xb7 haritadan \xe7\u0131k / odaya tekrar gir`,"success"):"hedef_offline"===e.join?.status?cd(`${e.name}: \xe7evrimd\u0131\u015f\u0131`,"error"):e.wrotePos?cd(`${e.name}: konum yaz\u0131ld\u0131 \xb7 odaya gir`,"info"):cd(`${e.name}: ${e.join?.status||"oda yok"}`,"error")}).catch(e=>cd(`Plaza takip: ${e?.message||e}`,"error"))}(e)}),n._followBtn=m,n.addEventListener("mouseenter",()=>{!async function(e,t){Gc&&(clearTimeout(Gc),Gc=null);const n=ce.chatroomUsers.get(e);if(!n)return;Vc=e;const o=Zn.get(e),i=o&&Date.now()-o.ts<to?o.data:null;if(Yc(e,n,i,!i),Qc(t),!i){const o=await no(e);Vc===e&&(Yc(e,ce.chatroomUsers.get(e)??n,o,!1),Qc(t))}}(e,n)}),n.addEventListener("mouseleave",()=>{Jc()}),Zc(n,t),n}function Zc(e,t){if(e){if(e._nameEl&&(e._nameEl.textContent!==(t.name??"Unknown")&&(e._nameEl.textContent=t.name??"Unknown"),e._nameEl.style.color=t.isVip?"#f59e0b":Zs.txt),e._moodTxt&&e._moodSkel)if(t.mood){const n=String(t.mood);e._moodTxt.textContent!==n&&(e._moodTxt.textContent=n),e._moodTxt.style.display="",e._moodSkel.style.display="none"}else e._moodTxt.textContent="",e._moodTxt.style.display="none",e._moodSkel.style.display="inline-block";if(e._avatarImg&&t.faceUrl&&e._avatarImg.src!==t.faceUrl&&(e._avatarImg.src=t.faceUrl),e._mirrorBtn){const n=e._mirrorBtn;n.title=t.mood?`Kopyala+uygula: ${t.mood}`:`Uygula: ${t.name??"player"} ruh hali`,n.disabled=!ce.accessToken,n.style.cursor=n.disabled?"not-allowed":"pointer",n.style.opacity=n.disabled?"0.4":t.mood?"1":"0.6"}if(e._outfitBtn){const n=e._outfitBtn,o=!!ce.ops.outfitCopy?.loading,i=e.dataset.pid,r=i&&i===ce.profileId;n.title=r?"Kendine kopyalanamaz":``,n.disabled=!ce.accessToken||o||r,n.style.cursor=n.disabled?"not-allowed":"pointer",n.style.opacity=n.disabled?"0.35":"1"}if(e._copyBtn&&(e._copyBtn.title=`Kopyala: ${t.name??"player"} profil ID`),e._followBtn){const n=e._followBtn,o=!!ce.ops.plazaFollow?.loading,i=e.dataset.pid,r=i&&i===ce.profileId;n.title="",n.disabled=!ce.accessToken||o||r,n.style.cursor=n.disabled?"not-allowed":"pointer",n.style.opacity=n.disabled?"0.35":"1"}}}function ed(e){const t=al("div",{display:"flex",alignItems:"center",gap:"8px",padding:"5px 6px",borderRadius:"4px",fontFamily:Zs.sans,fontSize:"11px",color:Zs.txt,borderBottom:`1px solid ${Zs.bdrSub}`}),n=al("div",{width:"20px",height:"20px",borderRadius:"50%",background:Zs.surAlt,flexShrink:"0",overflow:"hidden",border:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"});if(e.faceUrl){const t=document.createElement("img");t.src=e.faceUrl,Object.assign(t.style,{width:"100%",height:"100%",objectFit:"cover"}),t.onerror=()=>t.remove(),n.appendChild(t)}t.appendChild(n);const o=al("div",{flex:"1",minWidth:"0",display:"flex",flexDirection:"column",gap:"0"});if("chat"===e.type){const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",color:Zs.txt});t.textContent=e.name;const n=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub,wordBreak:"break-word"});n.textContent=e.text,o.appendChild(t),o.appendChild(n)}else if("join"===e.type||"leave"===e.type){const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.txt});t.innerHTML=`<span style="color:${"join"===e.type?Zs.ok:Zs.err};font-weight:600">${"join"===e.type?"+":"\u2212"}</span> <span style="font-weight:600">${e.name}</span> <span style="color:${Zs.sub}">${"join"===e.type?"joined":"left"}</span>`,o.appendChild(t)}else if("mood"===e.type){const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.txt});t.innerHTML=`<span style="font-weight:600">${e.name}</span> <span style="color:${Zs.sub}">changed mood \u2192</span> <span style="font-family:${Zs.mono};color:${Zs.acc}">${e.mood}</span>`,o.appendChild(t)}else if("room"===e.type){const t=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.sub});t.textContent=e.text,o.appendChild(t)}t.appendChild(o);const i=al("span",{fontFamily:Zs.mono,fontSize:"9.5px",color:Zs.muted,flexShrink:"0"}),r=new Date(e.ts);return i.textContent=`${String(r.getHours()).padStart(2,"0")}:${String(r.getMinutes()).padStart(2,"0")}`,t.appendChild(i),t}function td(){if(Ic)return;if(!Pc.crOyuncularList||!Pc.crCountBadge)return;const e=Pc.crOyuncularList,t=Pc.crPlayerRows??=new Map,n=[...ce.chatroomUsers.entries()].filter(([e])=>e!==ce.profileId).sort((e,t)=>(e[1].name??"").localeCompare(t[1].name??"")),o=n.length;if(Pc.crCountBadge.textContent=0===o?"0 ki\u015fi":`${o} ki\u015fi`,Pc.crCountBadge.title=ce.misc.invisibleJoin?`Odada ${o} oyuncu (ghost a\xe7\u0131k)`:`Odada ${o} oyuncu`,0===o){if("1"!==e.firstChild?.dataset?.empty){e.innerHTML="",t.clear();const n=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.muted,padding:"8px 6px",textAlign:"center"});n.dataset.empty="1",n.textContent="Odada ba\u015fka oyuncu yok / hen\xfcz alg\u0131lanmad\u0131.",e.appendChild(n)}return}"1"===e.firstChild?.dataset?.empty&&(e.innerHTML="");const i=new Set(n.map(e=>e[0]));for(const[e,n]of t)if(!i.has(e)){if(t.delete(e),n._leaving)continue;n._leaving=!0,n.style.overflow="hidden",n.style.animation="ax-row-out 0.32s ease forwards",setTimeout(()=>n.remove(),320)}let r=null;for(const[o,i]of n){let n=t.get(o),a=!1;n?Zc(n,i):(n=Xc(o,i),t.set(o,n),a=!0);let s=r?r.nextSibling:e.firstChild;for(;s&&s._leaving;)s=s.nextSibling;s!==n&&e.insertBefore(n,s),a&&(n.style.animation="ax-row-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both"),r=n}}function nd(){if(Ic)return;td()}function od(){if(Pc.crCountBadge)if(Pc.crPlayerRows=new Map,Pc.crOyuncularList.innerHTML="",td(),Pc.crFeedList.innerHTML="",0===ce.chatroomFeed.length){const e=al("div",{fontFamily:Zs.sans,fontSize:"11px",color:Zs.muted,padding:"8px 6px",textAlign:"center"});e.dataset.empty="1",e.textContent="Henuz aktivite yok.",Pc.crFeedList.appendChild(e)}else for(let e=ce.chatroomFeed.length-1;e>=0;e--)Pc.crFeedList.appendChild(ed(ce.chatroomFeed[e]))}function id(){const e=Pc.autographerPanel;if(!e)return;e.innerHTML="";const t=ce.autographer,n=al("div",{padding:"12px"});if(!t.targetProfile){const t=Bl("Oyunda hedef profili ac \u2014 otomatik algilar.");return n.appendChild(t),void e.appendChild(n)}const o=al("div",{display:"flex",gap:"10px",alignItems:"center",padding:"10px 12px",background:Zs.accDim,borderBottom:`1px solid ${Zs.bdr}`}),i=al("div",{flex:"1",minWidth:"0",overflow:"hidden"}),r=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"600",color:Zs.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:"3px"});r.textContent=t.targetProfile.name,i.appendChild(r);const a=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:"3px"});if(a.textContent=t.targetProfile.id,i.appendChild(a),t.targetProfile.created){const e=al("div",{fontFamily:Zs.sans,fontSize:"10px",color:Zs.sub}),n=new Date(t.targetProfile.created);e.textContent=`Created ${n.toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"})}`,i.appendChild(e)}o.appendChild(i);const s=al("button",{fontFamily:Zs.sans,fontSize:"10px",fontWeight:"500",color:Zs.sub,background:"transparent",border:`1px solid ${Zs.bdrSub}`,borderRadius:"4px",padding:"3px 8px",cursor:"pointer",outline:"none",flexShrink:"0"});s.textContent="\u2715",s.title="Clear target",s.addEventListener("click",()=>{t.running?cd("Stop the autographer first","error"):(t.targetProfile=null,t.targetFaceUrl=null,id())}),o.appendChild(s),e.appendChild(o);const l=al("div",{padding:"10px 12px"}),c=al("div",{fontFamily:Zs.sans,fontSize:"10.5px",color:Zs.sub,marginBottom:"10px",lineHeight:"1.55"});c.textContent=t.vipChecked?t.isVip?"VIP membership detected \u2014 your account is eligible for the accelerated tier, dispatching one autograph every 2 minutes (30 per hour) until the requested quota is reached.":"Standard (non-VIP) account detected \u2014 the server enforces a strict cooldown of one autograph per hour. Upgrade to VIP to lift the limit up to one every 2 minutes.":"Delivery rate is gated by your membership: VIP members can send one autograph every 2 minutes (up to 30 per hour), while Standard accounts are throttled to one autograph per hour. Your tier will be detected automatically once dispatch starts.",l.appendChild(c);const d=al("div",{fontFamily:Zs.sans,fontSize:"11px",fontWeight:"600",color:Zs.txt,marginBottom:"5px"});d.textContent="Autographs to send",l.appendChild(d);const p=wl([["1","1"],["5","5"],["10","10"],["25","25"],["50","50"],["0","Unlimited"]]);p.value=String(t.maxCount),l.appendChild(p),Pc.autographerCountSel=p;const u=al("div",{fontFamily:Zs.mono,fontSize:"10px",color:Zs.sub,marginBottom:"8px",minHeight:"14px"});if(t.running){const e=t.maxCount>0?`/ ${t.maxCount}`:"/ \u221e";u.textContent=`Sent ${t.sentCount} ${e} \xb7 Next in ${As(t.nextInSec)}`}l.appendChild(u),Pc.autographerStatus=u;const f=t.running?xl("Stop Autographer","stop","danger"):xl("Start Autographer","autograph");f.addEventListener("click",()=>{t.running?Ms(!1):Ps()}),l.appendChild(f),Pc.autographerStartStopBtn=f,e.appendChild(l)}function rd(e,t){for(const n of Mc){const o=n===e;Pc.skelPanes?.[n]&&(Pc.skelPanes[n].style.display=o&&!t?"flex":"none"),Pc.panes?.[n]&&(Pc.panes[n].style.display=o&&t?"flex":"none")}}function ad(e){try{Pc.globalStatusStrip&&(Pc.globalStatusStrip.style.display="none")}catch{}try{Pc.favBar&&(Pc.favBar.style.display=e?"grid":"none")}catch{}}function sd(e){Tc=e;try{e&&"function"==typeof H&&H(_.uiTab,e)}catch{}try{if(e==="homes"||e==="bots"||e==="auto")__xbEnsureCatalog();if(e==="emoji")__xbEnsurePack()}catch{}const t=!!ce.accessToken;for(const[t,n]of Object.entries(Pc.tabBtns||{})){const o=t===e;n.style.color=o?"#f5f3ff":Zs.sub,n.style.borderColor=o?"rgba(196,181,253,.65)":"rgba(167,139,250,.18)",n.style.background=o?"linear-gradient(160deg,rgba(167,139,250,.42),rgba(76,29,149,.45),rgba(20,16,32,.85))":"linear-gradient(160deg,rgba(255,255,255,.07) 0%,rgba(20,16,32,.55) 55%,rgba(0,0,0,.35) 100%)",n.style.boxShadow=o?"inset 0 1px 0 rgba(255,255,255,.14), 0 0 22px rgba(167,139,250,.4), 0 8px 18px rgba(0,0,0,.35)":"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)",n.style.transform=o?"translateY(-1px)":"none"}try{Pc.syncTabAccent?.()}catch{}try{const sb=Pc.settingsRailBtn;if(sb){const on=e==="settings";sb.style.color=on?Zs.acc:Zs.sub;sb.style.borderColor=on?"rgba(196,181,253,.65)":"rgba(167,139,250,.18)";sb.style.boxShadow=on?"inset 0 1px 0 rgba(255,255,255,.14), 0 0 22px rgba(167,139,250,.4)":"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)";sb.style.background=on?"linear-gradient(160deg,rgba(167,139,250,.42),rgba(76,29,149,.45),rgba(20,16,32,.85))":"linear-gradient(160deg,rgba(255,255,255,.07) 0%,rgba(20,16,32,.55) 55%,rgba(0,0,0,.35) 100%)"}}catch{}try{const fb=Pc.changelogRailBtn;if(fb){const on=e==="changelog";fb.style.color=on?"#fbbf24":Zs.sub;fb.style.borderColor=on?"rgba(251,191,36,.65)":"rgba(251,191,36,.32)";fb.style.boxShadow=on?"inset 0 1px 0 rgba(255,255,255,.14), 0 0 22px rgba(245,158,11,.4)":"inset 0 1px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.28)";fb.style.background=on?"linear-gradient(160deg,rgba(251,191,36,.38),rgba(146,64,14,.45),rgba(20,16,12,.85))":"linear-gradient(160deg,rgba(245,158,11,.2) 0%,rgba(40,28,12,.55) 55%,rgba(0,0,0,.35) 100%)"}}catch{}rd(e,t),ad(t),"chatroom"===e&&t&&od();try{Sd?.()}catch{}}function ld(){if(!Cc)return;const e=!!ce.accessToken;Pc.msgBanner&&(Pc.msgBanner.style.display=de?"none":"flex"),rd(Tc,e),ad(e);const t=[[Pc.gBtn,ce.ops.gender],[Pc.mBtn,ce.ops.mood],[Pc.sBtn,ce.ops.status],[Pc.rBtn,ce.ops.restore],[Pc.qBtn,ce.ops.quests],[Pc.cBtn,ce.ops.crystals],[Pc.afBtn,ce.ops.acceptFriends],[Pc.rfBtn,ce.ops.rejectFriends],[Pc.dfBtn,ce.ops.deleteFriendsLevel],[Pc.dvBtn,ce.ops.deleteFriendsVip],[Pc.rmBtn,ce.ops.readMessages],[Pc.dmSpamGuardBtn,ce.ops.dmSpamGuard],[Pc.profileLookupBtn,ce.ops.profileLookup],[Pc.avatarBtn,ce.ops.avatar],[Pc.roomImgBtn,ce.ops.roomImage],[Pc.friendsListBtn,ce.ops.friendsList]];for(const[n,o]of t)n&&o&&(o.loading&&e?n.setLoading(!0):(n.setLoading(!1),n.setDisabled(!e)));Pc.homesBtn&&(ce.ops.homes.loading&&e?Pc.homesBtn.setLoading(!0):(Pc.homesBtn.setLoading(!1),Pc.homesBtn.setDisabled(!e||!p.length)));const n=!(!ce.ops.homesHarvest?.loading&&!ce.ops.homes?.loading);if(Pc.homesHarvestBtn&&(n&&e?Pc.homesHarvestBtn.setLoading(!0):(Pc.homesHarvestBtn.setLoading(!1),Pc.homesHarvestBtn.setDisabled(!e))),Pc.homesHarvestOneBtn&&(n&&e?Pc.homesHarvestOneBtn.setLoading(!0):(Pc.homesHarvestOneBtn.setLoading(!1),Pc.homesHarvestOneBtn.setDisabled(!e))),Pc.homesHarvestApplyBtn&&(n&&e?Pc.homesHarvestApplyBtn.setLoading(!0):(Pc.homesHarvestApplyBtn.setLoading(!1),Pc.homesHarvestApplyBtn.setDisabled(!e))),Pc.homesHarvestInp&&(Pc.homesHarvestInp.disabled=!e||n),Pc.homesDownloadBtn)try{"function"==typeof Pc.homesDownloadBtn.setDisabled?Pc.homesDownloadBtn.setDisabled(!e||!p.length):Pc.homesDownloadBtn.disabled=!e||!p.length}catch{}if(Pc.homesClearBtn)try{"function"==typeof Pc.homesClearBtn.setDisabled?Pc.homesClearBtn.setDisabled(!p.length):Pc.homesClearBtn.disabled=!p.length}catch{}if(Pc.homesSelfBtn)try{n&&e&&"function"==typeof Pc.homesSelfBtn.setLoading?Pc.homesSelfBtn.setLoading(!0):("function"==typeof Pc.homesSelfBtn.setLoading&&Pc.homesSelfBtn.setLoading(!1),"function"==typeof Pc.homesSelfBtn.setDisabled?Pc.homesSelfBtn.setDisabled(!e):Pc.homesSelfBtn.disabled=!e)}catch{}const o=!!ce.ops.petClone?.loading;if(Pc.petNickBtn&&(o&&e?Pc.petNickBtn.setLoading(!0):(Pc.petNickBtn.setLoading(!1),Pc.petNickBtn.setDisabled(!e))),Pc.petNickInp&&(Pc.petNickInp.disabled=!e||o),ce.ops.avatar.loading&&e?Pc.avatarBtn?.setLoading(!0):(Pc.avatarBtn?.setLoading(!1),Pc.syncAvatarBtn?.()),ce.ops.roomImage?.loading&&e?Pc.roomImgBtn?.setLoading(!0):(Pc.roomImgBtn?.setLoading(!1),Pc.syncRoomImgBtn?.()),Pc.outfitCopyBtn){!!ce.ops.outfitCopy?.loading&&e?Pc.outfitCopyBtn.setLoading(!0):(Pc.outfitCopyBtn.setLoading(!1),Pc.outfitCopyBtn.setDisabled(!e))}if(Pc.outfitRestoreBtn){!!ce.ops.outfitCopy?.loading&&e?Pc.outfitRestoreBtn.setLoading(!0):(Pc.outfitRestoreBtn.setLoading(!1),Pc.outfitRestoreBtn.setDisabled(!e))}if(Pc.outfitEmergencyBtn){!!ce.ops.outfitCopy?.loading&&e?Pc.outfitEmergencyBtn.setLoading(!0):(Pc.outfitEmergencyBtn.setLoading(!1),Pc.outfitEmergencyBtn.setDisabled(!e))}if(Pc.agOutfitCopyBtn){!!ce.ops.outfitCopy?.loading&&e?Pc.agOutfitCopyBtn.setLoading(!0):(Pc.agOutfitCopyBtn.setLoading(!1),Pc.agOutfitCopyBtn.setDisabled(!e||!ce.autographer?.targetProfile?.id))}Jl?.(),Sc?.(),ja?.();try{Ss&&"none"!==Ss.style.display&&$s()}catch{}try{Sd?.()}catch{}try{Pc.syncQuestBadges?.()}catch{}try{Pc.qBadge&&Pc.qBadge.textContent!=null&&!(Pc.qBadge.appendChild)&& (Pc.qBadge.textContent=(ce.ops.quests.progress||0)+" bitti")}catch{}const{collected:i,total:r}=ce.ops.crystals,a=Math.max(1,r||1);try{Pc.cBadge&&(Pc.cBadge.textContent=i+" / "+(r||"?"))}catch{}try{if(Pc.cBar){Pc.cBar.style.width=Math.min(100,i/a*100)+"%";const e=Pc.cBar.parentElement;e&&(e.style.display=i>0?"block":"none")}}catch{}}function cd(e,t="info"){try{!function(e,t){try{ce.ui||(ce.ui={notifLog:[]}),Array.isArray(ce.ui.notifLog)||(ce.ui.notifLog=[]),ce.ui.notifLog.unshift({ts:Date.now(),msg:String(e||""),type:t||"info"}),ce.ui.notifLog.length>40&&(ce.ui.notifLog.length=40),Pc.notifBadge&&(Pc.notifBadge.textContent=String(Math.min(99,ce.ui.notifLog.length)),Pc.notifBadge.style.display=ce.ui.notifLog.length?"flex":"none")}catch{}}?.(e,t)}catch{}try{gd?.("error"===t?"error":"success"===t?"success":"info")}catch{}const n=j()??document.body;let o=n._axToasts;o||(o=al("div",{position:"fixed",bottom:"20px",left:"50%",transform:"translateX(-50%)",zIndex:"2147483648",display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",pointerEvents:"none",maxWidth:"calc(100vw - 40px)"}),n.appendChild(o),n._axToasts=o);const i={success:{fg:Zs.ok,bg:Zs.okDim,bdr:"rgba(74,222,128,0.15)",svg:'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'},error:{fg:Zs.err,bg:Zs.errDim,bdr:"rgba(239,68,68,0.15)",svg:'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'},info:{fg:Zs.info,bg:Zs.infoDim,bdr:"rgba(96,165,250,0.15)",svg:'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'}},r=i[t]??i.info,a=al("span",{width:"16px",height:"16px",borderRadius:"50%",flexShrink:"0",display:"flex",alignItems:"center",justifyContent:"center",background:r.bg,color:r.fg});a.innerHTML=r.svg;const s=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"400",padding:"7px 12px 7px 9px",borderRadius:"8px",background:"rgba(8,8,16,0.97)",border:`1px solid ${r.bdr}`,color:Zs.txt,boxShadow:"0 10px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",display:"flex",alignItems:"center",gap:"8px",pointerEvents:"all",whiteSpace:"nowrap",animation:"ax-fi 0.2s cubic-bezier(0.16, 1, 0.3, 1) both"});s.appendChild(a),s.appendChild(document.createTextNode(e)),o.appendChild(s),setTimeout(()=>{s.style.animation="ax-fo 0.18s ease forwards",setTimeout(()=>s.remove(),200)},2800)}let dd=null,pd=null,ud=null,fd=!1,md=null;function gd(e){if(ce.ui?.sound)try{const t=window.AudioContext||window.webkitAudioContext;if(!t)return;md||(md=new t);const n=md;const tone=(freq,vol,dur,type,delay)=>{const o=n.createOscillator(),g=n.createGain(),f=n.createBiquadFilter();o.type=type||"triangle";f.type="lowpass";f.frequency.value=1800;o.connect(f);f.connect(g);g.connect(n.destination);const r=n.currentTime+(delay||0);o.frequency.setValueAtTime(freq,r);g.gain.setValueAtTime(Math.max(.001,vol),r);g.gain.exponentialRampToValueAtTime(.001,r+dur);o.start(r);o.stop(r+dur+.01)};if("error"===e||"lockdown"===e)tone(165,.022,.28,"sine",0);else if("success"===e||"block"===e){tone(523,.016,.11,"triangle",0);tone(784,.01,.14,"sine",.05)}else{tone(440,.011,.07,"triangle",0);tone(660,.006,.09,"sine",.03)}}catch{}}function hd(e,t,n,o){const i=al("span",{fontFamily:Zs.mono,fontSize:"9px",fontWeight:"600",letterSpacing:"0.04em",padding:"3px 7px",borderRadius:"999px",color:t||Zs.sub,background:n||"rgba(255,255,255,0.04)",border:`1px solid ${Zs.bdrSub}`,whiteSpace:"nowrap",cursor:o?.onClick?"pointer":"default",userSelect:"none"});return i.textContent=e,o?.title&&(i.title=o.title),"function"==typeof o?.onClick&&i.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),o.onClick(e)}),i}function yd(){const e=Pc.globalStatusStrip;if(!e)return;e.innerHTML="";const t=function(){if(!ce.accessToken)return{ok:!1,label:"GIRIS YOK",color:Zs.err};try{const e=tn(ce.accessToken),t=1e3*Number(e?.exp||0);return t&&t<Date.now()?{ok:!1,label:"TOKEN BITTI",color:Zs.err}:t&&t-Date.now()<3e5?{ok:!0,label:"TOKEN BITIYO",color:Zs.acc}:{ok:!0,label:"",color:Zs.ok,silent:!0}}catch{return{ok:!!ce.accessToken,label:"",color:Zs.sub,silent:!0}}}();t.label&&!t.silent?e.appendChild(hd(t.label,t.color,t.ok?Zs.okDim:Zs.errDim)):!t.label||"TOKEN BITTI"!==t.label&&"TOKEN BITIYO"!==t.label&&"GIRIS YOK"!==t.label||e.appendChild(hd(t.label,t.color,t.ok?Zs.okDim:Zs.errDim));try{const t=on()||"\u2014";e.appendChild(hd(t,Zs.acc,Zs.accDim,{title:"B\xf6lge"}))}catch{}const n=!!ce.misc.chatFilterBypass;e.appendChild(hd(n?"BYPASS":"BYPASS off",n?Zs.ok:Zs.muted,n?Zs.okDim:"rgba(255,255,255,0.03)",{title:"Sohbet filtresi bypass (Title Case + g\xf6r\xfcnmez harf). T\u0131kla a\xe7/kapa.",onClick:()=>{ce.misc.chatFilterBypass=!ce.misc.chatFilterBypass;try{H(_.chat,ce.misc.chatFilterBypass?"1":"0")}catch{}cd("Sohbet bypass "+(ce.misc.chatFilterBypass?"A\xc7IK":"kapal\u0131"),ce.misc.chatFilterBypass?"success":"info"),yd();try{Sd?.()}catch{}}}));const o=!!ce.misc.invisibleJoin;e.appendChild(hd(o?"GHOST":"GHOST off",o?Zs.info:Zs.muted,o?Zs.infoDim:"rgba(255,255,255,0.03)",{title:"G\xf6r\xfcnmez oda giri\u015fi (ghost join). T\u0131kla a\xe7/kapa.",onClick:()=>{ce.misc.invisibleJoin=!ce.misc.invisibleJoin;try{H(_.invisJoin,ce.misc.invisibleJoin?"1":"0")}catch{}cd("Ghost join "+(ce.misc.invisibleJoin?"A\xc7IK":"kapal\u0131"),ce.misc.invisibleJoin?"success":"info"),yd()}}));const i=!!ce.misc.cleanConsole;e.appendChild(hd(i?"KONSOL":"KONSOL off",i?Zs.acc:Zs.muted,i?Zs.accDim:"rgba(255,255,255,0.03)",{title:"Temiz konsol. T\u0131kla a\xe7/kapa.",onClick:()=>{ce.misc.cleanConsole=!ce.misc.cleanConsole;try{H(_.cleanConsole,ce.misc.cleanConsole?"1":"0")}catch{}cd("Temiz konsol "+(ce.misc.cleanConsole?"A\xc7IK":"kapal\u0131"),ce.misc.cleanConsole?"success":"info"),yd()}}));const r=ce.dmSpamGuard;r?.enabled?(e.appendChild(hd(r.lockdown?"LOCKDOWN":"SPAM ON",r.lockdown?Zs.err:Zs.ok,r.lockdown?Zs.errDim:Zs.okDim)),!1!==r.gameShield&&e.appendChild(hd("KALKAN",Zs.info,Zs.infoDim))):e.appendChild(hd("SPAM off",Zs.muted,"rgba(255,255,255,0.03)"));const a=r?.blockQueue?.size||0;a&&e.appendChild(hd(`Q ${a}`,Zs.acc,Zs.accDim))}function bd(){const e=ce.dmSpamGuard;if(!Pc.spamMeterBar||!e)return;let t=0;try{t=Vr()}catch{t=0}const n=e.floodThreshold||30,o=Math.min(100,Math.round(t/Math.max(n,1)*100));Pc.spamMeterBar.style.width=`${o}%`,Pc.spamMeterRate&&(Pc.spamMeterRate.textContent=`${t} /10sn`,Pc.spamMeterRate.style.color=t>=n?Zs.err:t>=n/2?Zs.acc:Zs.ok,Pc.spamMeterBar.style.animation=t>=n?"ax-meter 0.9s ease infinite":""),Pc.spamMeterSub&&(Pc.spamMeterSub.style.display="none",Pc.spamMeterSub.textContent="");try{if(Pc.spamMeterNeedle)Pc.spamMeterNeedle.style.left="calc("+o+"% - 2px)"}catch{}}function xd(){const e=Pc.headerAccountMount;if(!e)return;e.innerHTML="";const t=!!ce.accessToken;e.style.minHeight="0";e.style.display="flex";e.style.alignItems="center";e.style.padding="2px 0";const n=al("span",{width:"7px",height:"7px",borderRadius:"50%",flexShrink:"0",background:t?Zs.ok:Zs.err,boxShadow:t?`0 0 8px ${Zs.ok}`:`0 0 8px ${Zs.err}`,animation:t?"ax-dot 1.6s ease infinite":"none",marginRight:"6px"});if(!t)return e.appendChild(n);const o=ce.card||{};const card=al("div",{display:"flex",alignItems:"center",gap:"10px",padding:"6px 8px",borderRadius:"12px",background:"linear-gradient(155deg,rgba(167,139,250,.1),rgba(255,255,255,.025))",border:"1px solid rgba(167,139,250,.2)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.05)",width:"100%",boxSizing:"border-box"});const av=al("div",{width:"40px",height:"40px",borderRadius:"11px",flexShrink:"0",background:`linear-gradient(135deg, ${Zs.accDim}, rgba(0,0,0,.35))`,border:`1px solid ${Zs.accBdr}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",color:Zs.acc,fontFamily:Zs.mono,fontSize:"11px",fontWeight:"700"});if(o.faceUrl){const im=al("img",{width:"100%",height:"100%",objectFit:"cover",display:"block"});im.src=o.faceUrl;im.alt="";av.appendChild(im)}else av.textContent=String(ce.profileName||"?").replace(/^..\|/,"").slice(0,2).toUpperCase();const mid=al("div",{flex:"1",minWidth:"0"});const name=al("div",{fontFamily:Zs.sans,fontSize:"12px",fontWeight:"700",color:Zs.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"});name.textContent=ce.profileName||"Oyuncu";const row=al("div",{display:"flex",flexWrap:"wrap",gap:"5px",marginTop:"4px"});const pill=(bg,bdr,col,html)=>{const p=al("span",{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:Zs.mono,fontSize:"9.5px",fontWeight:"700",padding:"3px 8px",borderRadius:"999px",background:bg,border:"1px solid "+bdr,color:col,lineHeight:"1"});p.innerHTML=html;return p};if(null!=o.level)row.appendChild(pill(Zs.accDim||"rgba(167,139,250,.14)",Zs.accBdr||"rgba(167,139,250,.35)",Zs.acc||"#c4b5fd",'<span style="opacity:.85">Lv</span> '+o.level));if(null!=o.sc)row.appendChild(pill("rgba(251,191,36,.14)","rgba(251,191,36,.4)","#fbbf24",'<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.3 7L12 17.8 5.7 21l2.3-7-6-4.8h7.6z"/></svg>'+Cl(o.sc)));if(null!=o.diamond)row.appendChild(pill("rgba(56,189,248,.14)","rgba(56,189,248,.4)","#7dd3fc",'<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9l4-6zm2.2 2L6.5 8h11l-1.7-3H8.2zM7.1 10l4.9 9.2L16.9 10H7.1z"/></svg>'+Cl(o.diamond)));mid.appendChild(name);mid.appendChild(row);card.appendChild(av);card.appendChild(mid);const wrap=al("div",{display:"flex",alignItems:"center",gap:"6px",width:"100%"});wrap.appendChild(n);wrap.appendChild(card);e.appendChild(wrap)}function kd(){if(dd&&"none"!==dd.style.display)return dd.style.display="none",void(ce.ui.notifOpen=!1);wd(),dd&&(dd.style.display="flex",ce.ui.notifOpen=!0)}function wd(){const e=j()??document.body;if(dd){try{dd.remove()}catch{}dd=null}const t=al("div",{position:"fixed",top:"72px",right:"20px",width:"300px",maxWidth:"calc(100vw - 24px)",maxHeight:"360px",display:"none",flexDirection:"column",background:Zs.glass||Zs.bg,border:`1px solid ${Zs.bdr}`,borderRadius:"12px",boxShadow:`0 0 0 1px ${Zs.accGlow} inset, 0 24px 50px rgba(0,0,0,0.8)`,zIndex:"2147483646",overflow:"hidden",fontFamily:Zs.sans,animation:"ax-in 0.2s ease both"});for(const e of["mousedown","click","wheel","touchstart"])t.addEventListener(e,e=>e.stopImmediatePropagation(),{passive:!0});const n=al("div",{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:Zs.sur,borderBottom:`1px solid ${Zs.bdrSub}`}),o=al("span",{fontSize:"11px",fontWeight:"700",color:Zs.txt,letterSpacing:"0.08em"});o.textContent="BILDIRIMLER";const i=al("button",{background:"none",border:"none",color:Zs.sub,fontSize:"10px",cursor:"pointer",fontFamily:Zs.sans});i.textContent="Temizle",i.addEventListener("click",()=>{ce.ui.notifLog=[],wd(),dd&&(dd.style.display="flex"),Pc.notifBadge&&(Pc.notifBadge.style.display="none")}),n.appendChild(o),n.appendChild(i),t.appendChild(n);const r=al("div",{overflowY:"auto",padding:"8px",flex:"1"}),a=ce.ui?.notifLog||[];if(a.length)for(const e of a){const t=al("div",{padding:"8px 9px",marginBottom:"5px",borderRadius:"7px",background:"rgba(255,255,255,0.03)",border:`1px solid ${Zs.bdrSub}`,fontSize:"11px",color:Zs.txt,lineHeight:"1.4"}),n=al("div",{fontFamily:Zs.mono,fontSize:"9px",color:Zs.muted,marginBottom:"3px"});n.textContent=new Date(e.ts).toLocaleTimeString("tr-TR"),t.appendChild(n),t.appendChild(document.createTextNode(e.msg)),r.appendChild(t)}else{const e=al("div",{padding:"16px",textAlign:"center",color:Zs.sub,fontSize:"11px"});e.textContent="Henuz kayit yok.",r.appendChild(e)}t.appendChild(r),e.appendChild(t),dd=t}function vd(e){if(!(!0===e||!pd||"none"===pd.style.display)||!1===e)return pd&&(pd.style.display="none"),void(ce.ui.cmdOpen=!1);if(function(){const e=j()??document.body;if(pd){try{pd.remove()}catch{}pd=null}const t=al("div",{position:"fixed",inset:"0",zIndex:"2147483647",background:"rgba(0,0,0,0.45)",display:"none",alignItems:"flex-start",justifyContent:"center",paddingTop:"12vh",fontFamily:Zs.sans});for(const e of["mousedown","click","wheel"])t.addEventListener(e,e=>e.stopImmediatePropagation(),{passive:!0});t.addEventListener("mousedown",e=>{e.target===t&&vd(!1)});const n=al("div",{width:"min(420px, calc(100vw - 32px))",background:Zs.glass||Zs.bg,border:`1px solid ${Zs.bdr}`,borderRadius:"14px",overflow:"hidden",boxShadow:`0 0 0 1px ${Zs.accGlow} inset, 0 30px 70px rgba(0,0,0,0.85)`,display:"flex",flexDirection:"column",animation:"ax-in 0.18s ease both"}),o=al("input",{width:"100%",padding:"14px 16px",border:"none",outline:"none",background:"transparent",color:Zs.txt,fontFamily:Zs.sans,fontSize:"14px",borderBottom:`1px solid ${Zs.bdrSub}`,boxSizing:"border-box"});o.placeholder="Komut ara\u2026 (Ctrl+K)";const i=al("div",{maxHeight:"280px",overflowY:"auto",padding:"6px"});function r(e){i.innerHTML="";const t=String(e||"").toLowerCase().trim(),n=[{id:"tab-profile",label:"Sekme: Profil",run:()=>sd("profile")},{id:"tab-auto",label:"Sekme: Oto / Spam",run:()=>sd("auto")},{id:"tab-spam",label:re("cmd_tab_spam"),run:()=>sd("spam")},{id:"tab-bots",label:"Sekme: Botlar / Imza",run:()=>sd("bots")},{id:"tab-misc",label:"Sekme: Diger / VIP",run:()=>sd("misc")},{id:"tab-emoji",label:"Sekme: Emoji",run:()=>sd("emoji")},{id:"tab-chat",label:"Sekme: Sohbet",run:()=>sd("chatroom")},{id:"pkg",label:"VIP Paket panelini ac",run:()=>{sd("misc");try{Ss||Is(),Ss&&(Ss.style.display="flex",$s?.())}catch{}}},{id:"ag",label:"Imza panelini ac",run:()=>{sd("bots");try{Rs||Us(),Rs&&(Rs.style.display="flex")}catch{}}},{id:"lock",label:"DM Lockdown simdi",run:()=>{try{Ma?.()}catch{}}},{id:"notif",label:"Bildirimleri ac",run:()=>kd()},{id:"settings",label:"Ayarlari ac/kapa",run:()=>{if(!Pc.settingsPanel)return;const e="none"!==Pc.settingsPanel.style.display;Pc.settingsPanel.style.display=e?"none":"block"}}].filter(e=>!t||e.label.toLowerCase().includes(t));for(const e of n){const t=al("button",{width:"100%",textAlign:"left",padding:"10px 12px",background:"transparent",border:"none",borderRadius:"8px",color:Zs.txt,fontFamily:Zs.sans,fontSize:"12px",cursor:"pointer"});t.textContent=e.label,t.addEventListener("mouseenter",()=>{t.style.background=Zs.accDim}),t.addEventListener("mouseleave",()=>{t.style.background="transparent"}),t.addEventListener("click",()=>{vd(!1);try{e.run()}catch{}}),i.appendChild(t)}if(!n.length){const e=al("div",{padding:"14px",color:Zs.sub,fontSize:"11px",textAlign:"center"});e.textContent="Sonuc yok",i.appendChild(e)}}o.addEventListener("input",()=>r(o.value)),o.addEventListener("keydown",e=>{if(e.stopImmediatePropagation(),"Escape"===e.key&&vd(!1),"Enter"===e.key){const e=i.querySelector("button");e&&e.click()}});for(const e of["keypress","keyup"])o.addEventListener(e,e=>e.stopImmediatePropagation());n.appendChild(o),n.appendChild(i),t.appendChild(n),e.appendChild(t),pd=t,r("")}(),pd){pd.style.display="flex",ce.ui.cmdOpen=!0;const e=pd.querySelector("input");e&&setTimeout(()=>e.focus(),30)}}function Sd(){try{xd()}catch{}try{ad(!!ce.accessToken)}catch{}try{yd()}catch{}try{bd()}catch{}}function Cd(){fd||(fd=!0,window.addEventListener("keydown",e=>{const t="k"===e.key||"K"===e.key;(e.ctrlKey||e.metaKey)&&t&&(e.preventDefault(),e.stopPropagation(),vd()),"Escape"===e.key&&(ce.ui?.cmdOpen&&vd(!1),ce.ui?.notifOpen&&dd&&(dd.style.display="none",ce.ui.notifOpen=!1))},!0));try{ud&&(ud.remove(),ud=null)}catch{}}function Id(){for(const e of[dd,pd,ud])try{e&&e.remove()}catch{}dd=null,pd=null,ud=null}function $d(e){if(!Cc||e){if(ul(),function(){const e=j();if(!e)return;let t=e.getElementById(A.kf);t||(t=document.createElement("style"),t.id=A.kf,e.appendChild(t)),t.textContent=["@keyframes ax-spin{to{transform:rotate(360deg)}}","@keyframes ax-in{from{opacity:0;transform:scale(.96) translateY(-10px)}to{opacity:1;transform:none}}","@keyframes ax-fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}","@keyframes ax-fo{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(4px)}}","@keyframes ax-sk{0%{background-position:200% center}100%{background-position:-200% center}}","@keyframes ax-pulse{0%,100%{opacity:.4}50%{opacity:.8}}",`@keyframes ax-dz-pulse{0%,100%{border-color:${Zs.accBdr}}50%{border-color:${Zs.acc}}}`,`#${A.body}::-webkit-scrollbar{width:2px}`,`#${A.body}::-webkit-scrollbar-track{background:transparent}`,`#${A.body}::-webkit-scrollbar-thumb{background:${Zs.accDim};border-radius:2px}`,".ax-skel{background:linear-gradient(90deg,rgba(255,255,255,.02) 25%,rgba(255,255,255,.055) 50%,rgba(255,255,255,.02) 75%);background-size:200% 100%;animation:ax-sk 2s ease infinite;border-radius:4px;}",`#${A.wrap}::before{content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;opacity:.018;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:128px 128px;z-index:0;}`,`#${A.pkgList}::-webkit-scrollbar{width:3px}`,`#${A.pkgList}::-webkit-scrollbar-track{background:transparent}`,`#${A.pkgList}::-webkit-scrollbar-thumb{background:${Zs.accBdr};border-radius:2px}`,`#${A.agFloat} > div:last-child::-webkit-scrollbar{width:2px}`,`#${A.agFloat} > div:last-child::-webkit-scrollbar-track{background:transparent}`,`#${A.agFloat} > div:last-child::-webkit-scrollbar-thumb{background:${Zs.accDim};border-radius:2px}`,`#${A.pkgFloat} > div:last-child::-webkit-scrollbar{width:2px}`,`#${A.pkgFloat} > div:last-child::-webkit-scrollbar-track{background:transparent}`,`#${A.pkgFloat} > div:last-child::-webkit-scrollbar-thumb{background:${Zs.accDim};border-radius:2px}`,`.${A.crScroll}::-webkit-scrollbar{width:5px}`,`.${A.crScroll}::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:3px}`,`.${A.crScroll}::-webkit-scrollbar-thumb{background:${Zs.accBdr};border-radius:3px;border:1px solid transparent;background-clip:content-box}`,`.${A.crScroll}::-webkit-scrollbar-thumb:hover{background:${Zs.acc};background-clip:content-box}`,`.${A.crScroll}{scrollbar-width:thin;scrollbar-color:${Zs.accBdr} transparent}`,"@keyframes ax-row-in{from{opacity:0;transform:translateY(-6px) scale(0.98)}to{opacity:1;transform:none}}","@keyframes ax-row-out{from{opacity:1;transform:none;max-height:60px;margin-top:0;padding-top:6px;padding-bottom:6px}to{opacity:0;transform:translateX(-14px);max-height:0;padding-top:0;padding-bottom:0;border-width:0}}","@keyframes ax-tab-in{from{opacity:.4;transform:translateY(2px)}to{opacity:1;transform:none}}","@keyframes ax-meter{0%{filter:brightness(1)}50%{filter:brightness(1.25)}100%{filter:brightness(1)}}","@keyframes ax-dot{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}","@keyframes ax-spring{0%{transform:scale(.92)}60%{transform:scale(1.06)}100%{transform:scale(1)}}"].join("")}(),window.addEventListener("keydown",cl,!0),window.addEventListener("keypress",cl,!0),window.addEventListener("keyup",cl,!0),Cc){try{Cc.remove()}catch{}Cc=null}try{Id?.()}catch{}Cc=Ac(),(j()??document.body).appendChild(Cc);try{window.__xbPanel=Cc;Cc.setAttribute("data-xb-panel","1")}catch(e){}sd(Tc||"profile"),ld();try{ce.accessToken?ni():ce.accessToken&&ui()}catch{}try{Us()}catch{}try{ee?.()}catch{}try{vs()}catch{}try{Cd?.()}catch{}try{Sd?.()}catch{}}}function Bd(){let e=null,t=!!Ic,n=Tc||"profile";try{Cc&&(e=Cc.getBoundingClientRect())}catch{}try{if(void 0!==Rs&&Rs){try{Rs.remove()}catch{}Rs=null}}catch{}try{if(void 0!==Ss&&Ss){try{Ss.remove()}catch{}Ss=null;try{delete Pc.pkgFloatBody}catch{}}}catch{}try{Id?.()}catch{}for(const e of Object.keys(Pc))try{delete Pc[e]}catch{}Ic=!1,Tc=n,$d(!0);try{Cc&&e&&(Cc.style.left=Math.min(Math.max(0,e.left),innerWidth-Cc.offsetWidth)+"px",Cc.style.top=Math.min(Math.max(0,e.top),innerHeight-Cc.offsetHeight)+"px",Cc.style.right="auto"),t&&Pc.minBtn,sd(n)}catch{}}!function(){try{if(qe(),ot(),it(),sessionStorage.getItem("__xb_need_reload")==="1"){try{sessionStorage.removeItem("__xb_need_reload");sessionStorage.removeItem("__xb_sess");sessionStorage.removeItem(xe);if(De){De.at=null;De.pid=null;De.user=null}}catch(e){}}else{try{/* 1.8.3: F5/eski oturum paneli acmasin — taze giris beklenir */if(De){De.at=null;De.pid=null}sessionStorage.removeItem("__xb_sess");sessionStorage.removeItem(xe);ce.accessToken=null;ce.profileId=null;window.__xbTokenSrc="";window.__xbTokenAt=0}catch(e){}}try{window.addEventListener("message",function(ev){try{if(ev.source!==window)return;var d=ev.data;if(!d||d.__xbAuth!==1||!d.at)return;try{window.__xbTokenSrc="net"}catch(e){}an(String(d.at));try{ld()}catch(e){}}catch(e){}})}catch(e){}try{(function(){/* 1.8.3: restore loop disabled — nick ekraninda eski token panel kurmasin */})()}catch(e){}De.pid&&ce.profileId;const e=!!je,t=!!Fe;if(t)if(kt())if(Te()){un?.("[relogin] UI giris kuyruga alindi");try{vt("UI giris kuyrukta \u2014 oyun yuklenince tiklar","info")}catch{}!function(){if(!kt())return;if(!Fe)return;if(!Te())return un?.("[relogin-ui] panel kapali \u2014 otomatik UI giris atlandi (pending temizlendi)"),void at();const e=Fe,t=()=>{Ut(Fe||e).catch(()=>{})};"loading"===document.readyState?document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{try{const c=document.querySelector("#unity-canvas,canvas");const pw=document.querySelector('input[type="password"]');if(c){const r=c.getBoundingClientRect();if(r.width>=480&&r.height>=320&&!(pw&&pw.getBoundingClientRect().width>40))return}t()}catch{t()}},1500)},{once:!0}):setTimeout(()=>{try{const c=document.querySelector("#unity-canvas,canvas");const pw=document.querySelector('input[type="password"]');if(c){const r=c.getBoundingClientRect();if(r.width>=480&&r.height>=320&&!(pw&&pw.getBoundingClientRect().width>40))return}t()}catch{t()}},1500)}()}else un?.("[relogin] UI pending var ama panel kapali \u2014 temizlendi"),at();else un?.("[relogin] UI pending (iframe gordu, top isleyecek)");if(!e&&!ce.lastRoomPosition||t||setTimeout(()=>{if(ce.accessToken&&ce.lastRoomPosition)try{cs().catch(()=>{})}catch{}},4e3),ce.accessToken||De.rt||t)return un?.("[relogin] oturum hazir"),setTimeout(()=>{try{ld()}catch{}},500),!0}catch{}}(),(function(){try{window.__xbOnGateUnlock=function(){try{ce.accessToken=null;ce.profileId=null;ce.profileName=null;ce.card={faceUrl:null,sc:null,diamond:null,level:null,updatedAt:0};try{if(De){De.at=null;De.pid=null;De.user=null}}catch(e){}try{sessionStorage.removeItem("__xb_sess")}catch(e){}try{sessionStorage.removeItem(xe)}catch(e){}try{sessionStorage.setItem("__xb_need_reload","1")}catch(e){}try{if(Cc){Cc.remove();Cc=null}}catch(e){}try{window.__xbPanel=null}catch(e){}try{ld()}catch(e){}try{Sd()}catch(e){}}catch(e){}}}catch(e){}var __xbPanelMounting=!1;var __xbBootChipShow=function(){try{if(window!==window.top||window.__xbBootChip||Cc)return;var h=document.createElement("div");h.id="xb-boot-chip";h.textContent="Soft";h.setAttribute("aria-hidden","true");h.style.cssText="position:fixed;right:14px;bottom:14px;z-index:2147483646;padding:7px 11px;border-radius:8px;background:rgba(12,12,20,.82);color:#f4f4f8;font:700 12px Outfit,Segoe UI,sans-serif;opacity:.85;pointer-events:none;letter-spacing:.04em";(document.body||document.documentElement).appendChild(h);window.__xbBootChip=h}catch(e){}};var __xbBootChipClear=function(){try{var h=window.__xbBootChip;if(h&&h.parentNode)h.parentNode.removeChild(h);window.__xbBootChip=null}catch(e){}};var __xbTearDownPanel=function(){try{__xbBootChipClear();if(Cc&&Cc.parentNode)try{Cc.parentNode.removeChild(Cc)}catch(e){}Cc=null;try{window.__xbPanel=null}catch(e){}__xbPanelMounting=!1}catch(e){}};var openPanelAfterPlay=function(){try{if(window!==window.top)return;if(Cc){try{__xbBootChipClear()}catch(e){}return}if(__xbPanelMounting)return;if(!window.__xbPlayAt){try{un&&un("[xb] skip mount: no Play yet")}catch(e){}return}if(window.__xbGate&&window.__xbGate.allowed===false){try{window.__xbApplyToolGate&&window.__xbApplyToolGate(window.__xbGate)}catch(e){}return}if(sessionStorage.getItem("__xb_need_reload")==="1"){try{window.__xbApplyToolGate&&window.__xbApplyToolGate({allowed:!0,_askReload:!0})}catch(e){}return}__xbPanelMounting=!0;try{__xbBootChipShow()}catch(e){}try{$d();try{window.__xbPanel=Cc}catch(e){}try{if(Cc){Cc.style.visibility="";Cc.style.opacity="";Cc.style.pointerEvents=""}}catch(e){}try{__xbBootChipClear()}catch(e){}try{window.__xbApplyToolGate&&window.__xbGate&&window.__xbApplyToolGate(window.__xbGate)}catch(e){}try{ld()}catch(e){}}catch(e){__xbPanelMounting=!1}}catch(e){__xbPanelMounting=!1}};try{window.__xbMountPanel=function(){try{if(!window.__xbPlayAt)return;openPanelAfterPlay()}catch(e){}}}catch(e){}var arm=function(){try{if(window!==window.top)return;var started=!1;try{window.addEventListener("message",function(ev){try{if(ev.source!==window)return;var d=ev.data;if(!d||d.__xbPlayNow!==1)return;try{sessionStorage.setItem("__xb_play",String(d.t||Date.now()))}catch(e){}startFromPlay(d.why||"play-msg")}catch(e){}})}catch(e){}var startFromPlay=function(why){try{if(started)return;started=!0;try{window.__xbPlayAt=Date.now()}catch(e){}try{un&&un("[xb] play→panel build ("+(why||"?")+")")}catch(e){}setTimeout(openPanelAfterPlay,10)}catch(e){try{window.__xbPlayAt=Date.now()}catch(x){}setTimeout(openPanelAfterPlay,20)}};try{var pt=0;try{pt=parseInt(sessionStorage.getItem("__xb_play")||"0",10)||0}catch(e){pt=0}if(pt&&Date.now()-pt<180000){startFromPlay("inject-after-play")}}catch(e){}try{window.addEventListener("pagehide",__xbTearDownPanel);window.addEventListener("beforeunload",__xbTearDownPanel)}catch(e){}}catch(e){}};try{if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm,{once:!0});else arm()}catch(e){}})();}();/*__XB_REMOTE_GATE__*/try{(function(){var prevAllowed=null;function panels(){var a=[],seen={};function add(p){if(!p||seen[p])return;seen[p]=1;a.push(p)}try{if(window.__xbPanel)add(window.__xbPanel)}catch(e){}try{document.querySelectorAll("[data-xb-panel='1'],[data-xb-click-sfx='1']").forEach(add)}catch(e){}return a}function hidePanels(){panels().forEach(function(p){try{p.style.setProperty("display","none","important");p.style.setProperty("visibility","hidden","important");p.style.setProperty("pointer-events","none","important");p.setAttribute("data-xb-locked","1")}catch(e){}})}function showPanels(){panels().forEach(function(p){try{if(p.getAttribute("data-xb-closed")==="1")return;p.style.removeProperty("display");p.style.display="flex";p.style.removeProperty("visibility");p.style.removeProperty("pointer-events");p.removeAttribute("data-xb-locked")}catch(e){}})}function paintBox(title,msg,btnText,onBtn){var box=document.getElementById("xb-remote-lock");if(!box){box=document.createElement("div");box.id="xb-remote-lock";box.setAttribute("style","position:fixed;top:16px;right:16px;z-index:2147483647;width:min(360px,calc(100vw - 24px));padding:18px 16px;border-radius:14px;background:rgba(12,12,18,0.96);border:1px solid rgba(251,191,36,0.45);box-shadow:0 16px 40px rgba(0,0,0,.55);font-family:Segoe UI,system-ui,sans-serif;color:#f8fafc;box-sizing:border-box");(document.documentElement||document.body).appendChild(box)}box.textContent="";var a=document.createElement("div");a.setAttribute("style","font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24;margin-bottom:8px");a.textContent="6x0k Space";var b=document.createElement("div");b.setAttribute("style","font-size:15px;font-weight:700;margin-bottom:6px");b.textContent=title;var c=document.createElement("div");c.setAttribute("style","font-size:12.5px;line-height:1.45;color:#cbd5e1;margin-bottom:12px;word-break:break-word");(function fillMsg(el,raw){el.textContent="";var s=String(raw||"");var re=/(https?:\/\/[^\s<>"'`]+)/gi;var last=0,m;while((m=re.exec(s))){if(m.index>last)el.appendChild(document.createTextNode(s.slice(last,m.index)));var link=document.createElement("a");var href=m[1].replace(/[.,);]+$/,"");link.href=href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=href;link.setAttribute("style","color:#fbbf24;text-decoration:underline;cursor:pointer;word-break:break-all");link.addEventListener("click",function(ev){try{ev.stopPropagation()}catch(e){}});el.appendChild(link);if(href.length<m[1].length)el.appendChild(document.createTextNode(m[1].slice(href.length)));last=m.index+m[0].length}if(last<s.length)el.appendChild(document.createTextNode(s.slice(last)));if(!el.childNodes.length)el.textContent=s})(c,msg);box.appendChild(a);box.appendChild(b);box.appendChild(c);if(btnText){var btn=document.createElement("button");btn.type="button";btn.textContent=btnText;btn.setAttribute("style","width:100%;border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827");btn.onclick=function(ev){try{ev.preventDefault();onBtn&&onBtn()}catch(e){}};box.appendChild(btn)}box.style.display="block"}function ensureLock(g){var isUpd=!!(g&&g.reason==="force_update");var title=isUpd?"Guncelleme gerekli":"Bakimda";var openSite=function(){try{window.open("https://github.com/6x0k","_blank","noopener,noreferrer")}catch(e){}};if(isUpd){paintBox(title,String((g&&g.message)||""),"cleaned by 6x0k",openSite);try{var box=document.getElementById("xb-remote-lock");if(box){box.style.cursor="pointer";box.onclick=function(ev){try{var t=ev&&ev.target;if(t&&t.closest&&t.closest("a,button"))return;openSite()}catch(e){openSite()}}}}catch(e){}}else{paintBox(title,String((g&&g.message)||""),null,null);try{var box2=document.getElementById("xb-remote-lock");if(box2){box2.style.cursor="";box2.onclick=null}}catch(e){}}}function ensureReloadAsk(){paintBox("Bakim bitti","Panelin temiz baslamasi icin oyunu yenilemen gerekiyor.","Oyunu yenile (F5)",function(){try{sessionStorage.setItem("__xb_need_reload","1")}catch(e){}try{location.reload()}catch(e){}})}function apply(g){var ask=!!(g&&g._askReload);var allowed=!g||g.allowed!==false;try{window.__xbGate=g||null}catch(e){}if(ask){hidePanels();ensureReloadAsk();prevAllowed=true;return}if(!allowed){hidePanels();ensureLock(g);prevAllowed=false;try{sessionStorage.removeItem("__xb_need_reload")}catch(e){}return}if(prevAllowed===false){try{window.__xbOnGateUnlock&&window.__xbOnGateUnlock()}catch(e){}hidePanels();ensureReloadAsk();prevAllowed=true;return}try{var box=document.getElementById("xb-remote-lock");if(box)box.style.display="none"}catch(e){}if(sessionStorage.getItem("__xb_need_reload")==="1"){ensureReloadAsk();return}showPanels();prevAllowed=true}window.__xbApplyToolGate=apply;window.addEventListener("message",function(ev){try{var d=ev&&ev.data;if(!d||d.__xbToolGate!==1)return;apply(d.gate)}catch(e){}});setInterval(function(){try{var g=window.__xbGate;if(g&&g.allowed===false){hidePanels();ensureLock(g);return}if(sessionStorage.getItem("__xb_need_reload")==="1"){hidePanels();ensureReloadAsk()}}catch(e){}},800)})()}catch(e){}/*__XB_REMOTE_GATE_END__*/

