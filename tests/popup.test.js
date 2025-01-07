const chrome = require('chrome-mock');

// Mock chrome API
global.chrome = chrome;

// Import the functions to test
const {
    displayItems,
    handleSubmit,
    exportData,
    handleImport
} = require('../popup.js');

describe('displayItems Function', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="itemList"></div>
        `;
    });

    test('should display items correctly', async () => {
        const mockItems = [
            {
                url: 'https://example.com',
                xpath: '/html/body',
                lastContent: 'test content'
            }
        ];

        chrome.storage.local.get.mockResolvedValue({ items: mockItems });
        
        await displayItems();
        
        const itemList = document.getElementById('itemList');
        expect(itemList.innerHTML).toContain('https://example.com');
        expect(itemList.innerHTML).toContain('整个页面');
    });
});

describe('handleSubmit Function', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <form id="editForm">
                <input id="urlInput" value="https://example.com">
                <input id="xpathInput" value="/html/body">
            </form>
        `;
    });

    test('should add new monitoring item', async () => {
        const mockEvent = { preventDefault: jest.fn() };
        const mockItems = [];

        chrome.storage.local.get.mockResolvedValue({ items: mockItems });
        
        await handleSubmit(mockEvent);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            items: expect.arrayContaining([
                expect.objectContaining({
                    url: 'https://example.com',
                    xpath: '/html/body'
                })
            ])
        });
    });
});

describe('exportData Function', () => {
    test('should export items to JSON file', async () => {
        const mockItems = [
            {
                url: 'https://example.com',
                xpath: '/html/body',
                lastContent: 'test content'
            }
        ];

        chrome.storage.local.get.mockResolvedValue({ items: mockItems });
        
        await exportData();
        
        expect(chrome.downloads.download).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: expect.stringContaining('webpage-monitor-config-')
            })
        );
    });
});

describe('handleImport Function', () => {
    test('should import items from JSON file', async () => {
        const mockFile = new File([
            JSON.stringify({
                version: '1.0',
                items: [{
                    url: 'https://example.com',
                    xpath: '/html/body'
                }]
            })
        ], 'test.json', { type: 'application/json' });

        const mockEvent = {
            target: {
                files: [mockFile]
            }
        };

        chrome.storage.local.get.mockResolvedValue({ items: [] });
        
        await handleImport(mockEvent);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            items: expect.arrayContaining([
                expect.objectContaining({
                    url: 'https://example.com',
                    xpath: '/html/body'
                })
            ])
        });
    });
}); 