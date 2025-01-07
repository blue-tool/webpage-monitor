// 全局变量存储当前编辑的项目索引
let currentEditIndex = -1;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 初始化显示
    refreshList();
    
    // 添加事件监听
    document.getElementById('addNew').addEventListener('click', () => showModal());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importInput').click());
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('deleteAllBtn').addEventListener('click', deleteAllItems);
    document.getElementById('searchBox').addEventListener('input', refreshList);
    
    // 模态框相关
    document.querySelector('.close').addEventListener('click', hideModal);
    document.getElementById('editForm').addEventListener('submit', handleSubmit);
    document.getElementById('importInput').addEventListener('change', handleImport);
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('editModal')) {
            hideModal();
        }
    });

    // 添加表格的事件委托
    document.getElementById('itemList').addEventListener('click', async (e) => {
        const target = e.target;
        if (!target.matches('button')) return;
        
        const tr = target.closest('tr');
        if (!tr) return;
        
        const index = parseInt(tr.dataset.index);
        
        if (target.classList.contains('edit-btn')) {
            await editItem(index);
        } else if (target.classList.contains('delete-btn')) {
            await deleteItem(index);
        } else if (target.classList.contains('check-btn')) {
            await checkItem(index);
        }
    });
});

// 刷新列表显示
async function refreshList() {
    const { items = [] } = await chrome.storage.local.get('items');
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    
    const filteredItems = items.filter(item => 
        item.url.toLowerCase().includes(searchTerm) || 
        (item.xpath || '').toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('itemList');
    tbody.innerHTML = filteredItems.map((item, index) => `
        <tr data-index="${index}">
            <td>${item.url}</td>
            <td>${item.xpath || '整个页面'}</td>
            <td>${new Date(item.lastUpdate || Date.now()).toLocaleString()}</td>
            <td>${item.lastCheck ? new Date(item.lastCheck).toLocaleString() : '从未检查'}</td>
            <td class="action-btns">
                <button class="primary-btn check-btn">检查</button>
                <button class="secondary-btn edit-btn">编辑</button>
                <button class="danger-btn delete-btn">删除</button>
            </td>
        </tr>
    `).join('');
}

// 显示模态框
function showModal(item = null) {
    const modal = document.getElementById('editModal');
    const urlInput = document.getElementById('urlInput');
    const xpathInput = document.getElementById('xpathInput');
    
    if (item) {
        urlInput.value = item.url;
        xpathInput.value = item.xpath || '';
        document.getElementById('modalTitle').textContent = '编辑监控项';
    } else {
        urlInput.value = '';
        xpathInput.value = '';
        document.getElementById('modalTitle').textContent = '添加监控项';
    }
    
    modal.style.display = 'block';
}

// 隐藏模态框
function hideModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditIndex = -1;
}

// 处理表单提交
async function handleSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('urlInput').value.trim();
    const xpath = document.getElementById('xpathInput').value.trim() || '/html/body';
    
    if (!url) {
        alert('请输入URL');
        return;
    }
    
    try {
        const { items = [] } = await chrome.storage.local.get('items');
        
        const newItem = {
            url,
            xpath,
            lastUpdate: Date.now()
        };
        
        if (currentEditIndex >= 0) {
            items[currentEditIndex] = newItem;
        } else {
            items.push(newItem);
        }
        
        await chrome.storage.local.set({ items });
        hideModal();
        refreshList();
        
    } catch (error) {
        alert('保存失败: ' + error.message);
    }
}

// 编辑项目
async function editItem(index) {
    const { items = [] } = await chrome.storage.local.get('items');
    currentEditIndex = index;
    showModal(items[index]);
}

// 删除项目
async function deleteItem(index) {
    if (!confirm('确定要删除这个监控项吗？')) return;
    
    try {
        const { items = [] } = await chrome.storage.local.get('items');
        items.splice(index, 1);
        await chrome.storage.local.set({ items });
        refreshList();
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 删除所有项目
async function deleteAllItems() {
    if (!confirm('确定要删除所有监控项吗？此操作不可恢复！')) return;
    
    try {
        await chrome.storage.local.set({ items: [] });
        refreshList();
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 导出数据
async function exportData() {
    try {
        const { items = [] } = await chrome.storage.local.get('items');
        
        const config = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            items: items
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await chrome.downloads.download({
            url: url,
            filename: `webpage-monitor-config-${timestamp}.json`,
            saveAs: true
        });
        
        URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('导出失败: ' + error.message);
    }
}

// 处理导入
async function handleImport(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (!config.version || !Array.isArray(config.items)) {
            throw new Error('无效的配置文件格式');
        }
        
        const { items: currentItems = [] } = await chrome.storage.local.get('items');
        
        const newItems = [...currentItems];
        for (const item of config.items) {
            const exists = newItems.some(
                existing => existing.url === item.url && existing.xpath === item.xpath
            );
            if (!exists) {
                newItems.push(item);
            }
        }
        
        await chrome.storage.local.set({ items: newItems });
        refreshList();
        
        alert(`成功导入 ${config.items.length} 个监控项`);
    } catch (error) {
        alert('导入失败: ' + error.message);
    } finally {
        event.target.value = '';
    }
}

// 添加检查单个项目的函数
async function checkItem(index) {
    try {
        const { items = [] } = await chrome.storage.local.get('items');
        const item = items[index];

        // checkSingleItem(item)
        
        if (!item) {
            throw new Error('找不到监控项');
        }

        // 禁用检查按钮，显示加载状态
        const tr = document.querySelector(`tr[data-index="${index}"]`);
        const checkBtn = tr.querySelector('.check-btn');
        checkBtn.disabled = true;
        checkBtn.textContent = '检查中...';

        // 创建新标签页
        const tab = await chrome.tabs.create({
            url: item.url,
            active: false
        });

        // 等待页面加载完成
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });

        // 在页面中执行XPath查询
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (xpath) => {
                const element = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                return element ? {
                    textContent: element.textContent,
                    outerHTML: element.outerHTML
                } : null;
            },
            args: [item.xpath]
        });

        // 关闭标签页
        await chrome.tabs.remove(tab.id);

        if (!result.result) {
            throw new Error('无法找到指定的元素');
        }

        const newContent = result.result.textContent;
        const newHtml = result.result.outerHTML;

        // 检查内容是否发生变化
        if (newContent !== item.lastContent) {
            // 生成变化报告
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const htmlContent = generateChangeReport(item, newContent, newHtml);
            
            // 下载报告
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            await chrome.downloads.download({
                url: url,
                filename: `change-report-${timestamp}.html`,
                saveAs: true
            });
            URL.revokeObjectURL(url);

            // 更新存储的内容
            items[index] = {
                ...item,
                lastContent: newContent,
                lastHtml: newHtml,
                lastUpdate: Date.now(),
                lastCheck: Date.now()
            };
            await chrome.storage.local.set({ items });
            
            alert('检测到内容变化，已生成报告！');
        } else {
            // 仅更新检查时间
            items[index] = {
                ...item,
                lastCheck: Date.now()
            };
            await chrome.storage.local.set({ items });
            
            alert('内容未发生变化');
        }

        // 刷新显示
        refreshList();

    } catch (error) {
        alert('检查失败: ' + error.message);
        refreshList();
    }
}

// 生成变化报告的函数
function generateChangeReport(item, newContent, newHtml) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>变化检测报告 - ${new Date().toLocaleString()}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 20px auto;
                padding: 20px;
                line-height: 1.6;
            }
            .header {
                margin-bottom: 20px;
            }
            .content {
                background-color: #f5f5f5;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
            }
            .diff {
                background-color: #fff;
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin: 10px 0;
            }
            .old-content, .new-content {
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>内容变化检测报告</h1>
            <p>检测时间: ${new Date().toLocaleString()}</p>
            <p>URL: ${item.url}</p>
            <p>XPath: ${item.xpath}</p>
        </div>
        
        <div class="content">
            <h2>原始内容:</h2>
            <div class="diff">${item.lastHtml || '无'}</div>
            
            <h2>新内容:</h2>
            <div class="diff">${newHtml}</div>
        </div>
    </body>
    </html>`;
} 