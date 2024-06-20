import { existsSync, writeFileSync } from "fs";
import { JSC } from "./jsc";
import { basename, join } from "path";

const { argv } = process;

if (argv.length !== 4) {
  console.log("Usage: jsc.js <xxtea_key> <jsc_file>");
  process.exit(1);
}

try {
  const xxtea_key = argv[2];
  const file = argv[3];
  const jsc = new JSC(xxtea_key);
  const data = jsc.decodeJSCFile(file);
  if (data) {
    const out = join(process.cwd(), `${basename(file, ".jsc")}.js`);
    console.log(`decode success: ${out}`);
    writeFileSync(out, data);
  } else {
    console.log("decode failed");
  }
} catch (e: any) {
  console.log(e.message);
}
