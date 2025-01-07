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

// 添加导出功能
document.getElementById('exportData').addEventListener('click', async () => {
  try {
    const { items = [] } = await chrome.storage.local.get('items');
    
    // 创建配置对象，包含版本信息
    const config = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      items: items
    };
    
    // 创建Blob
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 下载文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url: url,
      filename: `webpage-monitor-config-${timestamp}.json`,
      saveAs: true
    });
    
    // 清理URL
    URL.revokeObjectURL(url);
    
    chrome.notifications.create({
      type: 'basic',
      title: '导出成功',
      message: '配置已成功导出'
    });
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      title: '导出失败',
      message: error.message
    });
  }
});

// 添加导入功能
document.getElementById('importData').addEventListener('click', () => {
  document.getElementById('importInput').click();
});

document.getElementById('importInput').addEventListener('change', async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const config = JSON.parse(text);
    
    // 验证配置文件格式
    if (!config.version || !Array.isArray(config.items)) {
      throw new Error('无效的配置文件格式');
    }
    
    // 获取当前配置
    const { items: currentItems = [] } = await chrome.storage.local.get('items');
    
    // 合并配置，去重
    const newItems = [...currentItems];
    for (const item of config.items) {
      const exists = newItems.some(
        existing => existing.url === item.url && existing.xpath === item.xpath
      );
      if (!exists) {
        newItems.push(item);
      }
    }
    
    // 保存新配置
    await chrome.storage.local.set({ items: newItems });
    
    // 刷新显示
    displayItems();
    
    chrome.notifications.create({
      type: 'basic',
      
      title: '导入成功',
      message: `成功导入 ${config.items.length} 个监控项`
    });
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      
      title: '导入失败',
      message: error.message
    });
  } finally {
    // 清空文件输入，允许重复导入同一文件
    event.target.value = '';
  }
});

// 添加删除所有功能
document.getElementById('deleteAll').addEventListener('click', async () => {
    // 显示确认对话框
    if (confirm('确定要删除所有监控项吗？此操作不可恢复！')) {
        try {
            // 清空存储
            await chrome.storage.local.set({ items: [] });
            
            // 清空显示列表
            document.getElementById('itemList').innerHTML = '';
            
            // 显示成功消息
            alert('已删除所有监控项！');
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败: ' + error.message);
        }
    }
});

// 添加后台管理页面跳转
document.getElementById('openAdmin').addEventListener('click', () => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('admin.html')
    });
}); 