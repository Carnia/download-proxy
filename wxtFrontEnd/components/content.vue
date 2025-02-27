<template>
  <div class="content_wrapper" v-show="books.length" ref="dragElement">
    <h3>z-Library远程下载插件</h3>
    <br>
    <div>选择目标文件：</div>
    <el-radio-group v-model="picked">
      <el-radio v-for="book in books" :key="book.href" :value="book.href" size="large">{{ book.extension }} {{
        book.filesizeString }}
      </el-radio>
    </el-radio-group>
    <div style="text-align: center">
      <el-button type="primary" :loading="downloadLoading" @click="doDownload">
        远程下载
      </el-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

import { getConfig, initCookie, isCookieOk } from "@/util";
import { ElMessage } from "element-plus";

const picked = ref("");
const books = ref<
  {
    href: string;
    extension: string;
    filesizeString: string;
  }[]
>([]);
const downloadLoading = ref(false);

// 新增拖动相关逻辑
const dragElement = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const currentX = ref(140); // 初始top值
const currentY = ref(20); // 初始right值

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  startX.value = e.clientX;
  startY.value = e.clientY;
  document.body.classList.add('no-select');
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;

  const dx = e.clientX - startX.value;
  const dy = e.clientY - startY.value;

  if (dragElement.value) {
    currentX.value = currentX.value + dy;
    currentY.value = currentY.value - dx;
    dragElement.value.style.cssText = `
      top: ${currentX.value}px;
      right: ${currentY.value}px;
    `;

    startX.value = e.clientX;
    startY.value = e.clientY;
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
  document.body.classList.remove('no-select');
};

const loadFirstData = () => {
  const pageBtn: any = document.querySelector(".addDownloadedBook");
  books.value = [
    {
      href: pageBtn.href,
      extension: pageBtn.innerText,
      filesizeString: "",
    },
  ];
  picked.value = pageBtn.href;
};
const loadRestData = () => {
  const regex = /^\/book\/([^/]+)/; // 正则表达式

  const match = location.pathname.match(regex); // 使用 match() 方法提取匹配的内容
  let bookId;
  if (match) {
    bookId = match[1]; // match[1] 是捕获组中第一个匹配的内容，即 id1
  } else {
    return;
  }
  const resourceUrl = `/papi/book/${bookId}/formats`;
  return fetch(resourceUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.success === 1) {
        books.value.push(...data.books);
      }
    });
};

const doDownload = async () => {
  const config = await getConfig();
  if (!config) {
    return;
  }
  const {
    urlString,
    apiKey,
    savePath,
    cookieString: configuredCookie,
  } = config;
  if (!urlString) {
    ElMessage({
      type: "info",
      message: "请点击插件图标补充服务端url后使用",
    });
    return;
  }

  // 优先使用配置的cookie，如果未配置则获取当前页面的cookie
  const webCookie = document.cookie;
  const cookie = configuredCookie || webCookie;
  if (!isCookieOk(cookie)) {
    ElMessage({
      type: "info",
      message: "请点击插件图标补充cookie，或者在当前页登录",
    });
    return;
  }
  downloadLoading.value = true;

  // 发送请求到后台脚本
  browser.runtime.sendMessage(
    {
      action: "sendRequest",
      url: `${urlString}?url=${encodeURIComponent(
        picked.value
      )}&api_key=${apiKey}&save_path=${savePath}&cookie=${encodeURIComponent(
        cookie
      )}`,
    },
    (response) => {
      if (response.error) {
        ElMessage({
          type: "error",
          message: "请求失败: " + response.error,
        });
      } else {
        ElMessage({
          type: "success",
          message: "响应: " + response.data,
        });
      }
      downloadLoading.value = false;
    }
  );
};
onMounted(async () => {

  // 保留原有初始化代码
  if (dragElement.value) {
    dragElement.value.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  await initCookie();
  loadFirstData();
  await loadRestData();
});
onUnmounted(() => {
  if (dragElement.value) {
    dragElement.value.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
});
</script>

<style scoped>
.content_wrapper {
  position: fixed;
  top: 140px;
  right: 20px;
  width: 200px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  text-align: left;
  z-index: 10000;
  cursor: move;
}

.content_wrapper :deep(.el-radio-group) {
  margin: 0;
  display: block;
}

.content_wrapper :deep(.el-radio) {
  margin: 0;
  display: flex;
  align-items: center;
  border-radius: 4px;
}

.content_wrapper :deep(.el-radio):hover {
  background-color: #defeff;
}
</style>
