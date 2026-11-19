CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"test_id" text NOT NULL,
	"test_title" text NOT NULL,
	"mode" text NOT NULL,
	"parts" integer[] NOT NULL,
	"answers" jsonb NOT NULL,
	"by_part" jsonb NOT NULL,
	"started_at" bigint NOT NULL,
	"submitted_at" bigint NOT NULL,
	"duration_sec" integer NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"listening_correct" integer NOT NULL,
	"reading_correct" integer NOT NULL,
	"listening_score" integer,
	"reading_score" integer,
	"total_score" integer,
	CONSTRAINT "attempt_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "dictation_event" (
	"user_id" text NOT NULL,
	"at" bigint NOT NULL,
	"test_id" text NOT NULL,
	"group_id" text NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "dictation_event_user_id_at_group_id_pk" PRIMARY KEY("user_id","at","group_id")
);
--> statement-breakpoint
CREATE TABLE "exam_progress" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_progress_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "review_event" (
	"user_id" text NOT NULL,
	"qkey" text NOT NULL,
	"at" bigint NOT NULL,
	"ok" boolean NOT NULL,
	CONSTRAINT "review_event_user_id_qkey_at_pk" PRIMARY KEY("user_id","qkey","at")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_pref" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "user_pref_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocab_card" (
	"user_id" text NOT NULL,
	"word" text NOT NULL,
	"box" integer NOT NULL,
	"due" bigint NOT NULL,
	"last_at" bigint NOT NULL,
	"reviews" integer NOT NULL,
	"lapses" integer NOT NULL,
	CONSTRAINT "vocab_card_user_id_word_pk" PRIMARY KEY("user_id","word")
);
--> statement-breakpoint
CREATE TABLE "vocab_day" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "vocab_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictation_event" ADD CONSTRAINT "dictation_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_progress" ADD CONSTRAINT "exam_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_pref" ADD CONSTRAINT "user_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_card" ADD CONSTRAINT "vocab_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_day" ADD CONSTRAINT "vocab_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempt_user_submitted_idx" ON "attempt" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");