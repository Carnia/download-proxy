const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 8080; // 服务端口，默认 8080
const DEFAULT_SAVE_PATH = process.env.DEFAULT_SAVE_PATH || './download'; // 默认文件保存路径
const API_KEY = process.env.API_KEY; // API 访问密钥
const LOG_FILE = 'node.log';
const MAX_LOG_LINES = 1000;

app.use(express.json());

/**
 * 格式化时间戳
 * @returns {string} 格式化的时间字符串 yyyy/mm/dd hh:mm:ss
 */
const formatTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 写入日志到文件，保留最近 1000 条
 * @param {string} message - 日志消息
 */
const writeLog = (message) => {
  const timestamp = formatTimestamp();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 同时输出到控制台
  console.log(logMessage.trim());
  
  try {
    let logs = [];
    
    // 读取现有日志
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      logs = content.split('\n').filter(line => line.trim());
    }
    
    // 添加新日志
    logs.push(logMessage.trim());
    
    // 保留最近 1000 条
    if (logs.length > MAX_LOG_LINES) {
      logs = logs.slice(logs.length - MAX_LOG_LINES);
    }
    
    // 写回文件
    fs.writeFileSync(LOG_FILE, logs.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('写入日志失败:', error.message);
  }
};

/**
 * 从响应头或 URL 中提取文件名
 * @param {Object} response - Axios 响应对象
 * @param {string} url - 文件下载 URL
 * @returns {string} 文件名
 */
const getFilenameFromResponse = (response, url) => {
  const contentDisposition = response.headers['content-disposition'];
  if (contentDisposition) {
    // 1. 尝试从 filename* 提取文件名（RFC 5987 格式）
    const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^\s;]+)/i);
    if (filenameStarMatch && filenameStarMatch[1]) {
      // 直接提取 filename* 的值，不需要去掉 ' 或 "
      return decodeURIComponent(filenameStarMatch[1]);
    }

    // 2. 尝试从 filename 提取文件名
    const filenameMatch = contentDisposition.match(/filename=["']?([^"';]*)/i);
    if (filenameMatch && filenameMatch[1]) {
      let filename = filenameMatch[1].trim();
      // 如果文件名是 URL 编码的，解码
      if (filename.includes('%')) {
        filename = decodeURIComponent(filename);
      }
      return filename;
    }
  }

  // 3. 如果 Content-Disposition 头不存在，则从 URL 中提取文件名
  const urlPath = new URL(url).pathname;
  const filenameFromUrl = path.basename(urlPath);
  if (filenameFromUrl) {
    return filenameFromUrl;
  }

  // 4. 如果以上方法都失败，则使用默认文件名
  return 'downloaded_file';
};

// 文件下载接口
app.post('/download', async (req, res) => {
  const { url, cookie, save_path, api_key } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  
  writeLog(`收到下载请求 - IP: ${clientIp}, URL: ${url}, save_path: ${save_path || '默认'}`);

  // 检查必要参数
  if (!url || !cookie) {
    writeLog(`请求失败 - 缺少必要参数 - IP: ${clientIp}`);
    return res.status(400).json({ message: '缺少必要参数：url 和 cookie。' });
  }

  // 检查 API Key 是否有效
  if (API_KEY && api_key !== API_KEY) {
    writeLog(`请求失败 - 无效的 API Key - IP: ${clientIp}`);
    return res.status(403).json({ message: '无效的 API Key。' });
  }

  try {
    // 使用 axios 下载文件
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': new URL(url).origin // 设置 Referer 为 URL 的源
      },
      maxRedirects: 3, // 支持 HTTP 重定向
      responseType: 'stream' // 流式响应
    });

    // 解析文件名和文件大小
    const fileName = getFilenameFromResponse(response, url);
    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    writeLog(`开始下载文件 - 文件名: ${fileName}, 大小: ${totalSize} bytes - IP: ${clientIp}`);

    // 确定文件保存路径
    const saveDir = save_path ? path.join(DEFAULT_SAVE_PATH, save_path) : DEFAULT_SAVE_PATH;
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true }); // 如果目录不存在则创建
    }

    // 保存文件
    const filePath = path.join(saveDir, fileName);
    const writer = fs.createWriteStream(filePath);
    
    let downloadedSize = 0;
    let lastProgress = 0;

    // 设置响应头为分块传输
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 监听数据流
    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize > 0) {
        const progress = Math.floor((downloadedSize / totalSize) * 100);
        // 每 5% 发送一次进度更新
        if (progress >= lastProgress + 5 || progress === 100) {
          lastProgress = progress;
          const progressData = JSON.stringify({
            type: 'progress',
            progress,
            downloadedSize,
            totalSize,
            fileName
          }) + '\n';
          try {
            res.write(progressData);
            writeLog(`下载进度 - ${fileName}: ${progress}% - IP: ${clientIp}`);
          } catch (writeError) {
            writeLog(`发送进度失败 - 错误: ${writeError.message} - IP: ${clientIp}`);
          }
        }
      }
    });

    response.data.on('error', (streamError) => {
      writeLog(`数据流错误 - 错误: ${streamError.message} - IP: ${clientIp}`);
      writer.destroy();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (!res.headersSent) {
        res.status(500).json({
          type: 'error',
          message: '下载流错误。',
          error: streamError.message
        });
      } else {
        const errorData = JSON.stringify({
          type: 'error',
          message: '下载流错误。',
          error: streamError.message
        }) + '\n';
        res.write(errorData);
        res.end();
      }
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      writeLog(`文件下载成功 - 路径: ${filePath} - IP: ${clientIp}`);
      const finalData = JSON.stringify({
        type: 'complete',
        message: '文件下载成功。',
        filePath,
        progress: 100
      }) + '\n';
      res.write(finalData);
      res.end();
    });

    writer.on('error', (err) => {
      writeLog(`文件保存失败 - 错误: ${err.message} - IP: ${clientIp}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // 如果保存失败，删除文件
      }
      const errorData = JSON.stringify({
        type: 'error',
        message: '文件保存失败。',
        error: err.message
      }) + '\n';
      if (!res.headersSent) {
        res.status(500).json({
          type: 'error',
          message: '文件保存失败。',
          error: err.message
        });
      } else {
        res.write(errorData);
        res.end();
      }
    });

  } catch (error) {
    const errorMessage = error.message || error.toString() || '未知错误';
    const errorStack = error.stack || '';
    writeLog(`文件下载失败 - 错误: ${errorMessage} - 堆栈: ${errorStack} - IP: ${clientIp}`);
    
    // 如果响应还没有发送，发送错误响应
    if (!res.headersSent) {
      res.status(500).json({ 
        type: 'error',
        message: '文件下载失败。', 
        error: errorMessage 
      });
    } else {
      // 如果已经开始发送响应（分块传输），发送错误消息并结束
      const errorData = JSON.stringify({
        type: 'error',
        message: '文件下载失败。',
        error: errorMessage
      }) + '\n';
      res.write(errorData);
      res.end();
    }
  }
});

// 处理无效端点
app.use((req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  writeLog(`无效的端点请求 - 路径: ${req.path} - IP: ${clientIp}`);
  res.status(404).json({ message: '无效的端点。' });
});

// 启动服务
app.listen(PORT, () => {
  writeLog(`服务已启动，监听端口 ${PORT}`);
  writeLog(`默认文件保存路径：${DEFAULT_SAVE_PATH}`);
  writeLog(`API Key ${API_KEY ? '已启用' : '未启用'}`);
  writeLog(`日志文件：${LOG_FILE}，保留最近 ${MAX_LOG_LINES} 条`);
});