<template>
  <div class="panel">
    <CCProp name="xxtea key" tooltip="一般是16位">
      <CCInput v-model:value="xxtea_key"></CCInput>
    </CCProp>
    <CCSection name="加密">
      <CCProp name="zip" tooltip="压缩代码" align="left">
        <CCCheckBox v-model:value="encode_zip"> </CCCheckBox>
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
        <CCInput v-model:value="codeFileName"></CCInput>
        <CCButton @click="onClickBtnDecode"><i class="iconfont icon_js" style="color: rgb(255, 97, 97)"></i></CCButton>
      </CCProp>
      <div class="decode" @drop.prevent="drop" @dragover.prevent.stop @dragenter.prevent.stop @dragleave.prevent>
        <div v-show="!decodeSuccess">拖拽jsc文件解密</div>
        <div v-show="decodeSuccess" ref="code" class="code"></div>
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

const { CCInput, CCButton, CCProp, CCCheckBox, CCSection } = ccui.components;
export default defineComponent({
  name: "index",
  components: { CCButton, CCProp, CCInput, CCCheckBox, CCSection },
  setup(props, { emit }) {
    let textEditor: monaco.editor.IStandaloneCodeEditor | null;
    onMounted(() => {
      if (code.value) {
        textEditor = monaco.editor.create(code.value, {
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
            const name = basename(uri.path, extname(uri.path));
            const filename = `${name}.js`;
            const code = editor.getValue();
            Download.downloadFile(filename, code);
          },
        });
      }
    });
    const code = ref<HTMLDivElement>();
    const xxtea_key = ref("fishf00a-684a-48");

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
        // 设置textEditor的Uri
        const uri = monaco.Uri.file(name);
        textEditor.setModel(monaco.editor.createModel(ret, "javascript", uri));
        textEditor?.setValue(ret);
      }
    }
    const decodeSuccess = ref<boolean>(false);
    const codeFileName = ref("");
    const encode_zip = ref(true);
    return {
      encode_zip,
      codeFileName,
      xxtea_key,
      decodeSuccess,
      code,
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
