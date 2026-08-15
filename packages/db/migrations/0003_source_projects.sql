CREATE TABLE "source_projects" (
	"source_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"confidence" numeric(3, 2),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_projects_source_id_project_id_pk" PRIMARY KEY("source_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "source_projects" ADD CONSTRAINT "source_projects_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_projects" ADD CONSTRAINT "source_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;