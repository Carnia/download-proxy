import os
import json
import requests
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, unquote
from datetime import datetime
import re

DEFAULT_SAVE_PATH = os.getenv('DEFAULT_SAVE_PATH', './download')
PORT = int(os.getenv('PORT', 8080))
API_KEY = os.getenv('API_KEY', None)
LOG_FILE = 'python.log'
MAX_LOG_LINES = 1000

def format_timestamp():
    """格式化时间戳为 yyyy/mm/dd hh:mm:ss"""
    now = datetime.now()
    return now.strftime('%Y/%m/%d %H:%M:%S')

def write_log(message):
    """写入日志到文件，保留最近 1000 条"""
    timestamp = format_timestamp()
    log_message = f'[{timestamp}] {message}'
    
    # 同时输出到控制台
    print(log_message)
    
    try:
        logs = []
        
        # 读取现有日志
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                logs = [line.strip() for line in f if line.strip()]
        
        # 添加新日志
        logs.append(log_message)
        
        # 保留最近 1000 条
        if len(logs) > MAX_LOG_LINES:
            logs = logs[-MAX_LOG_LINES:]
        
        # 写回文件
        with open(LOG_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(logs) + '\n')
    except Exception as e:
        print(f'写入日志失败: {str(e)}')

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
        client_ip = self.client_address[0]
        
        if self.path != '/download':
            write_log(f'无效的端点请求 - 路径: {self.path} - IP: {client_ip}')
            self._send_json_response(404, {'message': '无效的端点。'})
            return
        
        # 读取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            write_log(f'请求失败 - 请求体为空 - IP: {client_ip}')
            self._send_json_response(400, {'message': '请求体为空。'})
            return
        
        try:
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            write_log(f'请求失败 - 无效的 JSON 格式 - IP: {client_ip}')
            self._send_json_response(400, {'message': '无效的 JSON 格式。'})
            return
        
        url = data.get('url')
        cookie = data.get('cookie')
        save_path = data.get('save_path', '')
        api_key = data.get('api_key')
        
        write_log(f'收到下载请求 - IP: {client_ip}, URL: {url}, save_path: {save_path or "默认"}')
        
        # 检查必要参数
        if not url or not cookie:
            write_log(f'请求失败 - 缺少必要参数 - IP: {client_ip}')
            self._send_json_response(400, {'message': '缺少必要参数：url 和 cookie。'})
            return
        
        # 检查 API Key 是否有效
        if API_KEY and api_key != API_KEY:
            write_log(f'请求失败 - 无效的 API Key - IP: {client_ip}')
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
            
            # 解析文件名和文件大小
            filename = get_filename_from_response(response, url)
            total_size = int(response.headers.get('content-length', 0))
            write_log(f'开始下载文件 - 文件名: {filename}, 大小: {total_size} bytes - IP: {client_ip}')
            
            # 确定文件保存路径
            if save_path:
                save_dir = os.path.join(DEFAULT_SAVE_PATH, save_path)
            else:
                save_dir = DEFAULT_SAVE_PATH
            
            if not os.path.exists(save_dir):
                os.makedirs(save_dir, exist_ok=True)
            
            # 保存文件
            file_path = os.path.join(save_dir, filename)
            
            # 设置响应头为分块传输
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Transfer-Encoding', 'chunked')
            self.end_headers()
            
            try:
                downloaded_size = 0
                last_progress = 0
                
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)
                            
                            if total_size > 0:
                                progress = int((downloaded_size / total_size) * 100)
                                # 每 5% 发送一次进度更新
                                if progress >= last_progress + 5 or progress == 100:
                                    last_progress = progress
                                    progress_data = json.dumps({
                                        'type': 'progress',
                                        'progress': progress,
                                        'downloadedSize': downloaded_size,
                                        'totalSize': total_size,
                                        'fileName': filename
                                    }, ensure_ascii=False) + '\n'
                                    self.wfile.write(progress_data.encode('utf-8'))
                                    self.wfile.flush()
                                    write_log(f'下载进度 {progress}% IP: {client_ip}- {filename}')
                
                write_log(f'文件下载成功 - 路径: {file_path} - IP: {client_ip}')
                final_data = json.dumps({
                    'type': 'complete',
                    'message': '文件下载成功。',
                    'filePath': file_path,
                    'progress': 100
                }, ensure_ascii=False) + '\n'
                self.wfile.write(final_data.encode('utf-8'))
                
            except Exception as e:
                write_log(f'文件保存失败 - 错误: {str(e)} - IP: {client_ip}')
                # 如果保存失败，删除文件
                if os.path.exists(file_path):
                    os.unlink(file_path)
                error_data = json.dumps({
                    'type': 'error',
                    'message': '文件保存失败。',
                    'error': str(e)
                }, ensure_ascii=False) + '\n'
                self.wfile.write(error_data.encode('utf-8'))
        
        except requests.exceptions.RequestException as e:
            write_log(f'文件下载失败 - 错误: {str(e)} - IP: {client_ip}')
            self._send_json_response(500, {
                'type': 'error',
                'message': '文件下载失败。',
                'error': str(e)
            })
        except Exception as e:
            write_log(f'服务器内部错误 - 错误: {str(e)} - IP: {client_ip}')
            self._send_json_response(500, {
                'type': 'error',
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
        """禁用默认日志输出，使用自定义日志"""
        pass

def run(server_class=HTTPServer, handler_class=DownloadHandler):
    """启动服务器"""
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    write_log(f'服务已启动，监听端口 {PORT}')
    write_log(f'默认文件保存路径：{DEFAULT_SAVE_PATH}')
    write_log(f'API Key {"已启用" if API_KEY else "未启用"}')
    write_log(f'日志文件：{LOG_FILE}，保留最近 {MAX_LOG_LINES} 条')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        write_log('服务器已停止')
        httpd.shutdown()

if __name__ == '__main__':
    run()