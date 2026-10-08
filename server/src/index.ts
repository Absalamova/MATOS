/**
 * MATOS API — entry point.
 *   npm run dev:api     (development, restarts on file changes)
 *   npm run start:api   (production)
 */
import { startServer } from './app.ts';
import { log } from './lib/log.ts';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`\nMATOS API uchun Node.js 22.18 yoki yangiroq kerak (hozir ${process.versions.node}).\nhttps://nodejs.org saytidan LTS versiyani o‘rnating.\n`);
  process.exit(1);
}

try {
  const app = await startServer();
  const { config } = app;
  log.info(`MATOS API ishga tushdi: http://${config.host}:${config.port}  (${config.env})`);
  log.info(`Ma’lumotlar bazasi: ${config.dbFile}`);
  if (!config.telegram.token) log.info('Telegram xabarnomalari o‘chiq (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).');

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`${signal}: to‘xtatilmoqda…`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
} catch (err) {
  const e = err as NodeJS.ErrnoException;
  if (e.code === 'EADDRINUSE') {
    console.error(`\n${process.env.PORT || 8080}-port band. Boshqa dastur (yoki API ning eski nusxasi) ishlayapti.\nUni yoping yoki .env faylida PORT=8081 qilib qo‘ying.\n`);
  } else {
    console.error('API ishga tushmadi:', e instanceof Error ? e.message : e);
  }
  process.exit(1);
}
