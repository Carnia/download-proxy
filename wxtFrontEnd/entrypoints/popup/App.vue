<template>
  <div class="popup_wrapper">
    <div style="font-size: 20px; margin-bottom: 10px">
      此插件仅用于z-library的<b>书籍详情页</b>
    </div>
    <div>
      服务端需要自行部署：见
      <a href="https://hub.docker.com/r/xlqdys/download-proxy" target="_blank">
        https://hub.docker.com/r/xlqdys/download-proxy
      </a>
    </div>
    <h2>配置项</h2>
    <el-form ref="ruleFormRef" :rules="rules" :model="form" label-width="auto">
      <el-form-item label="服务端接口地址" prop="urlString" required>
        <el-input v-model="form.urlString" clearable placeholder="输入接口地址" />
      </el-form-item>
      <el-form-item label="服务端API Key" prop="apiKey">
        <el-input v-model="form.apiKey" clearable placeholder="可选，按需输入" />
      </el-form-item>
      <el-form-item label="服务端保存路径" prop="savePath">
        <el-input v-model="form.savePath" clearable placeholder="可选，按需输入" />
      </el-form-item>
      <el-form-item label="cookie" prop="cookieString">
        <el-input v-model="form.cookieString" type="textarea" clearable placeholder="可选，如果你已登陆z-library，将自动填充，无需手动填写" />
      </el-form-item>
      <div style="text-align: center">
        <el-button type="primary" @click="onSubmit(ruleFormRef)">保存配置</el-button>
      </div>
    </el-form>
  </div>
</template>
<script lang="ts" setup>
import { ElMessage, FormInstance, FormRules } from "element-plus";
import "element-plus/theme-chalk/el-message.css";
const ruleFormRef = ref<FormInstance>();
type RuleForm = {
  urlString?: string;
  apiKey?: string;
  savePath?: string;
  cookieString?: string;
};
const form = reactive<RuleForm>({
  urlString: undefined,
  apiKey: "",
  savePath: "",
  cookieString: "",
});
const rules = reactive<FormRules<RuleForm>>({
  urlString: [
    { required: true, message: "请输入服务器接口地址", trigger: "change" },
  ],
});
const onSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(async (valid, fields) => {
    if (valid) {
      await storage.setItem("local:config", form);
      ElMessage({
        type: "info",
        message: "配置保存成功，请打开书籍详情页操作",
        onClose: () => {
          window.close();
        }
      });
    } else {
      console.log("error submit!", fields);
    }
  });
};
onMounted(async () => {
  const config = await storage.getItem<typeof form>("local:config");
  if (config) {
    form.urlString = config.urlString;
    form.apiKey = config.apiKey;
    form.savePath = config.savePath;
    form.cookieString = config.cookieString;
  }
});
</script>

<style scoped>
.popup_wrapper {
  width: 350px;
}
</style>
