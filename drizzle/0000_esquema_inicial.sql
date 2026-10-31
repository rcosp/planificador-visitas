CREATE TYPE "public"."visit_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "sites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"municipality" text NOT NULL,
	"address" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "technicians_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"technician_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" "visit_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visits_starts_at_idx" ON "visits" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "visits_technician_starts_at_idx" ON "visits" USING btree ("technician_id","starts_at");