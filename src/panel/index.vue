<template>
  <div class="panel">
    <CCSection name="xxtea">
      <CCProp name="xxtea key" :tooltip="xxtea_key_tips">
        <CCInput v-model:value="xxtea_key" @change="onChangeXXTeaKey"></CCInput>
      </CCProp>
      <CCProp name="libcocos2djs.so" tooltip="从so文件中检索出来xxtea_key">
        <div style="flex: 1"></div>
        <CCButton @click="onUploadSo">...</CCButton>
      </CCProp>
    </CCSection>
    <CCSection name="加密">
      <CCProp name="zip" tooltip="压缩代码" align="left">
        <CCCheckBox v-model:value="encode_zip" @change="onChangeEncodeZip"> </CCCheckBox>
      </CCProp>
      <div style="display: flex; flex-direction: row">
        <div style="flex: 1"></div>
        <CCButton @click="onClickBtnEncode">
          <i class="iconfont icon_js" style="color: rgb(0, 255, 0)"></i>
        </CCButton>
      </div>
    </CCSection>
    <CCSection name="解密" style="flex: 1; display: flex; flex-direction: column">
      <CCProp name="jsc文件">
        <CCInput v-model:value="codeFileName" :readonly="true"></CCInput>
        <CCButton @click="onClickBtnDecode"><i class="iconfont icon_js" style="color: rgb(255, 97, 97)"></i></CCButton>
      </CCProp>
      <div class="decode" @drop.prevent="drop" @dragover.prevent.stop @dragenter.prevent.stop @dragleave.prevent>
        <div v-show="!decodeSuccess">拖拽jsc文件解密</div>
        <div v-show="decodeSuccess" ref="codeDivElement" class="code"></div>
      </div>
    </CCSection>
  </div>
</template>
<script lang="ts">
import { defineComponent, onMounted, ref, provide, nextTick, toRaw } from "vue";
import PluginConfig from "../../cc-plugin.config";
import ccui from "@xuyanfeng/cc-ui";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import * as monaco from "monaco-editor";
import { encrypt, toString, decrypt, toBytes, encryptToString, decryptToString } from "xxtea-node";
import { createHash } from "crypto";
import pako from "pako";
import { Drop, Accept } from "cc-plugin/src/ccp/util/drop";
import { Download } from "cc-plugin/src/ccp/util/download";
import CCP from "cc-plugin/src/ccp/entry-main";
import { Profile } from "cc-plugin/src/ccp/profile";
import { Buffer } from "buffer";
interface ISaveData {
  xxtea_key: string;
  encode_zip: boolean;
}
const { CCInput, CCButton, CCProp, CCCheckBox, CCSection } = ccui.components;
export default defineComponent({
  name: "index",
  components: { CCButton, CCProp, CCInput, CCCheckBox, CCSection },
  setup(props, { emit }) {
    const profile = new Profile();
    profile.init({}, PluginConfig);
    const data = profile.load("jsc-tools.json") as ISaveData;
    function saveConfig() {
      data.xxtea_key = toRaw(xxtea_key.value);
      data.encode_zip = toRaw(encode_zip.value);
      profile.save(data);
    }
    let textEditor: monaco.editor.IStandaloneCodeEditor | null;
    onMounted(() => {
      if (codeDivElement.value) {
        textEditor = monaco.editor.create(codeDivElement.value, {
          model: null,
          automaticLayout: true,
          minimap: {
            enabled: false,
          },
        });
        textEditor.setModel(monaco.editor.createModel("", "javascript"));
        textEditor.addAction({
          id: "download",
          label: "download",
          contextMenuGroupId: "my", // 将此动作添加到导航组
          run(editor: monaco.editor.ICodeEditor, uri: monaco.Uri) {
            const a = toRaw(codeFileName.value);
            // const a = uri.path;
            const name = basename(a, extname(a));
            const filename = `${name}.js`;
            const code = editor.getValue();
            Download.downloadFile(filename, code);
          },
        });
      }
    });
    const codeDivElement = ref<HTMLDivElement>();
    const xxtea_key = ref(data.xxtea_key || "fishf00a-684a-48");

    function md5(file: string) {
      const data = readFileSync(file);
      const md5 = createHash("md5");
      return md5.update(data).digest("hex");
    }
    function xxteaKeyBytes() {
      const v = toRaw(xxtea_key.value);
      return toBytes(v);
    }
    function isGZipBuffer(data: Uint8Array) {
      // zip的前两位是标志位
      return data[0] == 0x1f && data[1] == 0x8b;
    }
    function decodeJSC(data: ArrayBuffer): string | null {
      const bytes = xxteaKeyBytes();
      const u8 = new Uint8Array(data);
      let code = decrypt(u8, bytes);
      if (code) {
        if (isGZipBuffer(code)) {
          code = pako.inflate(code);
        }
        code = toString(code);
        return code;
      }
      return null;
    }
    function doDecode(name: string, data: ArrayBuffer) {
      const ret = decodeJSC(data);
      if (ret === null) {
        codeFileName.value = "";
        decodeSuccess.value = false;
        textEditor?.setValue("");
        CCP.Adaptation.Dialog.message({
          message: "解密失败, xxtea key无效",
        });
      } else {
        codeFileName.value = name;
        decodeSuccess.value = true;
        // 设置textEditor的Uri,不能设置2次，否则会报错
        // const uri = monaco.Uri.file(name);
        // textEditor.setModel(monaco.editor.createModel(ret, "javascript", uri));
        textEditor?.setValue(ret);
      }
    }
    const decodeSuccess = ref<boolean>(false);
    const codeFileName = ref("");
    const encode_zip = ref(!!data.encode_zip);
    function findKeyFromSo(buffer: ArrayBuffer) {
      let ret = "";
      const u8 = new Uint8Array(buffer);
      // 从u8里面找到 Cocos Game 字符串
      const flag = "Cocos Game";
      for (let i = 0; i < u8.length - flag.length; ++i) {
        // 从i开始，往后找flag.length个字节，并且和flag一致
        let idx = 0;
        while (idx < flag.length && u8[i + idx] === flag.charCodeAt(idx)) {
          idx++;
        }
        if (idx === flag.length) {
          // find it
          const flagBuffer = new Uint8Array(flag.length);
          for (let index = 0; index < flag.length; ++index) {
            flagBuffer[index] = u8[index + i];
          }
          const str = Buffer.from(flagBuffer).toString();
          // console.log(str);

          const data = [];
          let offset = flag.length + i;
          // 找到不是0的开头
          let beginValue = u8[offset];
          while ((beginValue = u8[offset]) === 0) {
            offset++;
          }
          // 找到结尾是0的就结束
          do {
            data.push(beginValue);
            offset++;
          } while ((beginValue = u8[offset]) !== 0);

          // const defaultXxteaKeyLen = 16 + 2; // 前后有0
          // for (let idx = 0; idx < defaultXxteaKeyLen; ++idx) {
          //   const value = u8[idx + offset];
          //   if (value !== 0) {
          //     // 过滤掉前后的0
          //     data.push(value);
          //   }
          // }
          const xxtea_key_buffer = new Uint8Array(data);
          ret = Buffer.from(xxtea_key_buffer).toString().trim();
          // console.log(ret);
          break;
        }
      }
      return ret;
    }
    const xxtea_key_tips = ref("");
    function updateKeyTips() {
      xxtea_key_tips.value = `一般是16位，当前${xxtea_key.value.length}位`;
    }
    updateKeyTips();
    return {
      xxtea_key_tips,
      encode_zip,
      codeFileName,
      xxtea_key,
      decodeSuccess,
      codeDivElement,
      onChangeXXTeaKey() {
        saveConfig();
        updateKeyTips();
      },
      async onUploadSo() {
        const ret = await CCP.Adaptation.Dialog.select({
          title: "请选择文件",
          type: "file",
          multi: false,
          filters: [{ name: "so", extensions: [".so"] }],
        });
        const keys = Object.keys(ret);
        if (keys.length > 0) {
          const file = keys[0];
          const info = [];
          if (file.toLowerCase().indexOf("cocos") === -1) {
            info.push(`${file} is not cocos so`);
          }
          const fileData = ret[file];
          // 有50M的限制
          if (fileData.byteLength > 50 * 1024 * 1024) {
          }
          const key = findKeyFromSo(fileData);
          if (key) {
            if (key.startsWith("0.0.0.0")) {
              info.push(`未找到xxtea密钥, so可能没有使用xxtea加密`);
            } else {
              xxtea_key.value = key;
              updateKeyTips();
              info.push(`找到xxtea密钥: ${key}`);
            }
          } else {
            info.push("未找到xxtea密钥");
          }
          CCP.Adaptation.Dialog.message({ message: info.join("\n") });
        }
      },
      onChangeEncodeZip() {
        saveConfig();
      },
      drop(event: DragEvent) {
        const drop = new Drop({
          multi: false,
          accept: [Accept.JSC, Accept.JS],
          jsc(name: string, data: ArrayBuffer) {
            doDecode(name, data);
          },
        });
        drop.onWeb(event);
      },
      async onClickBtnEncode() {
        const ret = await CCP.Adaptation.Dialog.select({
          title: "请选择文件",
          type: "file",
          multi: false,
          filters: [{ name: "js", extensions: [".js"] }],
        });
        const keys = Object.keys(ret);
        if (keys.length > 0) {
          const file = keys[0];
          let fileData = ret[file];
          if (!fileData) {
            CCP.Adaptation.Dialog.message({ message: `${file} 数据为空` });
            return;
          }
          const name = basename(file, extname(file));
          const newFile = `${name}.jsc`;
          if (encode_zip.value) {
            fileData = pako.gzip(fileData);
            fileData[9] = 10; // os 标志位
          }
          const en_data = encrypt(fileData, xxteaKeyBytes());
          if (en_data) {
            Download.downloadBlobFile(newFile, new Blob([en_data], { type: "application/octet-stream" }));
          } else {
            CCP.Adaptation.Dialog.message({ message: "加密失败" });
          }
        }
      },
      async onClickBtnDecode() {
        console.log("decode");
        const ret = await CCP.Adaptation.Dialog.select({
          title: "请选择文件",
          type: "file",
          multi: false,
          filters: [{ name: "jsc", extensions: [".jsc"] }],
        });
        const keys = Object.keys(ret);
        if (keys.length > 0) {
          const file = keys[0];
          const fileData = ret[file];
          if (!fileData) {
            CCP.Adaptation.Dialog.message({ message: `${file} 数据为空` });
            return;
          }
          doDecode(file, fileData);
        }

        // const file = join(__dirname, "../../../build/jsb-link/assets/internal/index.jsc");
        // if (!existsSync(file)) {
        //   return;
        // }
        // const data = readFileSync(file);
      },
    };
  },
});
</script>

<style scoped lang="less">
.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;

  .decode {
    flex: 1;
    box-sizing: border-box;
    border: 1px solid #a1a1a1;
    display: flex;
    flex-direction: row;
    align-content: center;
    justify-content: center;
    align-items: center;
    margin: 3px;

    .code {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
