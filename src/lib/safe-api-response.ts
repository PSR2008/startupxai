export interface ApiErrorEnvelope {
  ok: false;
  success?: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface ApiSuccessEnvelope<T> {
  ok: true;
  success?: true;
  data: T;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface SafeApiFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  detail?: string;
}

export type SafeApiResult<T> =
  | { ok: true; status: number; data: T }
  | SafeApiFailure;

export const GENERIC_ANALYSIS_ERROR = "Competitor analysis could not be completed. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseEnvelopeError(value: unknown, status: number): SafeApiFailure | null {
  if (!isRecord(value)) return null;
  const error = value.error;

  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : "REQUEST_FAILED";
    const message = typeof error.message === "string" && error.message.trim() ? error.message : GENERIC_ANALYSIS_ERROR;
    return {
      ok: false,
      status,
      code,
      message,
      retryable: typeof error.retryable === "boolean" ? error.retryable : status >= 500 || status === 429,
    };
  }

  const legacyCode = typeof value.code === "string" ? value.code : "REQUEST_FAILED";
  const legacyMessage =
    typeof value.message === "string" && value.message.trim()
      ? value.message
      : typeof error === "string" && error.trim()
      ? error
      : GENERIC_ANALYSIS_ERROR;

  if (value.success === false || status >= 400) {
    return {
      ok: false,
      status,
      code: legacyCode,
      message: legacyMessage,
      retryable: status >= 500 || status === 429,
    };
  }

  return null;
}

export async function readSafeApiResponse<T>(response: Response): Promise<SafeApiResult<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (!isJson) {
    const text = (await response.text()).slice(0, 160);
    return {
      ok: false,
      status: response.status,
      code: "INVALID_RESPONSE_FORMAT",
      message: GENERIC_ANALYSIS_ERROR,
      retryable: response.status >= 500 || response.status === 429 || response.status === 0,
      detail: text ? "The server returned a non-JSON response." : "The server returned an empty response.",
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      status: response.status,
      code: "MALFORMED_JSON_RESPONSE",
      message: GENERIC_ANALYSIS_ERROR,
      retryable: response.status >= 500 || response.status === 429,
      detail: "The server returned malformed JSON.",
    };
  }

  const envelopeError = parseEnvelopeError(parsed, response.status);
  if (envelopeError) return envelopeError;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      code: "REQUEST_FAILED",
      message: GENERIC_ANALYSIS_ERROR,
      retryable: response.status >= 500 || response.status === 429,
    };
  }

  if (isRecord(parsed) && parsed.ok === true && "data" in parsed) {
    return { ok: true, status: response.status, data: parsed.data as T };
  }

  if (isRecord(parsed) && parsed.success === true && "data" in parsed) {
    return { ok: true, status: response.status, data: parsed.data as T };
  }

  return {
    ok: false,
    status: response.status,
    code: "INVALID_RESPONSE_ENVELOPE",
    message: GENERIC_ANALYSIS_ERROR,
    retryable: true,
    detail: "The server response did not match the expected envelope.",
  };
}
