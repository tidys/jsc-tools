const { join, readFileSync } = require("fs");
const {} = require("path");
Editor.Panel.extend({
  style: readFileSync(join(__dirname, "index.css"), "utf-8"),
  template: readFileSync(join(__dirname, "index.html"), "utf-8"),
  $: {},

  ready() {
    new VTTCue({
      el: this.shadowRoot,
      data: {},
      created() {
        console.log("created");
      },
      methods: {},
    });
  },

  messages: {},
});
