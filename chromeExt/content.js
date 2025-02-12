// 插入按钮B
function insertButton() {
  const buttonA = document.querySelector('.addDownloadedBook');
  if (buttonA) {
    const div = document.createElement('div')
    div.style.position = 'fixed';
    div.style.top = '30px';
    div.style.right = '30px';
    div.style.padding = '20px';
    div.style.width = '300px';
    div.style.background = '#fff';
    div.style.border = '1px solid #000';

    const buttonB = document.createElement('button');
    buttonB.innerText = '远程下载';
    buttonB.style.marginLeft = '10px';
    buttonB.style.lineHeight = '1';
    buttonB.style.background = '#fff';
    buttonB.style.color = '#000';
    buttonB.addEventListener('click', handleButtonBClick);

    const fieldset = document.createElement('fieldset');
    fieldset.innerHTML = `<legend>z-Library远程下载插件<br><br>选择目标文件</legend> <div id="filesDetail">
      <input type="radio" id=${buttonA.href} name="_file_url" value="${buttonA.href}" checked>
      <label for="${buttonA.href}">${buttonA.innerText}</label>
    </div>`

    div.appendChild(fieldset)
    div.appendChild(buttonB)
    document.body.appendChild(div);
  }
}

// 处理按钮B的点击事件
async function handleButtonBClick(event) {
  const href = document.querySelector('input[name="_file_url"]:checked').value;
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
window.addEventListener('load', () => {
  insertButton()
  const regex = /^\/book\/([^/]+)/; // 正则表达式

  const match = location.pathname.match(regex); // 使用 match() 方法提取匹配的内容
  let bookId
  if (match) {
    bookId = match[1]; // match[1] 是捕获组中第一个匹配的内容，即 id1
  }
  const resourceUrl = `/papi/book/${bookId}/formats`
  fetch(resourceUrl)
    .then(response => response.json())
    .then(data => {
      const externalHtml = document.createElement('div')
      externalHtml.innerHTML=data.books.map(v => {
        v.href = location.origin + v.href
        return `
      <input type="radio" id=${v.href} name="_file_url" value="${v.href}">
      <label for="${v.href}">${v.extension}${v.filesizeString}</label>
      <br>
      `
      }).join('')
      document.querySelector('#filesDetail').appendChild(externalHtml)
    })
});
