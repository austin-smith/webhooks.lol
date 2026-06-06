CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"query" jsonb NOT NULL,
	"headers" jsonb NOT NULL,
	"body_text" text NOT NULL,
	"body_base64" text NOT NULL,
	"body_size" integer NOT NULL,
	"content_type" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"token" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_token_inboxes_token_fk" FOREIGN KEY ("token") REFERENCES "public"."inboxes"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_token_received_at_idx" ON "requests" USING btree ("token","received_at");
