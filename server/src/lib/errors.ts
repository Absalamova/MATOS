/** An error that maps straight to an HTTP response: `{ error: { code, message, fields? } }`. */
export class HttpError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra?: { fields?: Record<string, string>; details?: Record<string, unknown> }) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = extra?.fields;
    this.details = extra?.details;
  }
}

export const badRequest = (message = 'So‘rov noto‘g‘ri', code = 'bad_request') => new HttpError(400, code, message);
export const unauthorized = (message = 'Avval tizimga kiring', code = 'unauthorized') => new HttpError(401, code, message);
export const forbidden = (message = 'Bu amal uchun ruxsat yo‘q', code = 'forbidden') => new HttpError(403, code, message);
export const notFound = (message = 'Topilmadi', code = 'not_found') => new HttpError(404, code, message);
export const conflict = (message: string, code = 'conflict', details?: Record<string, unknown>) => new HttpError(409, code, message, { details });
export const tooMany = (message = 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.') => new HttpError(429, 'rate_limited', message);
export const invalid = (fields: Record<string, string>, message = 'Ma’lumotlarni tekshiring') => new HttpError(422, 'validation', message, { fields });
