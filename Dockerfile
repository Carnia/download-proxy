# 使用官方的 Python 3.9 镜像作为基础镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 将当前目录下的所有文件复制到容器的 /app 目录
COPY ./download_server.py /app

# 安装依赖（requests 库）
RUN pip install --no-cache-dir requests

# 暴露服务端运行的端口
EXPOSE 8080

# 设置环境变量（默认保存路径）
ENV DEFAULT_SAVE_PATH=/app/downloads

# 启动服务端
CMD ["python3", "download_server.py"]