import type { CapturedRequest } from "./types.js"

export const REQUEST_SEARCH_MAX_VALUE_LENGTH = 200
export const REQUEST_SEARCH_MAX_METHODS = 8
export const REQUEST_SEARCH_MAX_CONDITIONS = 8
export const REQUEST_SEARCH_MAX_ADVANCED_LENGTH = 500
const REQUEST_SEARCH_MAX_ADVANCED_TOKENS = 100
const REQUEST_SEARCH_MAX_ADVANCED_DEPTH = 8

export const REQUEST_SEARCH_FIELDS = [
  "path",
  "url",
  "body",
  "headers",
  "query",
  "contentType",
  "ip",
] as const

export type RequestSearchField = (typeof REQUEST_SEARCH_FIELDS)[number]

export type RequestSearchCondition = {
  field: RequestSearchField
  value: string
}

export type BasicRequestSearchCriteria = {
  mode: "basic"
  methods: string[]
  conditions: RequestSearchCondition[]
}

export type AdvancedRequestSearchField =
  | {
      kind: "scalar"
      name: AdvancedRequestSearchScalarField
    }
  | {
      kind: "headers"
      key: string
    }
  | {
      kind: "query"
      key: string
    }

export type AdvancedRequestSearchExpression =
  | {
      kind: "term"
      field: AdvancedRequestSearchField
      value: string
    }
  | {
      kind: "and" | "or"
      left: AdvancedRequestSearchExpression
      right: AdvancedRequestSearchExpression
    }
  | {
      kind: "not"
      expression: AdvancedRequestSearchExpression
    }

export type AdvancedRequestSearchCriteria = {
  mode: "advanced"
  query: string
  expression: AdvancedRequestSearchExpression
}

export type RequestSearchCriteria =
  | BasicRequestSearchCriteria
  | AdvancedRequestSearchCriteria

export type AdvancedRequestSearchScalarField =
  | "method"
  | "path"
  | "url"
  | "headers"
  | "headerName"
  | "headerValue"
  | "query"
  | "queryName"
  | "queryValue"
  | "body"
  | "contentType"
  | "ip"

export type RequestSearchConditionInput = {
  field?: string | null
  value?: string | null
}

export type RequestSearchInput = {
  methods?: readonly string[] | null
  conditions?: readonly RequestSearchConditionInput[] | null
}

export type RequestSearchParseResult =
  | {
      kind: "valid"
      value: RequestSearchCriteria
    }
  | {
      kind: "invalid"
      error: string
    }

export const EMPTY_REQUEST_SEARCH: RequestSearchCriteria = {
  mode: "basic",
  methods: [],
  conditions: [],
}

export function parseRequestSearchCriteria(
  input: RequestSearchInput
): RequestSearchParseResult {
  const methods = normalizeMethods(input.methods ?? [])

  if (!methods) {
    return {
      kind: "invalid",
      error: "Request methods must contain only letters, numbers, or hyphens.",
    }
  }

  if (methods.length > REQUEST_SEARCH_MAX_METHODS) {
    return {
      kind: "invalid",
      error: `Request search accepts at most ${REQUEST_SEARCH_MAX_METHODS} methods.`,
    }
  }

  const conditions = normalizeConditions(input.conditions ?? [])

  if (conditions.kind === "invalid") {
    return conditions
  }

  return {
    kind: "valid",
    value: {
      mode: "basic",
      methods,
      conditions: conditions.value,
    },
  }
}

export function parseAdvancedRequestSearchQuery(
  query: string
): RequestSearchParseResult {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return { kind: "valid", value: EMPTY_REQUEST_SEARCH }
  }

  if (normalizedQuery.length > REQUEST_SEARCH_MAX_ADVANCED_LENGTH) {
    return {
      kind: "invalid",
      error: `Advanced request search must be ${REQUEST_SEARCH_MAX_ADVANCED_LENGTH} characters or fewer.`,
    }
  }

  const tokens = tokenizeAdvancedRequestSearch(normalizedQuery)

  if (tokens.kind === "invalid") {
    return tokens
  }

  if (tokens.value.length > REQUEST_SEARCH_MAX_ADVANCED_TOKENS) {
    return {
      kind: "invalid",
      error: `Advanced request search accepts at most ${REQUEST_SEARCH_MAX_ADVANCED_TOKENS} tokens.`,
    }
  }

  const parser = new AdvancedRequestSearchParser(tokens.value)
  const expression = parser.parse()

  if (expression.kind === "invalid") {
    return expression
  }

  return {
    kind: "valid",
    value: {
      mode: "advanced",
      query: normalizedQuery,
      expression: expression.value,
    },
  }
}

export function requestSearchIsActive(search: RequestSearchCriteria) {
  if (search.mode === "advanced") {
    return true
  }

  return search.methods.length > 0 || search.conditions.length > 0
}

export function requestMatchesSearch(
  request: CapturedRequest,
  search: RequestSearchCriteria
) {
  if (search.mode === "advanced") {
    return advancedExpressionMatchesRequest(request, search.expression)
  }

  if (search.methods.length > 0 && !search.methods.includes(request.method)) {
    return false
  }

  return search.conditions.every((condition) => {
    const haystack = readFieldText(request, condition.field).toLowerCase()

    return haystack.includes(condition.value.toLowerCase())
  })
}

export function serializeRequestSearchCriteria(search: RequestSearchCriteria) {
  const searchParams = new URLSearchParams()

  if (search.mode === "advanced") {
    searchParams.set("search", search.query)
    return searchParams
  }

  for (const method of search.methods) {
    searchParams.append("method", method)
  }

  for (const condition of search.conditions) {
    searchParams.append(condition.field, condition.value)
  }

  return searchParams
}

export function isRequestSearchField(
  value: string
): value is RequestSearchField {
  return REQUEST_SEARCH_FIELDS.some((field) => field === value)
}

export function formatRequestHeadersForSearch(headers: Record<string, string>) {
  return JSON.stringify(headers)
}

export function formatRequestQueryForSearch(query: Record<string, string[]>) {
  return JSON.stringify(query)
}

function readFieldText(request: CapturedRequest, field: RequestSearchField) {
  switch (field) {
    case "body":
      return request.bodyText
    case "contentType":
      return request.contentType ?? ""
    case "headers":
      return formatRequestHeadersForSearch(request.headers)
    case "ip":
      return request.ip ?? ""
    case "path":
      return request.path
    case "query":
      return formatRequestQueryForSearch(request.query)
    case "url":
      return request.url
  }
}

function advancedExpressionMatchesRequest(
  request: CapturedRequest,
  expression: AdvancedRequestSearchExpression
): boolean {
  switch (expression.kind) {
    case "and":
      return (
        advancedExpressionMatchesRequest(request, expression.left) &&
        advancedExpressionMatchesRequest(request, expression.right)
      )
    case "not":
      return !advancedExpressionMatchesRequest(request, expression.expression)
    case "or":
      return (
        advancedExpressionMatchesRequest(request, expression.left) ||
        advancedExpressionMatchesRequest(request, expression.right)
      )
    case "term": {
      const needle = expression.value.toLowerCase()

      if (expression.field.kind === "scalar") {
        if (expression.field.name === "method") {
          return request.method === expression.value.toUpperCase()
        }

        return advancedScalarFieldMatchesRequest(
          request,
          expression.field.name,
          needle
        )
      }

      if (expression.field.kind === "headers") {
        return (request.headers[expression.field.key] ?? "")
          .toLowerCase()
          .includes(needle)
      }

      return (request.query[expression.field.key] ?? []).some((value) =>
        value.toLowerCase().includes(needle)
      )
    }
  }
}

function advancedScalarFieldMatchesRequest(
  request: CapturedRequest,
  field: AdvancedRequestSearchScalarField,
  needle: string
) {
  switch (field) {
    case "body":
      return request.bodyText.toLowerCase().includes(needle)
    case "contentType":
      return (request.contentType ?? "").toLowerCase().includes(needle)
    case "headers":
      return formatRequestHeadersForSearch(request.headers)
        .toLowerCase()
        .includes(needle)
    case "headerName":
      return Object.keys(request.headers).some((key) =>
        key.toLowerCase().includes(needle)
      )
    case "headerValue":
      return Object.values(request.headers).some((value) =>
        value.toLowerCase().includes(needle)
      )
    case "ip":
      return (request.ip ?? "").toLowerCase().includes(needle)
    case "method":
      return request.method.toLowerCase().includes(needle)
    case "path":
      return request.path.toLowerCase().includes(needle)
    case "query":
      return formatRequestQueryForSearch(request.query)
        .toLowerCase()
        .includes(needle)
    case "queryName":
      return Object.keys(request.query).some((key) =>
        key.toLowerCase().includes(needle)
      )
    case "queryValue":
      return Object.values(request.query).some((values) =>
        values.some((value) => value.toLowerCase().includes(needle))
      )
    case "url":
      return request.url.toLowerCase().includes(needle)
  }
}

type AdvancedRequestSearchToken =
  | {
      kind: "word" | "quoted"
      value: string
    }
  | {
      kind: "colon" | "leftParen" | "rightParen"
    }

type AdvancedRequestSearchExpressionParseResult =
  | {
      kind: "valid"
      value: AdvancedRequestSearchExpression
    }
  | {
      kind: "invalid"
      error: string
    }

function tokenizeAdvancedRequestSearch(input: string):
  | {
      kind: "valid"
      value: AdvancedRequestSearchToken[]
    }
  | {
      kind: "invalid"
      error: string
    } {
  const tokens: AdvancedRequestSearchToken[] = []
  let index = 0

  while (index < input.length) {
    const character = input[index]

    if (!character) {
      break
    }

    if (/\s/.test(character)) {
      index += 1
      continue
    }

    if (character === ":") {
      tokens.push({ kind: "colon" })
      index += 1
      continue
    }

    if (character === "(") {
      tokens.push({ kind: "leftParen" })
      index += 1
      continue
    }

    if (character === ")") {
      tokens.push({ kind: "rightParen" })
      index += 1
      continue
    }

    if (character === '"') {
      const quoted = readQuotedAdvancedValue(input, index + 1)

      if (quoted.kind === "invalid") {
        return quoted
      }

      tokens.push({ kind: "quoted", value: quoted.value })
      index = quoted.nextIndex
      continue
    }

    const start = index

    while (
      index < input.length &&
      !/\s/.test(input[index] ?? "") &&
      ![":", "(", ")"].includes(input[index] ?? "")
    ) {
      index += 1
    }

    tokens.push({ kind: "word", value: input.slice(start, index) })
  }

  return { kind: "valid", value: tokens }
}

function readQuotedAdvancedValue(
  input: string,
  startIndex: number
):
  | {
      kind: "valid"
      value: string
      nextIndex: number
    }
  | {
      kind: "invalid"
      error: string
    } {
  let value = ""
  let index = startIndex

  while (index < input.length) {
    const character = input[index]

    if (character === '"') {
      return {
        kind: "valid",
        value,
        nextIndex: index + 1,
      }
    }

    if (character === "\\") {
      const escaped = input[index + 1]

      if (!escaped) {
        return {
          kind: "invalid",
          error: "Advanced request search has an unfinished escape sequence.",
        }
      }

      value += escaped
      index += 2
      continue
    }

    value += character
    index += 1
  }

  return {
    kind: "invalid",
    error: "Advanced request search has an unterminated quoted value.",
  }
}

class AdvancedRequestSearchParser {
  private index = 0

  constructor(private readonly tokens: AdvancedRequestSearchToken[]) {}

  parse(): AdvancedRequestSearchExpressionParseResult {
    if (this.tokens.length === 0) {
      return {
        kind: "invalid",
        error: "Advanced request search cannot be empty.",
      }
    }

    const expression = this.parseOr(0)

    if (expression.kind === "invalid") {
      return expression
    }

    if (this.peek()) {
      return {
        kind: "invalid",
        error: "Advanced request search has unexpected trailing input.",
      }
    }

    return expression
  }

  private parseOr(depth: number): AdvancedRequestSearchExpressionParseResult {
    let left = this.parseAnd(depth)

    if (left.kind === "invalid") {
      return left
    }

    while (this.consumeOperator("OR")) {
      const right = this.parseAnd(depth)

      if (right.kind === "invalid") {
        return right
      }

      left = {
        kind: "valid",
        value: {
          kind: "or",
          left: left.value,
          right: right.value,
        },
      }
    }

    return left
  }

  private parseAnd(depth: number): AdvancedRequestSearchExpressionParseResult {
    let left = this.parseNot(depth)

    if (left.kind === "invalid") {
      return left
    }

    while (this.consumeOperator("AND") || this.nextTokenStartsImplicitAnd()) {
      const right = this.parseNot(depth)

      if (right.kind === "invalid") {
        return right
      }

      left = {
        kind: "valid",
        value: {
          kind: "and",
          left: left.value,
          right: right.value,
        },
      }
    }

    return left
  }

  private parseNot(depth: number): AdvancedRequestSearchExpressionParseResult {
    if (!this.consumeOperator("NOT")) {
      return this.parsePrimary(depth)
    }

    const expression = this.parseNot(depth)

    if (expression.kind === "invalid") {
      return expression
    }

    return {
      kind: "valid" as const,
      value: {
        kind: "not" as const,
        expression: expression.value,
      },
    }
  }

  private parsePrimary(
    depth: number
  ): AdvancedRequestSearchExpressionParseResult {
    if (depth > REQUEST_SEARCH_MAX_ADVANCED_DEPTH) {
      return {
        kind: "invalid",
        error: "Advanced request search is nested too deeply.",
      }
    }

    if (this.consume("leftParen")) {
      const expression = this.parseOr(depth + 1)

      if (expression.kind === "invalid") {
        return expression
      }

      if (!this.consume("rightParen")) {
        return {
          kind: "invalid",
          error: "Advanced request search has an unmatched parenthesis.",
        }
      }

      return expression
    }

    return this.parseTerm()
  }

  private parseTerm(): AdvancedRequestSearchExpressionParseResult {
    const fieldToken = this.consumeWordLike()

    if (!fieldToken) {
      return {
        kind: "invalid",
        error: "Advanced request search expected a field name.",
      }
    }

    if (isBooleanOperator(fieldToken.value)) {
      return {
        kind: "invalid",
        error: "Advanced request search expected a field name.",
      }
    }

    if (!this.consume("colon")) {
      return {
        kind: "invalid",
        error: `Advanced request search field "${fieldToken.value}" is missing a value.`,
      }
    }

    const valueToken = this.consumeWordLike()

    if (!valueToken || isBooleanOperator(valueToken.value)) {
      return {
        kind: "invalid",
        error: `Advanced request search field "${fieldToken.value}" is missing a value.`,
      }
    }

    const value = normalizeSearchValue(valueToken.value)

    if (!value) {
      return {
        kind: "invalid",
        error: "Advanced request search values cannot be empty.",
      }
    }

    if (value.length > REQUEST_SEARCH_MAX_VALUE_LENGTH) {
      return {
        kind: "invalid",
        error: `Request search values must be ${REQUEST_SEARCH_MAX_VALUE_LENGTH} characters or fewer.`,
      }
    }

    const field = parseAdvancedRequestSearchField(fieldToken.value)

    if (field.kind === "invalid") {
      return field
    }

    return {
      kind: "valid",
      value: {
        kind: "term",
        field: field.value,
        value,
      },
    }
  }

  private nextTokenStartsImplicitAnd() {
    const token = this.peek()

    if (!token || token.kind === "rightParen") {
      return false
    }

    if (token.kind === "leftParen") {
      return true
    }

    if (token.kind === "word") {
      return !["AND", "OR"].includes(token.value.toUpperCase())
    }

    return false
  }

  private consumeOperator(operator: "AND" | "OR" | "NOT") {
    const token = this.peek()

    if (token?.kind === "word" && token.value.toUpperCase() === operator) {
      this.index += 1
      return true
    }

    return false
  }

  private consumeWordLike() {
    const token = this.peek()

    if (token?.kind !== "word" && token?.kind !== "quoted") {
      return undefined
    }

    this.index += 1
    return token
  }

  private consume(kind: AdvancedRequestSearchToken["kind"]) {
    if (this.peek()?.kind !== kind) {
      return false
    }

    this.index += 1
    return true
  }

  private peek() {
    return this.tokens[this.index]
  }
}

function parseAdvancedRequestSearchField(field: string):
  | {
      kind: "valid"
      value: AdvancedRequestSearchField
    }
  | {
      kind: "invalid"
      error: string
    } {
  switch (field) {
    case "body":
    case "contentType":
    case "headers":
    case "headerName":
    case "headerValue":
    case "ip":
    case "method":
    case "path":
    case "query":
    case "queryName":
    case "queryValue":
    case "url":
      return { kind: "valid", value: { kind: "scalar", name: field } }
  }

  const [namespace, key, ...extra] = field.split(".")

  if (extra.length > 0 || !namespace || !key) {
    return {
      kind: "invalid",
      error: `Advanced request search field "${field}" is not supported.`,
    }
  }

  if (namespace === "headers") {
    if (!isValidHeaderSearchKey(key)) {
      return {
        kind: "invalid",
        error: `Advanced request search header field "${field}" is invalid.`,
      }
    }

    return {
      kind: "valid",
      value: { kind: "headers", key: key.toLowerCase() },
    }
  }

  if (namespace === "query") {
    if (!isValidQuerySearchKey(key)) {
      return {
        kind: "invalid",
        error: `Advanced request search query field "${field}" is invalid.`,
      }
    }

    return { kind: "valid", value: { kind: "query", key } }
  }

  return {
    kind: "invalid",
    error: `Advanced request search field "${field}" is not supported.`,
  }
}

function isBooleanOperator(value: string) {
  return ["AND", "OR", "NOT"].includes(value.toUpperCase())
}

function isValidHeaderSearchKey(value: string) {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,128}$/.test(value)
}

function isValidQuerySearchKey(value: string) {
  return /^[^\s:()"\\]{1,128}$/.test(value)
}

function normalizeConditions(
  conditions: readonly RequestSearchConditionInput[]
):
  | {
      kind: "valid"
      value: RequestSearchCondition[]
    }
  | {
      kind: "invalid"
      error: string
    } {
  const normalizedConditions: RequestSearchCondition[] = []

  for (const condition of conditions) {
    const value = normalizeSearchValue(condition.value ?? "")

    if (!value) {
      continue
    }

    if (normalizedConditions.length >= REQUEST_SEARCH_MAX_CONDITIONS) {
      return {
        kind: "invalid",
        error: `Request search accepts at most ${REQUEST_SEARCH_MAX_CONDITIONS} field filters.`,
      }
    }

    if (value.length > REQUEST_SEARCH_MAX_VALUE_LENGTH) {
      return {
        kind: "invalid",
        error: `Request search values must be ${REQUEST_SEARCH_MAX_VALUE_LENGTH} characters or fewer.`,
      }
    }

    const field = condition.field ?? "path"

    if (!isRequestSearchField(field)) {
      return {
        kind: "invalid",
        error: "Request search field is invalid.",
      }
    }

    normalizedConditions.push({ field, value })
  }

  return {
    kind: "valid",
    value: normalizedConditions,
  }
}

function normalizeSearchValue(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeMethods(methods: readonly string[]) {
  const normalizedMethods = new Set<string>()

  for (const method of methods) {
    const normalizedMethod = method.trim().toUpperCase()

    if (!normalizedMethod) {
      continue
    }

    if (!/^[A-Z0-9-]{1,16}$/.test(normalizedMethod)) {
      return null
    }

    normalizedMethods.add(normalizedMethod)
  }

  return [...normalizedMethods]
}
