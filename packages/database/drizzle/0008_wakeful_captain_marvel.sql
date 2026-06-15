ALTER TABLE "endpoint_forward_deliveries" DROP CONSTRAINT "endpoint_forward_deliveries_status_check";--> statement-breakpoint
DROP INDEX "endpoint_forward_targets_endpoint_url_path_idx";--> statement-breakpoint
ALTER TABLE "endpoint_forward_targets" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_forward_targets_endpoint_url_path_idx" ON "endpoint_forward_targets" USING btree ("endpoint_id","url","path_mode") WHERE "endpoint_forward_targets"."deleted" = false;--> statement-breakpoint
ALTER TABLE "endpoint_forward_deliveries" ADD CONSTRAINT "endpoint_forward_deliveries_status_check" CHECK ("endpoint_forward_deliveries"."status" in ('pending', 'delivered', 'failed', 'cancelled'));