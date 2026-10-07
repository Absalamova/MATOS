/** Tiny structured logger: JSON lines in production, readable lines in development. */
type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

let format: 'pretty' | 'json' = 'pretty';
let silent = false;

export function configureLog(opts: { format: 'pretty' | 'json'; silent?: boolean }) {
  format = opts.format;
  silent = !!opts.silent;
}

function write(level: Level, msg: string, fields?: Fields) {
  if (silent && level !== 'error') return;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (format === 'json') {
    out.write(JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }) + '\n');
    return;
  }
  const time = new Date().toTimeString().slice(0, 8);
  const extra = fields
    ? Object.entries(fields)
        .filter(([k]) => k !== 'stack')
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ')
    : '';
  const tag = level === 'info' ? '' : `${level.toUpperCase()} `;
  out.write(`${time} ${tag}${msg}${extra ? ' ' + extra : ''}\n`);
  if (fields?.stack) out.write(String(fields.stack) + '\n');
}

export const log = {
  debug: (msg: string, f?: Fields) => write('debug', msg, f),
  info: (msg: string, f?: Fields) => write('info', msg, f),
  warn: (msg: string, f?: Fields) => write('warn', msg, f),
  error: (msg: string, f?: Fields) => write('error', msg, f),
};
