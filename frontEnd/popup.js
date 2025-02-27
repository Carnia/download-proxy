// 页面加载时填充已保存的配置
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['urlA', 'apiKey', 'savePath', 'cookie'], (config) => {
    if (config.urlA) document.getElementById('urlA').value = config.urlA;
    if (config.apiKey) document.getElementById('apiKey').value = config.apiKey;
    if (config.savePath) document.getElementById('savePath').value = config.savePath;
    if (config.cookie) document.getElementById('cookie').value = config.cookie;
  });
});

// 保存配置
document.getElementById('save').addEventListener('click', () => {
  const urlA = document.getElementById('urlA').value;
  if (!urlA){
    alert('请填写服务端url');
  }
  const apiKey = document.getElementById('apiKey').value;
  const savePath = document.getElementById('savePath').value;
  const cookie = document.getElementById('cookie').value;
  chrome.storage.sync.set({ urlA, apiKey, savePath, cookie }, () => {
    alert('配置已保存');
  });
});