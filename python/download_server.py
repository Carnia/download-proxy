import os
import requests
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse, unquote
import re
import time

DEFAULT_SAVE_PATH = os.getenv('DEFAULT_SAVE_PATH', '/tmp/downloads')
API_KEY = os.getenv('API_KEY', None)
RATE_LIMIT = 15
RATE_LIMIT_WINDOW = 60
request_counts = {}

def get_filename_from_response(response, url):
    content_disposition = response.headers.get('Content-Disposition')
    if content_disposition:
        match = re.search(r'filename\*=(?:UTF-8\'\')?([^\s;]+)', content_disposition)
        if match:
            return unquote(match.group(1))
        match = re.search(r'filename=["\']?([^"\';]*)', content_disposition)
        if match:
            filename = match.group(1).strip()
            return unquote(filename) if '%' in filename else filename
    filename = os.path.basename(urlparse(url).path)
    return filename if filename else 'downloaded_file'

class DownloadHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path != '/download':
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
            return

        query_params = parse_qs(parsed_path.query)
        url = query_params.get('url', [None])[0]
        cookie = query_params.get('cookie', [None])[0]
        save_path = query_params.get('save_path', [''])[0].lstrip('/')  # 修改默认值为相对路径
        api_key = query_params.get('api_key', [None])[0]

        if API_KEY is not None and api_key != API_KEY:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'Invalid API Key')
            return

        client_ip = self.client_address[0]
        current_time = time.time()
        if client_ip in request_counts:
            if current_time - request_counts[client_ip]['timestamp'] > RATE_LIMIT_WINDOW:
                request_counts[client_ip] = {'count': 1, 'timestamp': current_time}
            else:
                request_counts[client_ip]['count'] += 1
                if request_counts[client_ip]['count'] > RATE_LIMIT:
                    self.send_response(429)
                    self.end_headers()
                    self.wfile.write(b'Too Many Requests')
                    return
        else:
            request_counts[client_ip] = {'count': 1, 'timestamp': current_time}

        if not url or not cookie:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Missing required parameters: url and cookie')
            return

        # 新增路径校验逻辑
        if '..' in save_path or os.path.isabs(save_path):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid save_path parameter')
            return

        full_save_path = os.path.join(DEFAULT_SAVE_PATH, save_path)
        if not os.path.exists(full_save_path):
            os.makedirs(full_save_path, exist_ok=True)

        try:
            headers = {'Cookie': cookie}
            response = requests.get(url, headers=headers, allow_redirects=True)
            response.raise_for_status()
            filename = get_filename_from_response(response, url)
            file_path = os.path.join(full_save_path, filename)
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
    print('API Key validation is ' + ('enabled.' if API_KEY else 'disabled.'))
    httpd.serve_forever()

if __name__ == '__main__':
    run()