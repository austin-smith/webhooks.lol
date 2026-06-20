ALTER TABLE "endpoints" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "endpoints_owner_user_id_last_activity_idx" ON "endpoints" USING btree ("owner_user_id","last_activity_at" DESC NULLS LAST,"id" DESC NULLS LAST);
