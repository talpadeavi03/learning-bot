// api/worker.js — AETHER Secure Backend Worker

export default {
  async fetch(request, env) {

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const url = new URL(request.url);

    // ════════════════════════════════
    // GET — serve frontend or health
    // ════════════════════════════════
    if (request.method === 'GET') {

      // Health check at /health
      if (url.pathname === '/health') {
        return json({ status: 'AETHER API ONLINE', version: '2.0' });
      }

      // Serve dashboard.json
      if (url.pathname === '/data/dashboard.json') {
        const res = await fetch(
          'https://raw.githubusercontent.com/talpadeavi03/learning-bot/master/site/data/dashboard.json',
          { cf: { cacheEverything: true, cacheTtl: 60 } }
        );
        if (!res.ok) return json({ error: 'dashboard.json not found' }, 404);
        const data = await res.text();
        return new Response(data, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // Serve index.html for all other GET requests
      const res = await fetch(
        'https://raw.githubusercontent.com/talpadeavi03/learning-bot/master/site/index.html',
        { cf: { cacheEverything: true, cacheTtl: 300 } }
      );

      if (!res.ok) {
        return new Response('AETHER frontend not found. Push site/index.html to GitHub.', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      const html = await res.text();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // ════════════════════════════════
    // ROUTE: POST /chat
    // ════════════════════════════════
    if (url.pathname === '/chat') {
      try {
        const body = await request.json();

        const history  = body.history  || [{ role: 'user', content: body.message || 'Hello' }];
        const metrics  = body.metrics  || {};
        const activity = body.activity || [];
        const goals    = body.goals    || [];

        const systemPrompt = `You are AETHER, a personal AI operating system assistant for Avi.
You have full context of Avi's daily life and data:
- Focus: ${metrics.focus ?? '?'}%
- Learning: ${metrics.learning ?? '?'}%
- Productivity: ${metrics.productivity ?? '?'}%
- Mood: ${metrics.mood ?? '?'}%
- Today's activity: ${activity.map(a => a.topic + ' (' + a.minutes + 'min)').join(', ') || 'none logged yet'}
- Goals today: ${goals.map(g => (g.done ? '✓' : '○') + ' ' + g.text).join(' | ') || 'none set'}
Be direct, insightful, and personal. Plain text only, no markdown.`;

        // ✅ GROQ API — free, fast, no billing
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1000,
            messages: [
              { role: 'system', content: systemPrompt },
              ...history
            ]
          })
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('Groq API error:', err);
          return json({ error: 'AI API error', detail: err }, 502);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'Neural pathway disrupted.';

        return json({ reply });

      } catch (err) {
        console.error('Chat route error:', err);
        return json({ error: err.message }, 500);
      }
    }

    // ════════════════════════════════
    // ROUTE: POST /telegram
    // ════════════════════════════════
    if (url.pathname === '/telegram') {
      try {
        const body = await request.json();
        const message = body?.message?.text;
        const chatId  = body?.message?.chat?.id;

        if (!message) return new Response('ok');

        const ghResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_USERNAME}/${env.GITHUB_REPO}/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${env.GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
              'User-Agent': 'AETHER-Bot'
            },
            body: JSON.stringify({
              event_type: 'telegram_log',
              client_payload: { message, chat_id: String(chatId) }
            })
          }
        );

        const ghOk = ghResponse.ok;

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: ghOk
              ? `✅ AETHER logged: "${message}"\n⚙️ Pipeline triggered.`
              : `⚠️ Logged locally but pipeline trigger failed. Check GitHub token.`
          })
        });

        return new Response('ok');

      } catch (err) {
        console.error('Telegram route error:', err);
        return json({ error: err.message }, 500);
      }
    }

    return new Response('Route not found', { status: 404 });
  }
};

// ── Helper ──
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}