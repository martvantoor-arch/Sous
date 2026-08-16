ALTER TABLE "sources" ALTER COLUMN "raw_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "raw_purged_at" timestamp with time zone;