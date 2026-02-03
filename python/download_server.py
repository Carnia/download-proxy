import os
import json
import requests
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, unquote
import re

DEFAULT_SAVE_PATH = os.getenv('DEFAULT_SAVE_PATH', './download')
PORT = int(os.getenv('PORT', 8080))
API_KEY = os.getenv('API_KEY', None)

def get_filename_from_response(response, url):
    """
    从响应头或 URL 中提取文件名
    """
    content_disposition = response.headers.get('Content-Disposition', '')
    
    if content_disposition:
        # 1. 尝试从 filename* 提取文件名（RFC 5987 格式）
        filename_star_match = re.search(r'filename\*=UTF-8\'\'([^\s;]+)', content_disposition, re.IGNORECASE)
        if filename_star_match:
            return unquote(filename_star_match.group(1))
        
        # 2. 尝试从 filename 提取文件名
        filename_match = re.search(r'filename=["\']?([^"\';]*)', content_disposition, re.IGNORECASE)
        if filename_match:
            filename = filename_match.group(1).strip()
            # 如果文件名是 URL 编码的，解码
            if '%' in filename:
                filename = unquote(filename)
            return filename
    
    # 3. 如果 Content-Disposition 头不存在，则从 URL 中提取文件名
    url_path = urlparse(url).path
    filename_from_url = os.path.basename(url_path)
    if filename_from_url:
        return filename_from_url
    
    # 4. 如果以上方法都失败，则使用默认文件名
    return 'downloaded_file'

class DownloadHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """处理 POST 请求 - 文件下载接口"""
        if self.path != '/download':
            self._send_json_response(404, {'message': '无效的端点。'})
            return
        
        # 读取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._send_json_response(400, {'message': '请求体为空。'})
            return
        
        try:
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            self._send_json_response(400, {'message': '无效的 JSON 格式。'})
            return
        
        url = data.get('url')
        cookie = data.get('cookie')
        save_path = data.get('save_path', '')
        api_key = data.get('api_key')
        print(data)
        # 检查必要参数
        if not url or not cookie:
            self._send_json_response(400, {'message': '缺少必要参数：url 和 cookie。'})
            return
        
        # 检查 API Key 是否有效
        if API_KEY and api_key != API_KEY:
            self._send_json_response(403, {'message': '无效的 API Key。'})
            return
        
        try:
            # 设置请求头
            parsed_url = urlparse(url)
            headers = {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': f"{parsed_url.scheme}://{parsed_url.netloc}"
            }
            
            # 使用流式下载
            response = requests.get(
                url,
                headers=headers,
                allow_redirects=True,
                stream=True,
                timeout=30
            )
            response.raise_for_status()
            
            # 解析文件名
            filename = get_filename_from_response(response, url)
            
            # 确定文件保存路径
            if save_path:
                save_dir = os.path.join(DEFAULT_SAVE_PATH, save_path)
            else:
                save_dir = DEFAULT_SAVE_PATH
            
            if not os.path.exists(save_dir):
                os.makedirs(save_dir, exist_ok=True)
            
            # 保存文件
            file_path = os.path.join(save_dir, filename)
            
            try:
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                self._send_json_response(200, {
                    'message': '文件下载成功。',
                    'filePath': file_path
                })
            except Exception as e:
                # 如果保存失败，删除文件
                if os.path.exists(file_path):
                    os.unlink(file_path)
                self._send_json_response(500, {
                    'message': '文件保存失败。',
                    'error': str(e)
                })
        
        except requests.exceptions.RequestException as e:
            self._send_json_response(500, {
                'message': '文件下载失败。',
                'error': str(e)
            })
        except Exception as e:
            self._send_json_response(500, {
                'message': '服务器内部错误。',
                'error': str(e)
            })
    
    def _send_json_response(self, status_code, data):
        """发送 JSON 响应"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"{self.address_string()} - [{self.log_date_time_string()}] {format % args}")

def run(server_class=HTTPServer, handler_class=DownloadHandler):
    """启动服务器"""
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f'服务已启动，监听端口 {PORT}')
    print(f'默认文件保存路径：{DEFAULT_SAVE_PATH}')
    print(f'API Key {"已启用" if API_KEY else "未启用"}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        httpd.shutdown()

if __name__ == '__main__':
    run()