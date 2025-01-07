const chrome = require('chrome-mock');
const fs = require('fs');
const path = require('path');

// Mock chrome API
global.chrome = chrome;

// Import the functions to test
const {
    diffText,
    checkSingleItem,
    checkChangesNow
} = require('../background.js');

describe('diffText Function', () => {
    test('should detect added text', () => {
        const oldText = '<p>Hello world</p>';
        const newText = '<p>Hello beautiful world</p>';
        const result = diffText(oldText, newText);
        expect(result).toContain('<span class="added">beautiful </span>');
    });

    test('should detect removed text', () => {
        const oldText = '<p>Hello beautiful world</p>';
        const newText = '<p>Hello world</p>';
        const result = diffText(oldText, newText);
        expect(result).toContain('<span class="removed">beautiful </span>');
    });

    test('should handle moved text blocks', () => {
        const oldText = '<p>First Second Third</p>';
        const newText = '<p>Second Third First</p>';
        const result = diffText(oldText, newText);
        // 应该能识别出文本块的移动
        expect(result).toContain('Second Third');
        expect(result).toContain('First');
    });

    test('should handle multiple changes', () => {
        const oldText = '<p>The quick brown fox jumps over the lazy dog</p>';
        const newText = '<p>The fast brown cat jumps over the sleepy dog</p>';
        const result = diffText(oldText, newText);
        expect(result).toContain('<span class="removed">quick</span>');
        expect(result).toContain('<span class="added">fast</span>');
        expect(result).toContain('<span class="removed">fox</span>');
        expect(result).toContain('<span class="added">cat</span>');
        expect(result).toContain('<span class="removed">lazy</span>');
        expect(result).toContain('<span class="added">sleepy</span>');
    });

    test('should handle HTML entities', () => {
        const oldText = '<p>Hello &amp; world</p>';
        const newText = '<p>Hello &amp; beautiful world</p>';
        const result = diffText(oldText, newText);
        expect(result).toContain('<span class="added">beautiful </span>');
    });
});

describe('checkSingleItem Function', () => {
    beforeEach(() => {
        // Reset chrome API mocks before each test
        chrome.tabs.create.mockClear();
        chrome.tabs.remove.mockClear();
        chrome.scripting.executeScript.mockClear();
    });

    test('should detect changes in monitored content', async () => {
        const item = {
            url: 'https://example.com',
            xpath: '/html/body',
            lastContent: 'old content'
        };

        // Mock chrome API responses
        chrome.tabs.create.mockResolvedValue({ id: 1 });
        chrome.scripting.executeScript.mockResolvedValue([{
            result: {
                textContent: 'new content',
                outerHTML: '<div>new content</div>'
            }
        }]);

        const result = await checkSingleItem(item);
        
        expect(result.type).toBe('change');
        expect(result.data.newContent).toBe('new content');
        expect(chrome.tabs.create).toHaveBeenCalledWith({
            url: item.url,
            active: false
        });
    });

    test('should handle non-existent elements', async () => {
        const item = {
            url: 'https://example.com',
            xpath: '/invalid/xpath',
            lastContent: 'old content'
        };

        chrome.tabs.create.mockResolvedValue({ id: 1 });
        chrome.scripting.executeScript.mockResolvedValue([{ result: null }]);

        const result = await checkSingleItem(item);
        
        expect(result.type).toBe('warning');
        expect(result.message).toContain('无法在');
    });
});

describe('checkChangesNow Function', () => {
    beforeEach(() => {
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
        chrome.downloads.download.mockClear();
    });

    test('should check all items and generate report for changes', async () => {
        const mockItems = [
            {
                url: 'https://example1.com',
                xpath: '/html/body',
                lastContent: 'old content 1'
            },
            {
                url: 'https://example2.com',
                xpath: '/html/body',
                lastContent: 'old content 2'
            }
        ];

        chrome.storage.local.get.mockResolvedValue({ items: mockItems });
        chrome.scripting.executeScript
            .mockResolvedValueOnce([{
                result: {
                    textContent: 'new content 1',
                    outerHTML: '<div>new content 1</div>'
                }
            }])
            .mockResolvedValueOnce([{
                result: {
                    textContent: 'old content 2',
                    outerHTML: '<div>old content 2</div>'
                }
            }]);

        const result = await checkChangesNow();

        expect(result.success).toBe(true);
        expect(result.message).toContain('发现 1 处变化');
        expect(chrome.downloads.download).toHaveBeenCalled();
    });

    test('should handle errors during check', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

        const result = await checkChangesNow();
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('错误');
    });
}); 