require('dotenv').config();
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// 聊天接口 (保持不变)
app.post('/chat', async (req, res) => {
    console.log('--- 收到 /chat (文本模型) 请求 ---');
    const { message } = req.body;
    console.log('文本提示词:', message);

    try {
        if (!process.env.ZHIPUAI_API_KEY) {
            throw new Error('ZHIPUAI_API_KEY is not set in the .env file');
        }
        
        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ZHIPUAI_API_KEY}` },
            body: JSON.stringify({
                model: "glm-4.5",
                messages: [{ role: "user", content: message }],
                stream: true,
                max_tokens: 8192,
            }),
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`智谱 API 错误: ${response.status}`, errorBody);
            throw new Error(`智谱 API 错误: ${response.status}`);
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } catch (error) {
        console.error('聊天处理出错:', error);
        res.status(500).json({ error: '与AI服务通信时出错' });
    }
});


// **图像生成接口已重构**
app.post('/generate-image', async (req, res) => {
    console.log('--- 收到 /generate-image (图像模型) 请求 ---');
    const { prompt } = req.body;
    console.log('图像提示词:', prompt);

    const arkApiKey = process.env.ARK_API_KEY;

    if (!arkApiKey) {
        return res.status(500).json({ error: 'ARK_API_KEY 未在 .env 文件中设置' });
    }

    // 初始化Ark客户端
    const client = new OpenAI({
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: arkApiKey,
    });

    try {
        console.log('正在向火山方舟发送请求 (使用OpenAI兼容模式)...');
        const response = await client.images.generate({
            // **最终修正**: 修正了模型名称，加上了"doubao-"前缀
            model: "doubao-seedream-3-0-t2i-250415", 
            prompt: prompt,
            size: "1024x1024",
            n: 1,
            response_format: "url"
        });
        
        console.log('图像生成成功，返回结果:', response.data);
        // 将返回的数据格式调整为前端期望的格式
        res.json({ data: response.data });

    } catch (error) {
        console.error('图像生成出错:', error);
        res.status(500).json({ error: '生成图像时发生错误', details: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`服务器已启动，正在监听 http://localhost:${PORT}`);
});

