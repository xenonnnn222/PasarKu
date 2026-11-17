/** Kesalahan input pengguna. Ditampilkan sebagai pesan dan formulir dikembalikan. */
export class ValidationError extends Error {
  constructor(message, field = 'form') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** Kesalahan HTTP yang sudah diketahui statusnya (404, 403, 422, ...). */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function fail(message, field) {
  throw new ValidationError(message, field);
}
