const chrome = require('chrome-mock');

// Mock chrome API
global.chrome = chrome;

// Import the functions to test
const {
    setupXPathSelector,
    getXPath
} = require('../content.js');

describe('getXPath Function', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test">
                <p>First paragraph</p>
                <p>Second paragraph</p>
            </div>
        `;
    });

    test('should generate XPath for element with ID', () => {
        const element = document.getElementById('test');
        const xpath = getXPath(element);
        expect(xpath).toBe('//*[@id="test"]');
    });

    test('should generate XPath for element without ID', () => {
        const element = document.querySelector('p');
        const xpath = getXPath(element);
        expect(xpath).toBe('/div[1]/p[1]');
    });
});

describe('setupXPathSelector Function', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test">
                <p>Test paragraph</p>
            </div>
        `;
    });

    test('should highlight elements on mouseover', () => {
        setupXPathSelector();
        
        const element = document.querySelector('p');
        const mouseoverEvent = new MouseEvent('mouseover');
        element.dispatchEvent(mouseoverEvent);
        
        expect(element.style.outline).toBe('2px solid red');
    });

    test('should save element on click', async () => {
        setupXPathSelector();
        
        const element = document.querySelector('p');
        const clickEvent = new MouseEvent('click');
        
        chrome.storage.local.get.mockResolvedValue({ items: [] });
        
        await element.dispatchEvent(clickEvent);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            items: expect.arrayContaining([
                expect.objectContaining({
                    xpath: expect.any(String),
                    lastContent: 'Test paragraph'
                })
            ])
        });
    });
}); 