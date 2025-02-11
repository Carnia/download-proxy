# 文件下载服务器

在服务器上部署一个文件下载服务，通过接口告知服务器要下载的内容，下载目的地是服务器。

配合浏览器插件 + talebook + zlibrary，可以实现快速下书到服务器

## Docker 部署说明
1. 运行 Docker 容器
构建完镜像后，使用以下命令运行 Docker 容器：

```bash
docker run -d -p 8080:8080 --name download-proxy xlqdys/download-proxy
```
- -d：让容器在后台运行。
- -p 8080:8080：将容器内的 8080 端口映射到主机的 8080 端口。
- --name download-proxy：为容器指定一个名字。
如果您需要自定义保存路径或 API 密钥，可以通过 -e 参数设置环境变量：

```bash
docker run -d -p 8080:8080 \
  -e DEFAULT_SAVE_PATH="/path/to/save" \
  -e API_KEY="your_api_key" \
  --name download-proxy \
  xlqdys/download-proxy
```
2. 访问文件下载服务
在容器启动后，您可以通过以下 URL 访问文件下载服务：
`http://<docker_host_ip>:8080/download?url=<file_url>&cookie=<cookie_value>&savePath=<save_path>&api_key=<api_key>
`

其中：
- url：文件的下载 URL（必填）。
- cookie：请求时需要使用的 Cookie（必填）。
- savePath：文件保存路径（可选，默认为环境变量 DEFAULT_SAVE_PATH 或 /tmp/downloads）。
- api_key：API 密钥（可选，如果启用了 API 密钥验证）。
示例：
```bash
http://127.0.0.1:8080/download?url=https://example.com/file.zip&cookie=mycookie&savePath=/tmp/downloads&api_key=myapikey
```
3. 停止和删除容器
若需要停止并删除容器，可以使用以下命令：

```bash
docker stop download-proxy
docker rm download-proxy
```
5. 清理未使用的镜像
如果不再需要该镜像，可以使用以下命令删除镜像：

```bash
docker rmi download-proxy
```