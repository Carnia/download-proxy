import os
import requests
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
import re
import time

# 从环境变量中读取默认的保存路径，如果未设置则使用默认值
DEFAULT_SAVE_PATH = os.getenv('DEFAULT_SAVE_PATH', '/tmp/downloads')

# 从环境变量中读取 API Key，如果未设置则为 None（表示不校验）
API_KEY = os.getenv('API_KEY', None)

# 请求频率限制：每个 IP 地址每分钟最多允许 15 次请求
RATE_LIMIT = 15
RATE_LIMIT_WINDOW = 60  # 60 seconds

# 用于存储每个 IP 地址的请求次数和时间戳
request_counts = {}

def get_filename_from_response(response, url):
    """
    从响应头或 URL 中提取文件名。
    """
    # 1. 尝试从 Content-Disposition 头中获取文件名
    content_disposition = response.headers.get('Content-Disposition')
    if content_disposition:
        # 匹配 filename="filename.ext" 或 filename=filename.ext
        match = re.search(r'filename\*?=["\']?(?:UTF-\d[\'"]*)?([^"\';]*)', content_disposition)
        if match:
            return match.group(1).strip()

    # 2. 如果 Content-Disposition 头不存在，则从 URL 中提取文件名
    filename = os.path.basename(urlparse(url).path)
    if filename:
        return filename

    # 3. 如果以上方法都失败，则使用默认文件名
    return 'downloaded_file'

class DownloadHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 解析URL路径和查询参数
        parsed_path = urlparse(self.path)
        if parsed_path.path != '/download':
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
            return

        query_params = parse_qs(parsed_path.query)
        url = query_params.get('url', [None])[0]
        cookie = query_params.get('cookie', [None])[0]
        save_path = query_params.get('save_path', [DEFAULT_SAVE_PATH])[0]
        api_key = query_params.get('api_key', [None])[0]

        # 如果部署时提供了 API_KEY，则进行校验
        if API_KEY is not None and api_key != API_KEY:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'Invalid API Key')
            return

        # 请求频率限制
        client_ip = self.client_address[0]
        current_time = time.time()

        if client_ip in request_counts:
            # 如果当前时间与上一次请求的时间差超过时间窗口，则重置计数器
            if current_time - request_counts[client_ip]['timestamp'] > RATE_LIMIT_WINDOW:
                request_counts[client_ip] = {'count': 1, 'timestamp': current_time}
            else:
                request_counts[client_ip]['count'] += 1
                # 如果请求次数超过限制，则返回 429 错误
                if request_counts[client_ip]['count'] > RATE_LIMIT:
                    self.send_response(429)
                    self.end_headers()
                    self.wfile.write(b'Too Many Requests')
                    return
        else:
            # 如果是新 IP 地址，初始化计数器
            request_counts[client_ip] = {'count': 1, 'timestamp': current_time}

        if not url or not cookie:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing required parameters: url and cookie')
            return

        # 创建保存目录（如果不存在）
        if not os.path.exists(save_path):
            os.makedirs(save_path)

        # 下载文件
        try:
            headers = {'Cookie': cookie}
            response = requests.get(url, headers=headers, allow_redirects=True)
            response.raise_for_status()

            # 获取文件名
            filename = get_filename_from_response(response, url)

            # 保存文件
            file_path = os.path.join(save_path, filename)
            with open(file_path, 'wb') as f:
                f.write(response.content)

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Download successful')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Download failed: {str(e)}'.encode())

def run(server_class=HTTPServer, handler_class=DownloadHandler, port=8080):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Starting server on port {port}...')
    print(f'Default save path: {DEFAULT_SAVE_PATH}')
    if API_KEY is not None:
        print('API Key validation is enabled.')
    else:
        print('API Key validation is disabled.')
    httpd.serve_forever()

if __name__ == '__main__':
    run()
