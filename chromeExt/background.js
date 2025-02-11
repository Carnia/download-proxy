// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCookies') {
      // 获取当前页面的cookies
      chrome.cookies.getAll({ url: sender.tab.url }, (cookies) => {
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        sendResponse({ cookie: cookieString });
      });
      return true; // 保持消息通道打开以支持异步响应
    } else if (request.action === 'sendRequest') {
      // 发起请求
      fetch(request.url)
        .then(response => response.text())
        .then(data => {
          sendResponse({ data });
        })
        .catch(error => {
          sendResponse({ error: error.message });
        });
      return true; // 保持消息通道打开以支持异步响应
    }
  });