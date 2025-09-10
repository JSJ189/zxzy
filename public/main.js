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

// --- Event Listeners ---

// Handle initial form submission
initialChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = initialMessageInput.value.trim();
    if (message) {
        handleNewMessage(message);
        initialMessageInput.value = '';
    }
});

// Handle main form submission
mainChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = mainMessageInput.value.trim();
    if (message) {
        handleNewMessage(message);
        mainMessageInput.value = '';
        mainMessageInput.style.height = 'auto'; // Reset height
    }
});

// Auto-resize textarea
mainMessageInput.addEventListener('input', () => {
    mainMessageInput.style.height = 'auto';
    mainMessageInput.style.height = (mainMessageInput.scrollHeight) + 'px';
});


// Handle tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('tab-active'));
        button.classList.add('tab-active');
        // Optional: change placeholder based on tab
        const placeholderMap = {
            '旅游规划': '规划一次三天两夜的桂林之旅...',
            '设计商品': '设计一款以壮族元素为灵感的茶杯...',
            '照片创作': '生成一张赛博朋克风格的城市夜景照片...'
        };
        initialMessageInput.placeholder = placeholderMap[button.textContent] || '输入你的想法...';
    });
});

// Handle quick prompt buttons
promptButtons.forEach(button => {
    button.addEventListener('click', () => {
        const promptText = button.textContent;
        initialMessageInput.value = promptText;
        initialMessageInput.focus();
    });
});

// Stop generation button
stopButton.addEventListener('click', () => {
    abortController.abort();
    console.log("Stream stopped by user.");
});


// --- Core Functions ---

function handleNewMessage(message) {
    if (initialView.style.display !== 'none') {
        initialView.style.display = 'none';
        bottomChatBar.style.display = 'block';
    }
    appendMessage(message, 'user');
    fetchAIResponse(message);
}

function fetchAIResponse(message) {
    toggleButtons(true); // Show stop button, hide submit
    abortController = new AbortController(); // Reset controller for new request
    const signal = abortController.signal;

    const aiMessageWrapper = appendMessage('', 'ai');
    const contentElement = aiMessageWrapper.querySelector('.message-content');

    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
        signal,
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        processStream(response.body, contentElement);
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            // This is expected when the user clicks stop. Finalize the message.
            finalizeMessage(contentElement);
        } else {
            console.error('Error during chat processing:', error);
            contentElement.innerHTML = "抱歉，连接服务器时发生错误。";
        }
        toggleButtons(false); // Show submit button, hide stop
    });
}

async function processStream(stream, contentElement) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') {
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0].delta.content) {
                            fullResponse += parsed.choices[0].delta.content;
                        }
                    } catch (e) {
                       // Ignore parsing errors for potentially incomplete JSON chunks
                    }
                }
            }
            
            // Render markdown and auto-scroll
            contentElement.innerHTML = marked.parse(fullResponse + '<span class="blinking-cursor"></span>');
            scrollToBottom();
        }
    } catch (error) {
        console.error("Error reading stream:", error);
        contentElement.textContent = "读取数据流时发生错误。";
    } finally {
        finalizeMessage(contentElement);
        toggleButtons(false);
    }
}

function appendMessage(content, sender) {
    const messageWrapper = document.createElement('div');
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.innerHTML = marked.parse(content);

    if (sender === 'user') {
        messageWrapper.className = 'w-full flex justify-end';
        const messageBubble = document.createElement('div');
        // 统一设置 max-width 为 80%
        messageBubble.className = 'max-w-[80%] p-4 rounded-2xl bg-indigo-500 text-white';
        messageBubble.appendChild(contentElement);
        messageWrapper.appendChild(messageBubble);
    } else { // AI sender
        messageWrapper.className = 'w-full flex justify-start items-end gap-2'; // 将 gap 改为 2

        // AI Icon
        const iconWrapper = document.createElement('div');
        // 移除了 flex-shrink-0，允许它在必要时收缩
        iconWrapper.className = 'w-8 h-8 mb-1'; // 保留 mb-1 来进行垂直对齐
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
        // 统一设置 max-width 为 80%
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
    if (cursor) {
        cursor.remove();
    }
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

// --- Initial Setup ---
// Load marked.js for markdown rendering
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(script);

