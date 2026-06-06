# webhooks.lol Context

## Domain Vocabulary

### Inbound capture

The server-side flow that receives a webhook request for an endpoint, applies capture rules, persists the captured request, and publishes the live endpoint event after persistence succeeds.

### Webhook repository

The server-side persistence boundary for webhook endpoints and captured requests. It owns Drizzle queries and maps PostgreSQL rows into webhook domain types before route handlers or capture logic see them.

### Endpoint event stream

The live server-sent event stream for one endpoint. It sends readiness, captured request, clear, and heartbeat events while hiding emitter details from route modules.

### Browser endpoint session

The client-side inspector flow that chooses the active endpoint, remembers recent webhook endpoints and endpoint names, loads captured requests, subscribes to the endpoint event stream, and exposes stable endpoint actions to UI modules.
