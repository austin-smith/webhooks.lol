ALTER TABLE "endpoints" DROP CONSTRAINT "endpoints_single_identity_check";--> statement-breakpoint
DELETE FROM "endpoints" WHERE "owner_user_id" IS NULL AND "anonymous_session_id" IS NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_single_identity_check" CHECK (num_nonnulls("endpoints"."owner_user_id", "endpoints"."anonymous_session_id") = 1);
