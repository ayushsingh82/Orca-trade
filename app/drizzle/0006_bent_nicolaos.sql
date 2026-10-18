ALTER TABLE "users" ADD COLUMN "dodo_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dodo_subscription_id_unique" UNIQUE("dodo_subscription_id");