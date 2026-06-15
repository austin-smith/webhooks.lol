ALTER TABLE "requests" DROP CONSTRAINT "requests_endpoint_id_endpoints_id_fk";
--> statement-breakpoint
ALTER TABLE "endpoint_responses" DROP CONSTRAINT "endpoint_responses_endpoint_id_endpoints_id_fk";
--> statement-breakpoint
DROP INDEX "requests_endpoint_id_received_at_idx";--> statement-breakpoint
DELETE FROM "requests"
WHERE "endpoint_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';--> statement-breakpoint
DELETE FROM "endpoint_responses"
WHERE "endpoint_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';--> statement-breakpoint
DELETE FROM "endpoints"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';--> statement-breakpoint
ALTER TABLE "endpoints" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "endpoint_id" SET DATA TYPE uuid USING "endpoint_id"::uuid;--> statement-breakpoint
ALTER TABLE "endpoint_responses" ALTER COLUMN "endpoint_id" SET DATA TYPE uuid USING "endpoint_id"::uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_responses" ADD CONSTRAINT "endpoint_responses_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_endpoint_id_received_at_idx" ON "requests" USING btree ("endpoint_id","received_at");--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "creator_key_hash" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
UPDATE "endpoints"
SET
  "last_activity_at" = COALESCE(
    (
      SELECT max("requests"."received_at")
      FROM "requests"
      WHERE "requests"."endpoint_id" = "endpoints"."id"
    ),
    "endpoints"."created_at"
  );--> statement-breakpoint
ALTER TABLE "endpoints" ALTER COLUMN "last_activity_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "endpoints" ALTER COLUMN "last_activity_at" SET NOT NULL;
