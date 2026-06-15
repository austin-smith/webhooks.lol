CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gin";--> statement-breakpoint
DROP INDEX IF EXISTS "requests_endpoint_id_received_at_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_field_search_trgm_idx" ON "requests" USING gin ("endpoint_id" uuid_ops,lower("path") gin_trgm_ops,lower("url") gin_trgm_ops,lower("headers"::text) gin_trgm_ops,lower("query"::text) gin_trgm_ops,lower("body_text") gin_trgm_ops,lower(coalesce("content_type", '')) gin_trgm_ops,lower(coalesce("ip", '')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_endpoint_id_received_at_idx" ON "requests" USING btree ("endpoint_id","received_at" DESC NULLS LAST,"id" DESC NULLS LAST);
