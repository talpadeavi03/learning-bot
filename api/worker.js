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

    // ── Health check ──
    if (request.method === 'GET') {
      return json({ status: 'AETHER API ONLINE', version: '2.0' });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);

    // ════════════════════════════════
    // ROUTE: POST /chat
    // Called by your frontend chat
    // ════════════════════════════════
    if (url.pathname === '/chat' || url.pathname === '/') {
      try {
        const body = await request.json();

        // Safely read fields with fallbacks
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

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages: history
          })
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('Anthropic API error:', err);
          return json({ error: 'AI API error', detail: err }, 502);
        }

        const data = await response.json();
        const reply = data.content?.[0]?.text || 'Neural pathway disrupted.';

        return json({ reply });

      } catch (err) {
        console.error('Chat route error:', err);
        return json({ error: err.message }, 500);
      }
    }

    // ════════════════════════════════
    // ROUTE: POST /telegram
    // Called by Telegram webhook
    // ════════════════════════════════
    if (url.pathname === '/telegram') {
      try {
        const body = await request.json();
        const message = body?.message?.text;
        const chatId  = body?.message?.chat?.id;

        if (!message) return new Response('ok');

        // Trigger GitHub Actions pipeline with the message
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

        // Send confirmation back to Telegram user
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