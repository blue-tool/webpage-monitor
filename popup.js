// 页面加载时获取当前标签页URL
document.addEventListener('DOMContentLoaded', async () => {
  // 显示已有项目
  displayItems();
  
  // 获取当前标签页URL并填充到输入框
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      document.getElementById('urlInput').value = tab.url;
    }
  } catch (error) {
    console.error('获取当前页面URL失败:', error);
  }
});

// 添加监控项
document.getElementById('addItem').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  const xpath = document.getElementById('xpathInput').value.trim() || '/html/body'; // 如果没有输入xpath，默认监控整个body
  
  if (!url) {
    chrome.notifications.create({
      type: 'basic',
      title: '错误',
      message: '请输入URL'
    });
    return;
  }

  try {
    // 获取当前内容
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    const element = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!element) {
      chrome.notifications.create({
        type: 'basic',
        title: '错误',
        message: '无法找到指定的元素，请检查XPath是否正确'
      });
      return;
    }

    // 保存到storage
    const { items = [] } = await chrome.storage.local.get('items');
    items.push({
      url,
      xpath,
      lastContent: element.textContent,
      lastHtml: element.outerHTML
    });
    await chrome.storage.local.set({ items });
    
    // 只清空XPath输入框，保留URL
    document.getElementById('xpathInput').value = '';
    
    // 显示成功通知
    chrome.notifications.create({
      type: 'basic',
      title: '添加成功',
      message: `已添加监控项：\nURL: ${url}\nXPath: ${xpath === '/html/body' ? '整个页面' : xpath}`
    });
    
    // 刷新显示
    displayItems();
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      title: '错误',
      message: '添加失败，请检查URL是否正确'
    });
    console.error('添加失败:', error);
  }
});

// 显示已保存的监控项
async function displayItems() {
  const itemList = document.getElementById('itemList');
  const { items = [] } = await chrome.storage.local.get('items');

  // 后面添加的在最上面
  items.reverse();
  
  itemList.innerHTML = items.map((item, index) => `
    <div class="item">
      <div>URL: ${item.url}</div>
      <div>XPath: ${item.xpath === '/html/body' ? '整个页面' : item.xpath}</div>
      <div>当前内容长度: ${item.lastContent?.length || 0} 字符</div>
      <button data-index="${index}">删除</button>
    </div>
  `).join('');

  // 为所有删除按钮添加事件监听
  document.querySelectorAll('.item button').forEach(button => {
    button.addEventListener('click', async () => {
      const index = parseInt(button.dataset.index);
      const { items = [] } = await chrome.storage.local.get('items');
      const deletedItem = items[index];
      items.splice(index, 1);
      await chrome.storage.local.set({ items });
      
      // 显示删除成功通知
      chrome.notifications.create({
        type: 'basic',
        title: '删除成功',
        message: `已删除监控项：\nURL: ${deletedItem.url}`
      });
      
      displayItems();
    });
  });
}

// 添加立即检查按钮的事件监听
document.getElementById('checkNow').addEventListener('click', async () => {
  try {
    chrome.notifications.create({
      type: 'basic',
      title: '开始检查',
      message: '正在检查所有监控项...'
    });
    
    const response = await chrome.runtime.sendMessage({ action: 'checkNow' });
    
    chrome.notifications.create({
      type: 'basic',
      title: '检查完成',
      message: response.message
    });
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      title: '错误',
      message: '检查失败: ' + error.message
    });
  }
}); 