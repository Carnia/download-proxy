# zlibrary文件下载服务器

https://github.com/Carnia/download-proxy

在服务器上部署一个文件下载服务，通过接口告知服务器要下载的内容，下载目的地是服务器。

配合浏览器插件 + talebook + zlibrary，可以实现快速下书到服务器

## Docker 部署说明
1. 运行 Docker 容器
构建完镜像后，使用docker compose运行 Docker 容器：
`docker-compose.yml:`
```yml
services:
  # 远程下载zlibrary书籍能力
  download-proxy:  # 服务名称
    image: xlqdys/download-proxy # 使用的镜像名称
    container_name: download-proxy  # 容器名称
    ports:
      - "8080:8080"  # 将容器的 8080 端口映射到主机的 8080 端口
    volumes:
      - /mnt/media/talebookData/books/imports:/app/downloads  # 挂载宿主机的目录到容器内
    environment:
      - API_KEY=123456 #如果配置了秘钥，则请求接口时要加上api-key参数
    restart: always  # 容器意外停止时自动重启
```

`包含talebook的docker-compose.yml:`

```yml
services:
  talebook:
    restart: always
    image: talebook/talebook:latest
    volumes:
      - /mnt/media/talebookData:/data
    ports:
      - "6080:80"
      - "6443:443"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Shanghai
      - SSR=OFF
    depends_on:
      - douban-rs-api

  # optional, for meta plugins
  # please set "http://douban-rs-api" in settings
  douban-rs-api:
    restart: always
    image: ghcr.nju.edu.cn/cxfksword/douban-api-rs

  # 远程下载zlibrary书籍能力
  download-proxy:  # 服务名称
    image: xlqdys/download-proxy # 使用的镜像名称
    container_name: download-proxy  # 容器名称
    ports:
      - "8080:8080"  # 将容器的 8080 端口映射到主机的 8080 端口
    volumes:
      - /mnt/media/talebookData/books/imports:/app/downloads  # 挂载宿主机的目录到容器内
    environment:
      - API_KEY=106
    restart: always  # 容器意外停止时自动重启
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

## 浏览器插件部署说明
- 下载浏览器插件文件：https://github.com/Carnia/download-proxy/tree/main/chromeExt
- 在浏览器中加载插件

![demo](https://github.com/Carnia/download-proxy/blob/main/picture/demo.jpg)