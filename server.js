// 1. 引入 dotenv 并加载 .env 文件中的环境变量
require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// 中间件，用于解析JSON格式的请求体
app.use(express.json());
// 中间件，用于托管public文件夹下的静态文件（如index.html, main.js）
app.use(express.static(path.join(__dirname, 'public')));


// 定义 /chat 接口，用于处理聊天请求
app.post('/chat', async (req, res) => {
    const { message } = req.body;

    // --- 真实 API 对接部分 (已修复) ---
    try {
        // 检查API Key是否存在
        if (!process.env.ZHIPUAI_API_KEY) {
            throw new Error('ZHIPUAI_API_KEY is not set in the .env file');
        }
        
        // 向智谱AI的API发送流式请求
        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 从环境变量中安全地获取API Key
                'Authorization': `Bearer ${process.env.ZHIPUAI_API_KEY}` 
            },
            body: JSON.stringify({
                model: "glm-4.5", // 您可以根据需要更改模型
                messages: [{ role: "user", content: message }],
                stream: true,
                max_tokens: 8192, // 如果未指定maxTokens，则默认为1024
            }),
        });
        
        // 检查来自智谱AI的响应是否成功
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Zhipu API Error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Zhipu API Error: ${response.status}`);
        }

        // 设置响应头，告诉浏览器这是一个事件流
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // *** 修复核心逻辑 ***
        // 手动读取智谱AI的流并转发给前端
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break; // 流结束
            }
            res.write(value); // 将获取到的数据块直接写入响应
        }
        res.end(); // 结束响应

    } catch (error) {
        console.error('Error during chat processing:', error);
        res.status(500).json({ error: '与AI服务通信时出错' });
    }
});


// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器已启动，正在监听 http://localhost:${PORT}`);
    console.log('请在浏览器中打开以上地址查看应用。');
});

