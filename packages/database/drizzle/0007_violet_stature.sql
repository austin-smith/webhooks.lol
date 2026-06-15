CREATE TABLE "endpoint_forward_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"target_path_mode" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_status" integer,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endpoint_forward_deliveries_status_check" CHECK ("endpoint_forward_deliveries"."status" in ('pending', 'delivered', 'failed')),
	CONSTRAINT "endpoint_forward_deliveries_target_path_mode_check" CHECK ("endpoint_forward_deliveries"."target_path_mode" in ('strip', 'preserve')),
	CONSTRAINT "endpoint_forward_deliveries_attempts_check" CHECK ("endpoint_forward_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "endpoint_forward_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"url" text NOT NULL,
	"path_mode" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endpoint_forward_targets_path_mode_check" CHECK ("endpoint_forward_targets"."path_mode" in ('strip', 'preserve')),
	CONSTRAINT "endpoint_forward_targets_url_check" CHECK (length(trim("endpoint_forward_targets"."url")) > 0)
);
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "delete_after_forwarding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoint_forward_deliveries" ADD CONSTRAINT "endpoint_forward_deliveries_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_forward_deliveries" ADD CONSTRAINT "endpoint_forward_deliveries_target_id_endpoint_forward_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."endpoint_forward_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_forward_deliveries" ADD CONSTRAINT "endpoint_forward_deliveries_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_forward_targets" ADD CONSTRAINT "endpoint_forward_targets_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_forward_deliveries_target_request_idx" ON "endpoint_forward_deliveries" USING btree ("target_id","request_id");--> statement-breakpoint
CREATE INDEX "endpoint_forward_deliveries_endpoint_id_idx" ON "endpoint_forward_deliveries" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "endpoint_forward_deliveries_request_id_idx" ON "endpoint_forward_deliveries" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "endpoint_forward_deliveries_status_idx" ON "endpoint_forward_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "endpoint_forward_targets_endpoint_id_idx" ON "endpoint_forward_targets" USING btree ("endpoint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_forward_targets_endpoint_url_path_idx" ON "endpoint_forward_targets" USING btree ("endpoint_id","url","path_mode");