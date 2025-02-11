// 插入按钮B
function insertButton() {
  const buttonA = document.querySelector('.addDownloadedBook');
  if (buttonA) {
    const buttonB = document.createElement('button');
    buttonB.innerText = '远程下载';
    buttonB.style.marginLeft = '10px';
    buttonB.style.position = 'absolute';
    buttonB.style.top = '-30px';
    buttonB.style.left = '30%';
    buttonB.style.lineHeight = '1';
    buttonB.style.whiteSpace = 'nowrap';
    buttonB.style.background = '#fff';
    buttonB.style.color = '#000';
    buttonB.addEventListener('click', handleButtonBClick);
    buttonA.parentNode.insertBefore(buttonB, buttonA.nextSibling);
  }
}

// 处理按钮B的点击事件
async function handleButtonBClick(event) {
  const href = document.querySelector('.addDownloadedBook').href;
  const { urlA, apiKey, savePath, cookie: configuredCookie } = await getConfig();
  if (!urlA) {
    alert('请点击插件图标补充服务端url')
    return
  }


  // 优先使用配置的cookie，如果未配置则获取当前页面的cookie
  const cookie = configuredCookie || await getCookies();
  if (!configuredCookie) {
    chrome.storage.sync.set({ cookie }, () => {
      console.log('cookie已同步到缓存');
    });
  }
  const buttonB = event.target;
  buttonB.disabled = true;
  buttonB.innerText = '远程下载中...，请耐心等待，这取决于服务器下载速度';

  // 发送请求到后台脚本
  chrome.runtime.sendMessage(
    {
      action: 'sendRequest',
      url: `${urlA}?url=${encodeURIComponent(href)}&api_key=${apiKey}&save_path=${savePath}&cookie=${encodeURIComponent(cookie)}`
    },
    (response) => {
      buttonB.innerText = '远程下载';
      if (response.error) {
        alert('请求失败: ' + response.error);
      } else {
        alert('响应: ' + response.data);
      }
      buttonB.disabled = false;
    }
  );
}

// 获取当前页面的cookies
function getCookies() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCookies' }, (response) => {
      resolve(response.cookie);
    });
  });
}

// 获取配置
function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['urlA', 'apiKey', 'savePath', 'cookie'], (config) => {
      resolve(config);
    });
  });
}

// 页面加载完成后插入按钮B
window.addEventListener('load', insertButton);