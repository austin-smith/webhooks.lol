export const MAX_RESPONSE_BODY_BYTES = 64 * 1024
export const MAX_RESPONSE_OVERRIDE_REQUEST_BYTES = 256 * 1024
export const MAX_RESPONSE_CONTENT_TYPE_LENGTH = 120

export type EndpointResponseOverrideInput = {
  status: number
  contentType: string
  body: string
}

export type EndpointResponseConfig =
  | {
      mode: "default"
    }
  | ({
      mode: "custom"
    } & EndpointResponseOverrideInput)

export const DEFAULT_ENDPOINT_RESPONSE_CONFIG: EndpointResponseConfig = {
  mode: "default",
}

export type EndpointResponseTemplateVariables = {
  endpointId: string
  requestId: string
}

export class EndpointResponseValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(" "))
    this.name = "EndpointResponseValidationError"
  }
}

export function parseEndpointResponseOverrideInput(
  value: unknown
): EndpointResponseOverrideInput {
  if (!isRecord(value)) {
    throw new EndpointResponseValidationError([
      "Response override is required.",
    ])
  }

  const status = value.status
  const contentType = value.contentType
  const body = value.body
  const issues: string[] = []
  let parsedStatus: number | null = null
  let parsedContentType: string | null = null
  let parsedBody: string | null = null

  if (
    typeof status !== "number" ||
    !Number.isInteger(status) ||
    status < 200 ||
    status > 599
  ) {
    issues.push("Status must be an integer from 200 through 599.")
  } else {
    parsedStatus = status
  }

  if (typeof contentType !== "string") {
    issues.push("Content type must be a string.")
  } else {
    validateHeaderValue({
      issues,
      label: "Content type",
      maxLength: MAX_RESPONSE_CONTENT_TYPE_LENGTH,
      value: contentType,
    })

    if (!contentType.trim()) {
      issues.push("Content type is required.")
    } else {
      parsedContentType = contentType.trim()
    }
  }

  if (typeof body !== "string") {
    issues.push("Body must be a string.")
  } else if (
    new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BODY_BYTES
  ) {
    issues.push(
      `Body must be ${MAX_RESPONSE_BODY_BYTES.toLocaleString()} bytes or less.`
    )
  } else {
    parsedBody = body
  }

  if (issues.length > 0) {
    throw new EndpointResponseValidationError(issues)
  }

  if (
    parsedStatus === null ||
    parsedContentType === null ||
    parsedBody === null
  ) {
    throw new EndpointResponseValidationError(["Response override is invalid."])
  }

  return {
    status: parsedStatus,
    contentType: parsedContentType,
    body: parsedBody,
  }
}

export function renderEndpointResponseBodyTemplate(
  body: string,
  variables: EndpointResponseTemplateVariables
) {
  return body
    .split("{{request.id}}")
    .join(variables.requestId)
    .split("{{endpoint.id}}")
    .join(variables.endpointId)
}

function validateHeaderValue({
  issues,
  label,
  maxLength,
  value,
}: {
  issues: string[]
  label: string
  maxLength: number
  value: string
}) {
  if (value.length > maxLength) {
    issues.push(`${label} must be ${maxLength} characters or fewer.`)
  }

  if (containsInvalidHeaderValueCharacter(value)) {
    issues.push(`${label} contains characters that are invalid in headers.`)
  }
}

function containsInvalidHeaderValueCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)

    if (code < 0x20 || code === 0x7f || code > 0xff) {
      return true
    }
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
