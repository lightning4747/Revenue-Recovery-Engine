CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"opportunity_id" varchar(64),
	"event_type" varchar(128) NOT NULL,
	"actor" varchar(64) NOT NULL,
	"user_explanation" varchar(1024),
	"technical_snapshot" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_performance_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"payment_method" varchar(64) NOT NULL,
	"bank" varchar(64) NOT NULL,
	"baseline_success_rate" real NOT NULL,
	"current_success_rate" real NOT NULL,
	"sample_count" integer NOT NULL,
	"degradation_flagged" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "merchant_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"key_id" varchar(255) NOT NULL,
	"encrypted_key_secret" varchar(512) NOT NULL,
	"webhook_secret" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_credentials_merchant_id_unique" UNIQUE("merchant_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(64) DEFAULT 'razorpay' NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processing_status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "recovery_opportunities" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"original_transaction_id" varchar(255),
	"original_order_id" varchar(255),
	"last_reference_id" varchar(255),
	"last_payment_link_id" varchar(255),
	"last_payment_link_url" varchar(512),
	"amount" bigint NOT NULL,
	"recovered_amount" bigint DEFAULT 0 NOT NULL,
	"remaining_amount" bigint NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"cause" varchar(128),
	"cause_confidence" real,
	"recovery_probability" real,
	"intervention_cost" bigint,
	"expected_recovery_value" bigint,
	"priority_score" real,
	"status" varchar(32) DEFAULT 'OBSERVED' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recovery_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"opportunity_id" varchar(64) NOT NULL,
	"payment_link_id" varchar(255),
	"razorpay_payment_id" varchar(255) NOT NULL,
	"amount" bigint NOT NULL,
	"status" varchar(32) DEFAULT 'CAPTURED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar(64) NOT NULL,
	"payment_method" varchar(64) NOT NULL,
	"bank" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"failure_reason" varchar(255),
	"amount" bigint NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_opportunity_id_recovery_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."recovery_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_performance_baselines" ADD CONSTRAINT "bank_performance_baselines_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_credentials" ADD CONSTRAINT "merchant_credentials_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_opportunities" ADD CONSTRAINT "recovery_opportunities_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_payments" ADD CONSTRAINT "recovery_payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_payments" ADD CONSTRAINT "recovery_payments_opportunity_id_recovery_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."recovery_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_telemetry" ADD CONSTRAINT "payment_telemetry_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bank_baseline" ON "bank_performance_baselines" USING btree ("merchant_id","payment_method","bank");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_provider_event" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_merchant_payment" ON "recovery_payments" USING btree ("merchant_id","razorpay_payment_id");