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

// 添加一个辅助函数来解析HTML
async function parseHTML(text) {
    return new Promise((resolve) => {
        // 创建一个隐藏的iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        // 使用iframe的contentWindow来解析HTML
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(text);
        doc.close();

        // 返回解析后的document
        resolve(doc);

        // 清理iframe
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 100);
    });
}

// 添加一个辅助函数来比较文本差异
function diffText(oldText, newText) {
    const oldWords = oldText.split(/\s+/);
    const newWords = newText.split(/\s+/);
    let result = '';
    let i = 0, j = 0;

    while (i < oldWords.length || j < newWords.length) {
        if (i >= oldWords.length) {
            // 剩余的都是新增的
            result += `<span class="added">${newWords.slice(j).join(' ')}</span> `;
            break;
        }
        if (j >= newWords.length) {
            // 剩余的都是删除的
            result += `<span class="removed">${oldWords.slice(i).join(' ')}</span> `;
            break;
        }
        if (oldWords[i] === newWords[j]) {
            result += oldWords[i] + ' ';
            i++;
            j++;
        } else {
            // 查找下一个匹配点
            let nextMatch = -1;
            for (let k = j + 1; k < newWords.length; k++) {
                if (oldWords[i] === newWords[k]) {
                    nextMatch = k;
                    break;
                }
            }
            if (nextMatch !== -1) {
                // 找到了匹配，标记中间的为新增
                result += `<span class="added">${newWords.slice(j, nextMatch).join(' ')}</span> `;
                j = nextMatch;
            } else {
                // 没找到匹配，标记为删除
                result += `<span class="removed">${oldWords[i]}</span> `;
                i++;
            }
        }
    }
    return result;
}

// 修改checkChangesNow函数，使用新标签页方式
async function checkChangesNow() {
    console.group('检查变化详细日志');
    console.log('开始检查变化...');
    const { items = [] } = await chrome.storage.local.get('items');
    console.log('当前监控的项目数量:', items.length);
    console.table(items);

    const changes = [];
    const warnings = [];  // 添加警告数组

    for (const item of items) {
        console.group(`检查项目: ${item.url}`);
        try {
            console.log('XPath:', item.xpath);
            console.log('上次内容:', item.lastContent);

            // 创建新标签页
            const tab = await chrome.tabs.create({
                url: item.url,
                active: false // 在后台打开
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
                const warning = `警告: 无法在 ${item.url} 中找到指定的元素 (XPath: ${item.xpath})`;
                console.warn('⚠️', warning);
                warnings.push(warning);
                console.groupEnd();
                continue;
            }

            const newContent = result.result.textContent;
            const newHtml = result.result.outerHTML;
            console.log('当前内容:', newContent);

            if (newContent !== item.lastContent) {
                console.log('🔄 检测到内容变化！');
                changes.push({
                    url: item.url,
                    xpath: item.xpath,
                    oldContent: item.lastContent,
                    newContent: newContent,
                    oldHtml: item.lastHtml,
                    newHtml: newHtml
                });

                item.lastContent = newContent;
                item.lastHtml = newHtml;
            } else {
                console.log('✓ 内容未发生变化');
            }
        } catch (error) {
            console.error('❌ 检查失败:', error);
        }
        console.groupEnd();
    }

    console.log('\n检查结果汇总:');
    console.log('检查项目数:', items.length);
    console.log('发现变化数:', changes.length);
    console.table(changes);

    if (changes.length > 0 || warnings.length > 0) {
        console.log('正在保存更新后的内容...');
        await chrome.storage.local.set({ items });

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
                background-color: #e6ffe6;
                color: #006400;
                text-decoration: none;
                padding: 2px;
            }
            .removed {
                background-color: #ffe6e6;
                color: #dc3545;
                text-decoration: line-through;
                padding: 2px;
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
                border: 1px solid #ddd;
                padding: 15px;
                margin: 10px 0;
                border-radius: 5px;
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
                <div class="url">URL: ${change.url}</div>
                <div class="xpath">XPath: ${change.xpath}</div>
                <div class="content-diff">
                    <h4>文本内容变化：</h4>
                    <div class="diff-view">
                        ${diffText(change.oldHtml, change.newHtml)}
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

        console.log('✅ 文件已创建并开始下载');
    }

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