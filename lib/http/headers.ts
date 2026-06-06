export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods":
    "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
  "Access-Control-Allow-Origin": "*",
}

export const CORS_NO_STORE_HEADERS = {
  ...CORS_HEADERS,
  ...NO_STORE_HEADERS,
}

export const WEBHOOK_RESPONSE_SECURITY_HEADERS = {
  "Content-Security-Policy":
    "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
}

export const EVENT_STREAM_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
  "X-Accel-Buffering": "no",
}
