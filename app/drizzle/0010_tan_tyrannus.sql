CREATE TABLE "watchlist" (
	"user_id" uuid NOT NULL,
	"coin_id" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_coin_id_pk" PRIMARY KEY("user_id","coin_id")
);
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;