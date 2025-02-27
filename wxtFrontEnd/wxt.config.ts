import { defineConfig } from 'wxt';

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'z-Library远程下载插件',
    permissions: [
      "activeTab",
      "cookies",
      "storage",
      "scripting"
    ],
    "host_permissions": [
      "<all_urls>"
    ],
  },
  vite: () => {
    return {
      plugins: [
        AutoImport({
          resolvers: [ElementPlusResolver()],
        }),
        Components({
          resolvers: [ElementPlusResolver()],
        }),
      ],
    }
  }
});
