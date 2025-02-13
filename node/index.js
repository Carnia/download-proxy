const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 8080; // 服务端口，默认 8080
const DEFAULT_SAVE_PATH = process.env.DEFAULT_SAVE_PATH || './download'; // 默认文件保存路径
const API_KEY = process.env.API_KEY; // API 访问密钥

// 请求频率限制：每分钟最多 15 次请求
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 15, // 每个 IP 每分钟最大请求数
  handler: (req, res) => {
    res.status(429).json({ message: '请求过于频繁，请稍后再试。' });
  }
});

app.use(limiter);

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
app.get('/download', async (req, res) => {
  const { url, cookie, save_path, api_key } = req.query;

  // 检查必要参数
  if (!url || !cookie) {
    return res.status(400).json({ message: '缺少必要参数：url 和 cookie。' });
  }

  // 检查 API Key 是否有效
  if (API_KEY && api_key !== API_KEY) {
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

    // 解析文件名
    const fileName = getFilenameFromResponse(response, url);

    // 确定文件保存路径
    const saveDir = save_path ? path.join(DEFAULT_SAVE_PATH, save_path) : DEFAULT_SAVE_PATH;
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true }); // 如果目录不存在则创建
    }

    // 保存文件
    const filePath = path.join(saveDir, fileName);
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on('finish', () => {
      res.status(200).json({ message: '文件下载成功。', filePath });
    });

    writer.on('error', (err) => {
      fs.unlinkSync(filePath); // 如果保存失败，删除文件
      res.status(500).json({ message: '文件保存失败。', error: err.message });
    });

  } catch (error) {
    res.status(500).json({ message: '文件下载失败。', error: error.message });
  }
});

// 处理无效端点
app.use((req, res) => {
  res.status(404).json({ message: '无效的端点。' });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`服务已启动，监听端口 ${PORT}`);
  console.log(`默认文件保存路径：${DEFAULT_SAVE_PATH}`);
  console.log(`API Key ${API_KEY ? '已启用' : '未启用'}`);
});