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
// **图像生成接口已重构**
app.post('/generate-image', async (req, res) => {
    console.log('--- 收到 /generate-image (图像模型) 请求 ---');
    const { prompt } = req.body;
    console.log('图像提示词:', prompt);

    const arkApiKey = process.env.ARK_API_KEY;
    if (!arkApiKey) {
        return res.status(500).json({ error: 'ARK_API_KEY 未在 .env 文件中设置' });
    }

    // API的URL地址
    const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

    // 构造符合即梦4.0模型要求的请求体
    const requestBody = {
        model: "doubao-seedream-4-0-250828",
        prompt: prompt,
        size: "1024x1024",
        response_format: "url",
        // [核心修改] 使用顺序生成参数来请求4张图片
        sequential_image_generation: "auto",
        sequential_image_generation_options: {
            max_images: 4
        }
    };

    try {
        console.log('正在向火山方舟发送 fetch 请求...');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${arkApiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('火山方舟 API 错误:', errorBody);
            throw new Error(`API 错误: ${errorBody.error?.message || response.statusText}`);
        }

        const responseData = await response.json();
        
        console.log('图像生成成功，返回结果:', responseData.data);
        // 直接将返回的数据传递给前端
        res.json({ data: responseData.data });

    } catch (error) {
        console.error('图像生成出错:', error);
        res.status(500).json({ error: '生成图像时发生错误', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`服务器已启动，正在监听 http://localhost:${PORT}`);
});

