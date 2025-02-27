
import Content from "@/components/content.vue";
import { createApp } from "vue";
import "element-plus/theme-chalk/el-button.css";
import "element-plus/theme-chalk/el-message.css";
import "element-plus/theme-chalk/el-message-box.css";
// entrypoints/example-ui.content.ts
export default defineContentScript({
  "matches": ["*://*/book*"],

  main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        // Append children to the container
        const dom = document.createElement('div');
        const vueApp = createApp(Content);
        container.append(dom);
        vueApp.mount(dom);
      },
    });

    // // Re-mount when page changes
    // ctx.addEventListener(window, "wxt:locationchange", (event) => {
    //   ui.mount();
    // });
    // Call mount to add the UI to the DOM
    ui.mount();
  },
});