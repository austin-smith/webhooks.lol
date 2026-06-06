# webhooks.lol Context

## Domain Vocabulary

### Inbound capture

The server-side flow that receives a webhook request for an inbox, applies capture rules, persists the captured request, and publishes the live inbox event after persistence succeeds.

### Webhook repository

The server-side persistence boundary for inboxes and captured requests. It owns Drizzle queries and maps PostgreSQL rows into webhook domain types before route handlers or capture logic see them.

### Inbox event stream

The live server-sent event stream for one inbox. It sends readiness, captured request, clear, and heartbeat events while hiding emitter details from route modules.

### Browser inbox session

The client-side inspector flow that chooses the active inbox, remembers recent inboxes and inbox names, loads captured requests, subscribes to the inbox event stream, and exposes stable inbox actions to UI modules.
