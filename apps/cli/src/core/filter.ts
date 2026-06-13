import type { CapturedRequest } from "./types.js"

export interface RequestFilter {
  methods: string[]
  grep: string | null
}

export function createFilter({
  methods,
  grep,
}: {
  methods: string[]
  grep: string | null
}): RequestFilter {
  return {
    methods: methods.map((method) => method.toUpperCase()),
    grep: grep ? grep.toLowerCase() : null,
  }
}

// Lightweight client-side matcher applied uniformly to live and replayed
// requests: an optional method allow-list and a case-insensitive substring
// matched against the path, full URL, and decoded text body.
export function matchesFilter(
  request: CapturedRequest,
  filter: RequestFilter
): boolean {
  if (
    filter.methods.length > 0 &&
    !filter.methods.includes(request.method.toUpperCase())
  ) {
    return false
  }

  if (filter.grep) {
    const haystack =
      `${request.path}\n${request.url}\n${request.bodyText}`.toLowerCase()
    if (!haystack.includes(filter.grep)) {
      return false
    }
  }

  return true
}

export function filterIsActive(filter: RequestFilter): boolean {
  return filter.methods.length > 0 || filter.grep !== null
}
