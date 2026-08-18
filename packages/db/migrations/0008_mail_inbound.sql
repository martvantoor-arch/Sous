CREATE TABLE "source_mail" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"from_raw" text NOT NULL,
	"from_person_id" uuid,
	"to_raw" text[] DEFAULT '{}' NOT NULL,
	"cc_raw" text[] DEFAULT '{}' NOT NULL,
	"routing_tag" text,
	"message_id" text,
	"in_reply_to" text,
	"references" text[] DEFAULT '{}' NOT NULL,
	"body_html" text,
	"headers" jsonb
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "source_mail" ADD CONSTRAINT "source_mail_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_mail" ADD CONSTRAINT "source_mail_from_person_id_people_id_fk" FOREIGN KEY ("from_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_mail_routing_tag_idx" ON "source_mail" USING btree ("routing_tag");--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_email_unique" UNIQUE("email");