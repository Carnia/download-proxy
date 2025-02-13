# 第一阶段：构建阶段
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY ./node/package*.json ./

# 安装依赖
RUN npm install --production

# 复制应用程序代码
COPY ./node .

# 第二阶段：运行阶段
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 从构建阶段复制依赖和应用程序代码
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app ./

# 设置环境变量
ENV PORT=8080
ENV DEFAULT_SAVE_PATH=./download

# 暴露端口
EXPOSE 8080

# 启动应用程序
CMD ["node", "index.js"]