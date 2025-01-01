// 用于选择元素并获取XPath
function setupXPathSelector() {
  let selectedElement = null;
  
  document.addEventListener('mouseover', (e) => {
    if (selectedElement) {
      selectedElement.style.outline = '';
    }
    selectedElement = e.target;
    selectedElement.style.outline = '2px solid red';
  });
  
  document.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const xpath = getXPath(selectedElement);
    const url = window.location.href;
    
    // 保存到storage
    const { items = [] } = await chrome.storage.local.get('items');
    items.push({
      url,
      xpath,
      lastContent: selectedElement.textContent
    });
    await chrome.storage.local.set({ items });
    
    // 清理事件监听
    document.removeEventListener('mouseover');
    document.removeEventListener('click');
  }, { once: true });
}

// 获取元素的XPath
function getXPath(element) {
  if (!element) return '';
  
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }
  
  let path = '';
  let current = element;
  
  while (current.parentNode) {
    let index = 1;
    for (let sibling = current.previousSibling; sibling; sibling = sibling.previousSibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
        index++;
      }
    }
    
    const tagName = current.tagName.toLowerCase();
    path = `/${tagName}[${index}]${path}`;
    current = current.parentNode;
  }
  
  return path;
} 