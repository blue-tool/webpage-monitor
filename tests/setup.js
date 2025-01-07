// Mock chrome API
const chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    tabs: {
        create: jest.fn(),
        remove: jest.fn(),
        query: jest.fn()
    },
    scripting: {
        executeScript: jest.fn()
    },
    downloads: {
        download: jest.fn()
    },
    runtime: {
        getURL: jest.fn()
    }
};

global.chrome = chrome; 