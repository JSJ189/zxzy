require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 聊天接口
app.post('/chat', async (req, res) => {
    // 保持原有的聊天接口实现...
    const { message } = req.body;

    try {
        if (!process.env.ZHIPUAI_API_KEY) {
            throw new Error('ZHIPUAI_API_KEY is not set in the .env file');
        }
        
        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ZHIPUAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "glm-4.5",
                messages: [{ role: "user", content: message }],
                stream: true,
                max_tokens: 8192,
            }),
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Zhipu API Error: ${response.status}`, errorBody);
            throw new Error(`Zhipu API Error: ${response.status}`);
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
        console.error('Error during chat processing:', error);
        res.status(500).json({ error: '与AI服务通信时出错' });
    }
});

// 新增：图像生成接口
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;

    try {
        if (!process.env.ARK_API_KEY) {
            throw new Error('ARK_API_KEY is not set in the .env file');
        }

        // 调用即梦API生成图像
        const response = await fetch("https://api.ark.cn/v1/images/generations", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ARK_API_KEY}`
            },
            body: JSON.stringify({
                model: "ark-diffusion", // 根据实际模型名称调整
                prompt: prompt,
                n: 1, // 生成图片数量
                size: "512x512"
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Image API Error: ${response.status}`, errorBody);
            throw new Error(`Image API Error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Error during image generation:', error);
        res.status(500).json({ error: '生成图像时发生错误' });
    }
});

app.listen(PORT, () => {
    console.log(`服务器已启动，正在监听 http://localhost:${PORT}`);
});