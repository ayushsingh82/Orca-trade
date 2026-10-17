ALTER TABLE "agents" ADD COLUMN "paper" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "paper_start_usd" double precision DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "fill_units" double precision;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "fill_price" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" text;