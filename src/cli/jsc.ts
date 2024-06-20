import { encrypt, toString, decrypt, toBytes, encryptToString, decryptToString } from "xxtea-node";
import pako from "pako";
import { existsSync, readFileSync } from "fs";

export class JSC {
  private xxtea_key: string;
  constructor(xxtea_key: string) {
    this.xxtea_key = xxtea_key;
  }
  decodeJSCFile(file: string): string | null {
    if (!existsSync(file)) {
      throw new Error(`file not exists: ${file}`);
    }
    const data = readFileSync(file);
    return this.decodeJSC(data);
  }
  decodeJSC(data: ArrayBuffer): string | null {
    const bytes = JSC.xxteaKeyBytes(this.xxtea_key);
    const u8 = new Uint8Array(data);
    let code = decrypt(u8, bytes);
    if (code) {
      if (this.isGZipBuffer(code)) {
        code = pako.inflate(code);
      }
      code = toString(code);
      return code;
    }
    return null;
  }
  private isGZipBuffer(data: Uint8Array) {
    // zip的前两位是标志位
    return data[0] == 0x1f && data[1] == 0x8b;
  }
  public static xxteaKeyBytes(key: string) {
    return toBytes(key);
  }
}
