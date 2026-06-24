ALTER TABLE "endpoints" ADD COLUMN "anonymous_session_id" text;--> statement-breakpoint
CREATE INDEX "endpoints_anonymous_session_id_last_activity_idx" ON "endpoints" USING btree ("anonymous_session_id","last_activity_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_single_identity_check" CHECK ("endpoints"."owner_user_id" is null or "endpoints"."anonymous_session_id" is null);
