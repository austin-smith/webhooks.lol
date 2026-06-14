# webhooks.lol Context

## Domain Vocabulary

### Inbound capture

The server-side flow that receives a webhook request for an endpoint, applies capture rules, persists the captured request, and publishes the live endpoint event after persistence succeeds.

### Webhook repository

The server-side persistence boundary for webhook endpoints and captured requests. It owns Drizzle queries and maps PostgreSQL rows into webhook domain types before route handlers or capture logic see them.

### Endpoint event stream

The live server-sent event stream for one endpoint. It sends readiness, captured request, clear, and heartbeat events while hiding emitter details from route modules.

### Request replay

The flow that takes an already captured request and re-submits it through the
normal capture persistence path, producing a new captured request for the same
endpoint. Replayed requests enter the same post-persistence behavior as newly
captured requests, including live event publication and endpoint forwarding
delivery enqueueing.

### Browser endpoint session

The client-side inspector flow that chooses the active endpoint, remembers recent webhook endpoint IDs, loads endpoint metadata and captured requests, subscribes to the endpoint event stream, and exposes stable endpoint actions to UI modules.
