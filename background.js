// chrome.storage.local.get(null, function(result) {
//     console.log('所有存储的数据:', result);
// });


// 设置定时任务
chrome.runtime.onInstalled.addListener(() => {
    // 获取当前时间
    const now = new Date();

    // 设置下一个6点的时间
    let nextCheck = new Date(now);
    nextCheck.setHours(6, 0, 0, 0);

    // 如果当前时间已经过了今天的6点，就设置为明天的6点
    if (now >= nextCheck) {
        nextCheck.setDate(nextCheck.getDate() + 1);
    }

    // 计算从现在到下一次检查的分钟数
    const delayInMinutes = Math.floor((nextCheck - now) / 1000 / 60);

    // 创建定时任务
    chrome.alarms.create('checkChanges', {
        delayInMinutes: delayInMinutes,
        periodInMinutes: 24 * 60 // 每24小时执行一次
    });

    console.log(`定时任务已设置，将在每天早上6点执行检查。下次检查时间：${nextCheck.toLocaleString()}`);
});


// 监听定时任务
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkChanges') {
        // checkChanges();
        checkChangesNow();
    }
});

// 修改 diffText 函数来使用 diff-match-patch
function diffText(oldText, newText) {
    
    // 清理并获取纯文本
    const oldTextContent = oldText;
    const newTextContent = newText;
    
    // 如果内容完全相同，直接返回
    if (oldTextContent === newTextContent) {
        return newTextContent;
    }
    
    // 计算差异
    const diffs = diffContent(oldTextContent, newTextContent);
    
    
    // 生成HTML格式的差异展示
    let result = '';
    for (const [type, text] of diffs) {
        switch(type) {
            case 1:  // 插入
                result += `<div><span class="added">${text}</span></div>`;
                break;
            case -1: // 删除
                result += `<div><span class="removed">${text}</span></div>`;
                break;
            case 0:  // 相同
                result += text;
                break;
        }
    }
    
    return result;
}

// 计算两个文本的差异
function diffContent(oldText, newText) {
    // 将文本分割成单词数组，便于比较
    const oldWords = oldText.split(/\n/);
    const newWords = newText.split(/\n/);
    
    // 创建LCS矩阵
    const matrix = Array(oldWords.length + 1).fill().map(() => 
        Array(newWords.length + 1).fill(0)
    );
    
    // 填充LCS矩阵
    for (let i = 1; i <= oldWords.length; i++) {
        for (let j = 1; j <= newWords.length; j++) {
            if (oldWords[i-1] === newWords[j-1]) {
                matrix[i][j] = matrix[i-1][j-1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i-1][j], matrix[i][j-1]);
            }
        }
    }
    
    // 回溯矩阵生成差异
    const diffs = [];
    let i = oldWords.length;
    let j = newWords.length;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
            // 相同的文本
            diffs.unshift([0, oldWords[i-1] + ' ']);
            i--;
            j--;
        } else if (j > 0 && (i === 0 || matrix[i][j-1] >= matrix[i-1][j])) {
            // 新增的文本
            diffs.unshift([1, newWords[j-1] + ' ']);
            j--;
        } else if (i > 0 && (j === 0 || matrix[i][j-1] < matrix[i-1][j])) {
            // 删除的文本
            diffs.unshift([-1, oldWords[i-1] + ' ']);
            i--;
        }
    }
    
    return diffs;
}

// 在 checkChangesNow 函数前添加一个新的辅助函数
async function checkSingleItem(item) {
    console.group(`检查项目: ${item.url}`);
    try {
        console.log('XPath:', item.xpath);
        console.log('上次内容:', item.lastContent);

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
            return {
                type: 'warning',
                message: `警告: 无法在 ${item.url} 中找到指定的元素 (XPath: ${item.xpath})`
            };
        }

        const newContent = result.result.textContent;
        const newHtml = result.result.outerHTML;
        console.log('当前内容:', newContent);

        if (newContent !== item.lastContent) {
            console.log('🔄 检测到内容变化！');
            return {
                type: 'change',
                data: {
                    url: item.url,
                    xpath: item.xpath,
                    oldContent: item.lastContent,
                    newContent: newContent,
                    oldHtml: item.lastHtml,
                    newHtml: newHtml
                },
                item: {
                    ...item,
                    lastContent: newContent,
                    lastHtml: newHtml
                }
            };
        }

        console.log('✓ 内容未发生变化');
        return { type: 'nochange' };
    } catch (error) {
        console.error('❌ 检查失败:', error);
        return {
            type: 'error',
            message: `检查失败: ${item.url} - ${error.message}`
        };
    } finally {
        console.groupEnd();
    }
}

// 修改 checkChangesNow 函数来支持并行处理
async function checkChangesNow() {
    console.group('检查变化详细日志');
    console.log('开始检查变化...');
    const { items = [] } = await chrome.storage.local.get('items');
    console.log('当前监控的项目数量:', items.length);
    console.table(items);

    const BATCH_SIZE = 10; // 并行处理的数量
    const changes = [];
    const warnings = [];
    const updatedItems = [...items];

    // 将项目分成多个批次
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`处理批次 ${i / BATCH_SIZE + 1}, 包含 ${batch.length} 个项目`);

        // 并行处理当前批次
        const results = await Promise.all(batch.map(item => checkSingleItem(item)));

        // 处理结果
        results.forEach((result, index) => {
            const batchIndex = i + index;

            switch (result.type) {
                case 'change':
                    changes.push(result.data);
                    updatedItems[batchIndex] = result.item;
                    break;
                case 'warning':
                    warnings.push(result.message);
                    break;
                case 'error':
                    warnings.push(result.message);
                    break;
            }
        });
    }

    // 更新存储
    if (changes.length > 0) {
        await chrome.storage.local.set({ items: updatedItems });
    }

    // 生成报告
    if (changes.length > 0 || warnings.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // 创建HTML内容
        const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>网页监控报告 - ${new Date().toLocaleString()}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 20px auto;
                padding: 20px;
                line-height: 1.6;
            }
            .change-item, .warning-item {
                border: 1px solid #ddd;
                margin: 10px 0;
                padding: 15px;
                border-radius: 5px;
            }
            .change-item {
                background-color: #f8f9fa;
            }
            .warning-item {
                background-color: #fff3cd;
                border-color: #ffeeba;
            }
            .url {
                color: #0066cc;
                word-break: break-all;
            }
            .xpath {
                font-family: monospace;
                background-color: #f5f5f5;
                padding: 2px 4px;
            }
            .content-diff {
                margin: 10px 0;
                padding: 10px;
                background-color: #fff;
                border-left: 3px solid #28a745;
            }
            .old-content, .new-content {
                margin: 5px 0;
            }
            h2 {
                color: #333;
                border-bottom: 2px solid #eee;
                padding-bottom: 5px;
            }
            .timestamp {
                color: #666;
                font-size: 0.9em;
            }
            .html-diff {
                margin: 10px 0;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
                overflow: auto;
            }
            .html-diff pre {
                margin: 0;
                white-space: pre-wrap;
                font-family: monospace;
            }
            .diff-title {
                font-weight: bold;
                margin: 10px 0 5px 0;
                color: #666;
            }
            details {
                margin: 10px 0;
            }
            summary {
                cursor: pointer;
                color: #0066cc;
            }
            .html-preview {
                border: 1px solid #ddd;
                padding: 10px;
                margin: 5px 0;
                border-radius: 3px;
            }
            .added {
                color: #008000;
                background-color: #e8ffe8;
                text-decoration: none;
                padding: 2px 4px;
                margin: 0 2px;
                border-radius: 3px;
                display: inline-block;
                font-weight: bold;
            }
            .removed {
                color: #cc0000;
                background-color: #ffe8e8;
                text-decoration: line-through;
                padding: 2px 4px;
                margin: 0 2px;
                border-radius: 3px;
                display: inline-block;
                font-weight: bold;
            }
            .diff-html {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
                white-space: pre-wrap;
                font-family: monospace;
            }
            .diff-view {
                line-height: 1.8;
                word-break: break-word;
                white-space: pre-wrap;
                background-color: #ffffff;
                padding: 15px;
                border-radius: 5px;
                border: 1px solid #e0e0e0;
            }
        </style>
    </head>
    <body>
        <h1>网页监控报告</h1>
        <div class="timestamp">生成时间: ${new Date().toLocaleString()}</div>
        
        ${warnings.length > 0 ? `
        <h2>⚠️ 警告信息 (${warnings.length}条)</h2>
        ${warnings.map(warning => `
            <div class="warning-item">
                ${warning}
            </div>
        `).join('')}
        ` : ''}
        
        ${changes.length > 0 ? `
        <h2>🔄 内容变化 (${changes.length}处)</h2>
        ${changes.map(change => `
            <div class="change-item">
                <div class="url">URL: <a href="${change.url}" target="_blank">${change.url}</a></div>
                <div class="xpath">XPath: ${change.xpath}</div>
                <div class="content-diff">
                    <h4>文本内容变化：</h4>
                    <div class="diff-view">
                    ${diffText(change.oldContent, change.newContent)}
                    </div>
                    <details>
                        <div class="diff-view">
                            <h4>原HTML渲染效果:</h4>
                            ${change.oldHtml}
                            <h4>新HTML渲染效果:</h4>
                            ${change.newHtml}
                        </div>
                    </details>
                </div>
            </div>
        `).join('')}
        ` : ''}
        
        ${changes.length === 0 && warnings.length === 0 ? `
        <h2>✓ 检查完成</h2>
        <p>未发现任何变化或警告。</p>
        ` : ''}
    </body>
    </html>`;

        // 使用Data URL下载HTML文件
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        await chrome.downloads.download({
            url: dataUrl,
            filename: `webpage-changes-${timestamp}.html`,
            saveAs: true
        });
    }

    console.log('\n检查结果汇总:');
    console.log('检查项目数:', items.length);
    console.log('发现变化数:', changes.length);
    console.table(changes);
    console.groupEnd();

    return {
        success: true,
        message: changes.length > 0 ?
            `检查完成，发现 ${changes.length} 处变化并已保存到文件` :
            warnings.length > 0 ?
                `检查完成，发现 ${warnings.length} 个警告并已保存到文件` :
                '检查完成，未发现变化'
    };
}

// 导出函数供popup.js使用
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkNow') {
        checkChangesNow().then(sendResponse);
        return true; // 保持消息通道打开
    }
}); 