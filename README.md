# 网页监控助手 / Web Page Monitor

## 简体中文

### 功能介绍
网页监控助手是一个Chrome浏览器扩展，可以帮助用户监控网页内容的变化。当指定的网页内容发生变化时，会自动生成变化报告并通知用户。

### 主要特性
- 支持监控整个网页或指定元素
- 每天早上6点自动检查
- 支持手动立即检查
- 通过浏览器通知提醒
- 生成详细的HTML格式变化报告
- 支持显示新增和删除的内容

### 安装方法
1. npm install
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本插件的文件夹

### 使用方法
1. 添加监控项：
   - 点击扩展图标打开popup页面
   - 当前页面的URL会自动填充
   - 可选择输入XPath（留空则监控整个页面）
   - 点击"添加监控"按钮

2. 查看监控项：
   - 在popup页面可以看到所有监控项
   - 显示URL和监控范围
   - 可以删除不需要的监控项

3. 检查变化：
   - 系统会在每天早上6点自动检查
   - 可以点击"立即检查所有URL"按钮手动检查
   - 发现变化时会生成HTML报告并通知用户

## English

### Introduction
Web Page Monitor is a Chrome extension that helps users monitor changes in web pages. When specified content changes, it automatically generates a change report and notifies users.

### Key Features
- Monitor entire webpage or specific elements
- Automatic daily check at 6 AM
- Support manual immediate check
- Browser notifications
- Detailed HTML format change reports
- Show added and removed content

### Installation
1. Open Chrome browser, go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension folder

### Usage
1. Add Monitoring Item:
   - Click extension icon to open popup
   - Current page URL will be auto-filled
   - Optionally enter XPath (leave empty to monitor entire page)
   - Click "Add Monitor" button

2. View Monitoring Items:
   - See all monitoring items in popup
   - Shows URL and monitoring scope
   - Can delete unwanted items

3. Check Changes:
   - System automatically checks at 6 AM daily
   - Can click "Check All URLs Now" button for manual check
   - Generates HTML report and notification when changes are found

### Notes
- XPath is optional, leaving it empty will monitor the entire page
- Reports highlight added content in green and removed content in red
- All notifications include detailed information about the changes 