const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// 启用 CORS
app.use(cors());

// 存储当前内容的变量
let currentContent = '这是初始内容';
let changeCount = 0;

// 提供一个简单的HTML页面
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>测试页面</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 20px auto;
                padding: 20px;
            }
            .content {
                border: 1px solid #ddd;
                padding: 20px;
                margin: 20px 0;
            }
            .timestamp {
                color: #666;
                font-size: 0.9em;
            }
        </style>
    </head>
    <body>
        <h1>测试页面</h1>
        <div class="timestamp">
            当前时间: ${new Date().toLocaleString()}
        </div>
        <div class="content" id="dynamic-content">
            ${currentContent}
            <br>
            <br>
            内容已更改次数: ${changeCount}
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// 提供一个API端点来手动更改内容
app.get('/change', (req, res) => {
    changeCount++;
    currentContent = `这是第 ${changeCount} 次更改的内容 - ${new Date().toLocaleString()}`;
    res.send({ success: true, newContent: currentContent });
});

// 自动定期更改内容（每60秒）
setInterval(() => {
    changeCount++;
    currentContent = `这是第 ${changeCount} 次自动更改的内容 - ${new Date().toLocaleString()}`;
    console.log('内容已更新:', currentContent);
}, 60000);

// 启动服务器
app.listen(port, () => {
    console.log(`测试服务器运行在 http://localhost:${port}`);
    console.log('可以通过访问 http://localhost:${port}/change 手动触发内容更改');
}); 