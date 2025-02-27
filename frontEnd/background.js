// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    // 获取普通页面的cookies
    chrome.cookies.getAll({ url: sender.tab.url }, (cookies) => {
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      sendResponse({ cookie: cookieString });
    });
    return true; // 保持消息通道打开以支持异步响应
  } else if (request.action === 'sendRequest') {
    // 发起请求
    fetch(request.url, {
      method: 'POST',
      headers: {  // 新增请求头
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request.body),
    })
      .then(response => response.text())
      .then(data => {
        sendResponse({ data });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // 保持消息通道打开以支持异步响应
  } else if (request.action === 'setCookies') {
    const { origin, cookie: cookieString } = request;
    const tab = sender.tab;

    if (!tab) {
      console.error('No tab information available');
      sendResponse({ success: false });
      return true;
    }
    // 获取当前标签页关联的 Cookie 存储区
    chrome.cookies.getAllCookieStores((stores) => {
      const store = stores.find(s => s.tabIds.includes(tab.id));
      if (!store) {
        console.error('Cookie store not found');
        sendResponse({ success: false });
        return;
      }

      // 解析 Cookie 字符串
      const cookies = cookieString.split(';')
        .map(pair => pair.trim())
        .filter(pair => pair)
        .map(pair => {
          const eqIndex = pair.indexOf('=');
          if (eqIndex === -1) return null;
          return {
            name: pair.slice(0, eqIndex).trim(),
            value: pair.slice(eqIndex + 1).trim()
          };
        })
        .filter(cookie => cookie !== null);

      // 设置每个 Cookie
      const tmp = {}
      const setPromises = cookies.map(({ name, value }) => {
        const url = origin.endsWith('/') ? origin : origin + '/';
        return new Promise((resolve) => {
          chrome.cookies.get({ name, url, storeId: store.id }, async (cookie) => {
            if (cookie) {
              const { expirationDate, httpOnly, sameSite, secure, partitionKey } = cookie
              Object.assign(tmp, { expirationDate, httpOnly, sameSite, secure, partitionKey })
              await new Promise((resolve) => {
                chrome.cookies.remove({ name, url, storeId: store.id }, resolve)
              })
            }
            chrome.cookies.set({
              url: url,
              name: name,
              value: value,
              storeId: store.id,
              ...tmp
            }, () => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                resolve(false);
              } else {
                resolve(true);
              }
            });
          })
        });
      });

      // 等待所有 Cookie 设置完成
      Promise.all(setPromises).then(results => {
        const allSuccess = results.every(Boolean);
        sendResponse({ success: allSuccess });
      });
    });

    return true; // 保持异步通道开放
  }
});