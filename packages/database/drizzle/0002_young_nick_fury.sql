CREATE TABLE "inbox_responses" (
	"token" text PRIMARY KEY NOT NULL,
	"status" integer NOT NULL,
	"content_type" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_responses_status_check" CHECK ("inbox_responses"."status" between 200 and 599),
	CONSTRAINT "inbox_responses_content_type_check" CHECK (length(trim("inbox_responses"."content_type")) > 0)
);
--> statement-breakpoint
ALTER TABLE "inbox_responses" ADD CONSTRAINT "inbox_responses_token_inboxes_token_fk" FOREIGN KEY ("token") REFERENCES "public"."inboxes"("token") ON DELETE cascade ON UPDATE no action;