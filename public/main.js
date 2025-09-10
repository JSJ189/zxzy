// --- DOM Elements ---
const initialView = document.getElementById('initial-view');
const chatContainer = document.getElementById('chat-container');
const initialChatForm = document.getElementById('initial-chat-form');
const mainChatForm = document.getElementById('main-chat-form');
const initialMessageInput = document.getElementById('initial-message-input');
const mainMessageInput = document.getElementById('main-message-input');
const bottomChatBar = document.getElementById('bottom-chat-bar');
const stopButton = document.getElementById('stop-button');
const mainSubmitButton = document.getElementById('main-submit-button');
const tabButtons = document.querySelectorAll('.tab-btn');
const promptButtons = document.querySelectorAll('.prompt-btn');

let abortController = new AbortController();
// **核心逻辑**：用于跟踪当前模式，默认为'chat'
let currentMode = 'chat'; 

// --- Event Listeners ---

// 处理初始表单提交
initialChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = initialMessageInput.value.trim();
    if (message) {
        handleNewMessage(message);
        initialMessageInput.value = '';
    }
});

// 处理主聊天表单提交
mainChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = mainMessageInput.value.trim();
    if (message) {
        handleNewMessage(message);
        mainMessageInput.value = '';
        mainMessageInput.style.height = 'auto';
    }
});

// 文本框自动调整高度
mainMessageInput.addEventListener('input', () => {
    mainMessageInput.style.height = 'auto';
    mainMessageInput.style.height = (mainMessageInput.scrollHeight) + 'px';
});

// **核心逻辑**：标签页切换，更新 currentMode
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('tab-active'));
        button.classList.add('tab-active');
        
        const buttonText = button.textContent.trim();
        // 根据按钮文本设置模式
        if (buttonText === '照片创作') {
            currentMode = 'image';
        } else {
            currentMode = 'chat';
        }
        console.log(`模式已切换为: ${currentMode}`);
        
        // 更新占位符
        const placeholderMap = {
            '旅游规划': '规划一次三天两夜的桂林之旅...',
            '设计商品': '设计一款以壮族元素为灵感的茶杯...',
            '照片创作': '生成一张赛博朋克风格的城市夜景照片...'
        };
        initialMessageInput.placeholder = placeholderMap[buttonText] || '输入你的想法...';
        mainMessageInput.placeholder = placeholderMap[buttonText] || '输入消息...';
    });
});

// 快捷提示按钮
promptButtons.forEach(button => {
    button.addEventListener('click', () => {
        const promptText = button.textContent;
        initialMessageInput.value = promptText;
        initialMessageInput.focus();
    });
});

// 停止生成按钮
stopButton.addEventListener('click', () => {
    abortController.abort();
    console.log("Stream stopped by user.");
});

// --- 核心函数 ---

// **核心逻辑**：根据 currentMode 决定调用哪个API
function handleNewMessage(message) {
    if (initialView.style.display !== 'none') {
        initialView.style.display = 'none';
        bottomChatBar.style.display = 'block';
    }
    appendMessage(message, 'user');
    
    // 根据当前模式调用不同的后端接口
    if (currentMode === 'image') {
        generateImage(message);
    } else {
        fetchAIResponse(message);
    }
}

// 文本聊天功能
function fetchAIResponse(message) {
    toggleButtons(true);
    abortController = new AbortController();
    const signal = abortController.signal;

    const aiMessageWrapper = appendMessage('', 'ai');
    const contentElement = aiMessageWrapper.querySelector('.message-content');

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal,
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP 错误! 状态: ${response.status}`);
        processStream(response.body, contentElement);
    })
    .catch(error => {
        if (error.name !== 'AbortError') {
            console.error('聊天处理出错:', error);
            contentElement.innerHTML = "抱歉，连接服务器时发生错误。";
        }
        toggleButtons(false);
    });
}

// 图像生成功能
function generateImage(prompt) {
    toggleButtons(true);

    const aiMessageWrapper = appendMessage('<div class="image-loading">正在生成图像...</div>', 'ai');
    const contentElement = aiMessageWrapper.querySelector('.message-content');

    fetch('/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
    })
    .then(response => {
        if (!response.ok) {
           return response.json().then(err => { throw new Error(`HTTP 错误: ${response.status} - ${err.details || err.error}`) });
        }
        return response.json();
    })
    .then(data => {
        if (data.data && data.data[0] && data.data[0].url) {
            const imageUrl = data.data[0].url;
            contentElement.innerHTML = `<img src="${imageUrl}" alt="生成的图像" class="generated-image">`;
        } else {
            contentElement.innerHTML = "抱歉，未能从API获取有效图像链接。";
        }
        scrollToBottom();
    })
    .catch(error => {
        console.error('图像生成出错:', error);
        contentElement.innerHTML = `抱歉，生成图像时发生错误。<br><span class="text-xs text-gray-500">${error.message}</span>`;
    })
    .finally(() => {
        toggleButtons(false);
    });
}

// 文本流处理
async function processStream(stream, contentElement) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0].delta.content) {
                            fullResponse += parsed.choices[0].delta.content;
                        }
                    } catch (e) { /* 忽略不完整的JSON块 */ }
                }
            }
            
            contentElement.innerHTML = marked.parse(fullResponse + '<span class="blinking-cursor"></span>');
            scrollToBottom();
        }
    } catch (error) {
        console.error("读取数据流时发生错误:", error);
        contentElement.textContent = "读取数据流时发生错误。";
    } finally {
        finalizeMessage(contentElement);
        toggleButtons(false);
    }
}


// --- 辅助函数 ---
function appendMessage(content, sender) {
    const messageWrapper = document.createElement('div');
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    // 对于用户消息，我们不进行markdown解析，以避免意外的格式化
    if (sender === 'user') {
        contentElement.textContent = content;
    } else {
        contentElement.innerHTML = marked.parse(content);
    }

    if (sender === 'user') {
        messageWrapper.className = 'w-full flex justify-end';
        const messageBubble = document.createElement('div');
        messageBubble.className = 'max-w-[80%] p-4 rounded-2xl bg-indigo-500 text-white';
        messageBubble.appendChild(contentElement);
        messageWrapper.appendChild(messageBubble);
    } else {
        messageWrapper.className = 'w-full flex justify-start items-end gap-2';
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'w-8 h-8 mb-1';
        iconWrapper.innerHTML = `
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 78C34.536 78 22 65.464 22 50C22 34.536 34.536 22 50 22C65.464 22 78 34.536 78 50C78 65.464 65.464 78 50 78Z" fill="url(#paint_ai_icon)"/>
                <defs>
                    <linearGradient id="paint_ai_icon" x1="22" y1="22" x2="78" y2="78" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#A78BFA"/><stop offset="1" stop-color="#F472B6"/>
                    </linearGradient>
                </defs>
            </svg>
        `;

        const messageBubble = document.createElement('div');
        messageBubble.className = 'max-w-[80%] p-4 rounded-2xl bg-white text-gray-800 shadow-sm';
        messageBubble.appendChild(contentElement);
        messageWrapper.appendChild(iconWrapper);
        messageWrapper.appendChild(messageBubble);
    }
    
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
    return messageWrapper;
}

function finalizeMessage(contentElement) {
    const cursor = contentElement.querySelector('.blinking-cursor');
    if (cursor) cursor.remove();
}

function toggleButtons(isLoading) {
    stopButton.style.display = isLoading ? 'flex' : 'none';
    mainSubmitButton.style.display = isLoading ? 'none' : 'flex';
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// 加载marked.js
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(script);

