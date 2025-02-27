export default defineBackground(() => {
  // console.log('Hello background!', { id: browser.runtime.id });
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCookies') {
      // 获取普通页面的cookies
      browser.cookies.getAll({ url: sender.tab!.url }, (cookies) => {
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
    } else if (request.action === 'setCookies') {
      const { origin, cookie: cookieString } = request;
      const tab = sender.tab;

      if (!tab) {
        console.error('No tab information available');
        sendResponse({ success: false });
        return true;
      }
      // 获取当前标签页关联的 Cookie 存储区
      browser.cookies.getAllCookieStores((stores) => {
        const store = stores.find(s => s.tabIds.includes(tab.id!));
        if (!store) {
          console.error('Cookie store not found');
          sendResponse({ success: false });
          return;
        }

        // 解析 Cookie 字符串
        const cookies: { name: string, value: string }[] = cookieString.split(';')
          .map((pair: string) => pair.trim())
          .filter((pair: string) => pair)
          .map((pair: string) => {
            const eqIndex = pair.indexOf('=');
            if (eqIndex === -1) return null;
            return {
              name: pair.slice(0, eqIndex).trim(),
              value: pair.slice(eqIndex + 1).trim()
            };
          })
          .filter((cookie: string) => cookie !== null);

        // 设置每个 Cookie
        const tmp = {}
        const setPromises = cookies.map(({ name, value }) => {
          const url = origin.endsWith('/') ? origin : origin + '/';
          return new Promise((resolve) => {
            browser.cookies.get({ name, url, storeId: store.id }, async (cookie) => {
              if (cookie) {
                const { expirationDate, httpOnly, sameSite, secure, partitionKey } = cookie
                Object.assign(tmp, { expirationDate, httpOnly, sameSite, secure, partitionKey })
                await new Promise((resolve) => {
                  browser.cookies.remove({ name, url, storeId: store.id }, resolve)
                })
              }
              browser.cookies.set({
                url: url,
                name: name,
                value: value,
                storeId: store.id,
                ...tmp
              }, () => {
                if (browser.runtime.lastError) {
                  console.error(browser.runtime.lastError);
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
});
