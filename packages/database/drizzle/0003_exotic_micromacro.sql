ALTER TABLE "inbox_responses" RENAME TO "endpoint_responses";--> statement-breakpoint
ALTER TABLE "inboxes" RENAME TO "endpoints";--> statement-breakpoint
ALTER TABLE "requests" RENAME COLUMN "token" TO "endpoint_id";--> statement-breakpoint
ALTER TABLE "endpoint_responses" RENAME COLUMN "token" TO "endpoint_id";--> statement-breakpoint
ALTER TABLE "endpoints" RENAME COLUMN "token" TO "id";--> statement-breakpoint
ALTER TABLE "endpoint_responses" DROP CONSTRAINT "inbox_responses_status_check";--> statement-breakpoint
ALTER TABLE "endpoint_responses" DROP CONSTRAINT "inbox_responses_content_type_check";--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_token_inboxes_token_fk";
--> statement-breakpoint
ALTER TABLE "endpoint_responses" DROP CONSTRAINT "inbox_responses_token_inboxes_token_fk";
--> statement-breakpoint
DROP INDEX "requests_token_received_at_idx";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_responses" ADD CONSTRAINT "endpoint_responses_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_endpoint_id_received_at_idx" ON "requests" USING btree ("endpoint_id","received_at");--> statement-breakpoint
ALTER TABLE "endpoint_responses" ADD CONSTRAINT "endpoint_responses_status_check" CHECK ("endpoint_responses"."status" between 200 and 599);--> statement-breakpoint
ALTER TABLE "endpoint_responses" ADD CONSTRAINT "endpoint_responses_content_type_check" CHECK (length(trim("endpoint_responses"."content_type")) > 0);