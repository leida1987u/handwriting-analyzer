/**
 * 笔迹心鉴 · API 代理 Worker（安全增强版）
 * 
 * 安全改进：
 * 1. CORS 限制：只允许指定域名访问
 * 2. 输入验证：模型白名单、图片大小限制
 * 3. 错误处理：返回通用错误信息，不暴露内部细节
 */

export default {
  async fetch(request, env, ctx) {
    // CORS 配置 - 只允许指定域名
    const allowedOrigins = [
      'https://leida1987u.github.io',
      'https://dark-dust-687a.leidada1987.workers.dev',
    ];
    
    const origin = request.headers.get('Origin') || '';
    const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'https://leida1987u.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 只接受 POST 请求
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { model, image, prompt, system } = body;

      // 输入验证 - 模型白名单
      const allowedModels = ['qwen3-omni-flash', 'qwen-vl-max', 'glm-4v-flash'];
      if (!model || !allowedModels.includes(model)) {
        return new Response(JSON.stringify({ error: 'Invalid model' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 输入验证 - 图片
      if (!image || typeof image !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 输入验证 - 图片大小（base64 编码后不超过 5MB）
      if (image.length > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Image too large' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取 API Key（从环境变量）
      const apiKey = env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Service unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 根据模型选择 API 端点
      let apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      let headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      };

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
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      // 返回通用错误信息，不暴露内部细节
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
