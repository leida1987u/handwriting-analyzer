/**
 * 笔迹心鉴 · API 代理 Worker
 * 
 * 功能：接收前端请求，添加 API Key 后转发到通义千问/智谱等 API
 * 安全：API Key 存储在 Worker 环境变量中，不会暴露给前端
 */

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 只接受 POST 请求
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const body = await request.json();
      const { model, image, prompt, system } = body;

      if (!model || !image) {
        return new Response(JSON.stringify({ error: 'Missing model or image' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // 获取 API Key（从环境变量）
      const apiKey = env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // 根据模型选择 API 端点
      let apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      let headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

      // 支持多模型
      if (model.startsWith('glm')) {
        apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      }

      // 构建请求体
      const requestBody = {
        model,
        messages: [
          { role: 'system', content: system || '你是一位资深的笔迹心理学分析师。' },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: prompt || '请对这张笔迹图片进行全面的笔迹心理分析。' },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      };

      // 转发请求到 API
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await apiResponse.json();

      // 返回响应，添加 CORS 头
      return new Response(JSON.stringify(data), {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
