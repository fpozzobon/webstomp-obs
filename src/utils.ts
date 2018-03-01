import Frame from './frame';

// Define constants for bytes used throughout the code.
export const BYTES = {
    // LINEFEED byte (octet 10)
    LF: '\x0A',
    // NULL byte (octet 0)
    NULL: '\x00'
};

// utility function to trim any whitespace before and after a string
export const trim = (str: string) => str.replace(/^\s+|\s+$/g, '');

// from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
export function unicodeStringToTypedArray(s: string): Uint8Array {
    let escstr: string = encodeURIComponent(s);
    let binstr: string = escstr.replace(/%([0-9A-F]{2})/g, (match: any, p1: any) => String.fromCharCode(('0x' + p1) as any));
    let arr = Array.prototype.map.call(binstr, (c: string) => c.charCodeAt(0));
    return new Uint8Array(arr);
}

// from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
export function typedArrayToUnicodeString(ua: any): string {
    let binstr = String.fromCharCode(...ua);
    let escstr = binstr.replace(/(.)/g, function(m, p) {
        let code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
            code = '0' + code;
        }
        return '%' + code;
    });
    return decodeURIComponent(escstr);
}

// Compute the size of a UTF-8 string by counting its number of bytes
// (and not the number of characters composing the string)
export function sizeOfUTF8(s: string): number {
    if (!s) return 0;
    return encodeURIComponent(s).match(/%..|./g).length;
}

export const parseData = (data: any, partialData: any, hearbeatMsg: string) => {
    if (data instanceof ArrayBuffer) {
        data = typedArrayToUnicodeString(new Uint8Array(data))
    }

    // heartbeat
    if (data === hearbeatMsg) {
        logger.debug(`<<< PONG`);
        return;
    }
    logger.debug(`<<< ${data}`);
    // Handle STOMP frames received from the server
    // The unmarshall function returns the frames parsed and any remaining
    // data from partial frames are buffered.
    const unmarshalledData = Frame.unmarshall(partialData + data);

    return unmarshalledData;
}

export class Log  {

    hasDebug: boolean = false;

    public setDebug = (_hasDebug: boolean) => {
        this.hasDebug = _hasDebug;
    }

    public debug = (message: any, ...args: any[]) => {
        if (this.hasDebug) console.log(message, ...args);
    }

}

const logger = new Log();
export { logger };
