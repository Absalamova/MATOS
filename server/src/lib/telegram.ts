import { log } from './log.ts';

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Sends a message to the shop's Telegram chat when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
 * Never throws and never delays the request that triggered it.
 */
export function createNotifier(cfg: { token: string; chatId: string }) {
  const enabled = !!(cfg.token && cfg.chatId);
  return {
    enabled,
    send(html: string) {
      if (!enabled) return;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          if (!r.ok) log.warn('Telegram xabari yuborilmadi', { status: r.status, body: (await r.text()).slice(0, 200) });
        })
        .catch((err) => log.warn('Telegram bilan aloqa yo‘q', { err: String(err?.message ?? err) }))
        .finally(() => clearTimeout(timer));
    },
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
