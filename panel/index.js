const { readFileSync, existsSync, writeFileSync } = require("fs");
const { join, dirname } = require("path");
const {
  encrypt,
  toString,
  decrypt,
  toBytes,
  encryptToString,
  decryptToString,
} = require("xxtea-node");
const { createHash } = require("crypto");
const KEY = "fishf00a-684a-48";
const key_bytes = toBytes(KEY);
Editor.Panel.extend({
  style: readFileSync(join(__dirname, "index.css"), "utf-8"),
  template: readFileSync(join(__dirname, "index.html"), "utf-8"),
  $: {},

  ready() {
    new Vue({
      el: this.shadowRoot,
      data: {},
      created() {
        console.log("created");
      },
      methods: {
        onClickEncode() {
          console.log("encode");
          // const en_code = encrypt(u8, key_bytes);// uint8array
        },
        onClickDecode() {
          console.log("decode");
          debugger;
          const file = join(
            __dirname,
            "../../../build/jsb-link/assets/internal/index.jsc"
          );

          if (!existsSync(file)) {
            return;
          }
          const data = readFileSync(file);
          const code = encrypt(data, key_bytes);
          if (code) {
            const newFile = dirname(file) + "/index.js";
            writeFileSync(newFile, code);
            console.log("decode success: ", toString(code));
          }
        },
      },
    });
  },

  messages: {},
});
