import "server-only";

const errors = {
  AUTHENTICATION_REQUIRED: { status: 401, message: "Please sign in to continue." },
  ACCESS_DENIED: { status: 403, message: "You do not have access to this resource." },
  INVALID_REQUEST: { status: 422, message: "The request could not be validated." },
  CONFIGURATION_UNAVAILABLE: { status: 503, message: "This service is not configured yet." },
  INTERNAL_ERROR: { status: 500, message: "The request could not be completed." },
} as const;
export type ApiErrorCode = keyof typeof errors;
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly correlationId?: string;
  #internalCause: unknown;
  #context: Readonly<Record<string, unknown>>;
  constructor(code: ApiErrorCode, options: { cause?: unknown; correlationId?: string; context?: Record<string, unknown> } = {}) {
    super(errors[code].message);
    this.code = code;
    this.status = errors[code].status;
    this.correlationId = /^[a-zA-Z0-9-]{1,64}$/.test(options.correlationId ?? "") ? options.correlationId : undefined;
    this.#internalCause = options.cause;
    this.#context = Object.freeze({ ...options.context });
  }
  internalDiagnostics() { return { cause: this.#internalCause, context: this.#context }; }
  toJSON() {
    return { ok: false as const, error: { code: this.code, message: errors[this.code].message,
      ...(this.correlationId ? { correlationId: this.correlationId } : {}) } };
  }
}
export function serializeApiError(error: unknown) {
  const safe = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR", { cause: error });
  return { status: safe.status, body: safe.toJSON() };
}
