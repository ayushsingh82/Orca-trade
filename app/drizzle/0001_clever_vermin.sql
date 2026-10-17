CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"strategy" text NOT NULL,
	"policy" jsonb NOT NULL,
	"wallet_public_key" text NOT NULL,
	"wallet_secret_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signal_source" text NOT NULL,
	"rationale" jsonb NOT NULL,
	"citations" jsonb NOT NULL,
	"proposal" jsonb,
	"verdict" text NOT NULL,
	"checks" jsonb NOT NULL,
	"status" text NOT NULL,
	"executed_usd" double precision DEFAULT 0 NOT NULL,
	"tx_signature" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;