import { describe, expect, it } from "vitest"

import { SseParser } from "../src/core/sse-parser.js"

describe("SseParser", () => {
  it("parses a named event with data", () => {
    const parser = new SseParser()
    const events = parser.push('event: request\ndata: {"id":"1"}\n\n')

    expect(events).toEqual([
      { event: "request", data: '{"id":"1"}', lastEventId: "" },
    ])
  })

  it("defaults the event name to message", () => {
    const parser = new SseParser()
    expect(parser.push("data: hello\n\n")).toEqual([
      { event: "message", data: "hello", lastEventId: "" },
    ])
  })

  it("joins multi-line data with newlines", () => {
    const parser = new SseParser()
    expect(parser.push("data: a\ndata: b\n\n")).toEqual([
      { event: "message", data: "a\nb", lastEventId: "" },
    ])
  })

  it("buffers events split across chunks", () => {
    const parser = new SseParser()
    expect(parser.push("event: req")).toEqual([])
    expect(parser.push("uest\nda")).toEqual([])
    expect(parser.push("ta: x\n")).toEqual([])
    expect(parser.push("\n")).toEqual([
      { event: "request", data: "x", lastEventId: "" },
    ])
  })

  it("ignores comments and keepalives", () => {
    const parser = new SseParser()
    expect(parser.push(": keepalive\n\n")).toEqual([])
  })

  it("handles CRLF line endings", () => {
    const parser = new SseParser()
    expect(parser.push("event: ready\r\ndata: {}\r\n\r\n")).toEqual([
      { event: "ready", data: "{}", lastEventId: "" },
    ])
  })

  it("strips only a single leading space after the colon", () => {
    const parser = new SseParser()
    expect(parser.push("data:  two-spaces\n\n")).toEqual([
      { event: "message", data: " two-spaces", lastEventId: "" },
    ])
  })

  it("does not dispatch an event with no data", () => {
    const parser = new SseParser()
    expect(parser.push("event: ping\n\n")).toEqual([])
  })

  it("tracks the last event id and parses consecutive events", () => {
    const parser = new SseParser()
    const events = parser.push(
      "id: 7\nevent: request\ndata: a\n\nevent: clear\ndata: b\n\n"
    )

    expect(events).toEqual([
      { event: "request", data: "a", lastEventId: "7" },
      { event: "clear", data: "b", lastEventId: "7" },
    ])
  })
})
