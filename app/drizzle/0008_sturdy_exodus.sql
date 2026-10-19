ALTER TABLE "users" ADD COLUMN "privy_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_privy_id_unique" UNIQUE("privy_id");