import { z } from "zod";

export const billingCases = [
 "billing.price", "billing.price_plan", "billing.currency", "billing.success", "billing.failed", "billing.created", "billing.pending", "billing.authorized",
 "billing.signature_invalid", "billing.signature_missing", "billing.signature_modified", "billing.signature_secret", "billing.signature_malformed",
 "billing.duplicate", "billing.replay", "billing.concurrent", "billing.order_cancel", "billing.order_upgrade", "billing.order_refund",
 "billing.cancel", "billing.expiry", "billing.upgrade", "billing.downgrade", "billing.refund", "billing.client_plan", "billing.wrong_account", "billing.amount_mismatch",
] as const;
export type BillingCase = typeof billingCases[number];
export const isBilling = (id: string): id is BillingCase => (billingCases as readonly string[]).includes(id);
export const providerSchema = z.enum(["STRIPE", "RAZORPAY", "SYNTHETIC"]);
export type Provider = z.infer<typeof providerSchema>;
export const modeSchema = z.enum(["SYNTHETIC", "TEST", "LIVE"]);
export const confirmedPolicySchema = z.object({
 status: z.literal("CONFIRMED"), version: z.literal(1), confirmedBy: z.literal("reference-lab-operator"),
 activation: z.literal("CAPTURED"), cancel: z.enum(["IMMEDIATE", "PERIOD_END"]), downgrade: z.enum(["IMMEDIATE", "NEXT_PERIOD"]),
 refund: z.enum(["REVOKE", "MANUAL_REVIEW"]), period: z.literal(100), grace: z.literal(0), trial: z.literal("NONE"), credits: z.literal("REPLACE_ON_PLAN_CHANGE"),
}).strict();
export const billingConfigSchema = z.object({provider: providerSchema, mode: modeSchema,
 policy: z.union([confirmedPolicySchema, z.object({status:z.literal("UNKNOWN")}).strict()]),
}).strict();
export type BillingConfig = z.infer<typeof billingConfigSchema>;
// Explicitly confirmed Reference Lab policy, never inferred customer policy.
export const defaultBillingConfig: BillingConfig = {provider:"SYNTHETIC",mode:"SYNTHETIC",policy:{status:"CONFIRMED",version:1,confirmedBy:"reference-lab-operator",activation:"CAPTURED",cancel:"IMMEDIATE",downgrade:"IMMEDIATE",refund:"REVOKE",period:100,grace:0,trial:"NONE",credits:"REPLACE_ON_PLAN_CHANGE"}};
export const plans = {BASIC:{amount:1000,currency:"USD",credits:100},PRO:{amount:2500,currency:"USD",credits:250}} as const;
export const paymentStateSchema=z.enum(["CREATED","PENDING","AUTHORIZED","CAPTURED","FAILED","REFUNDED"]);
export const eventSchema=z.object({provider:providerSchema,providerAccount:z.string().uuid(),mode:modeSchema,id:z.string().uuid(),
 account:z.enum(["control","subject","foreign"]),orderId:z.string().uuid(),paymentId:z.string().uuid(),subscriptionId:z.string().uuid(),invoiceId:z.string().uuid(),refundId:z.string().uuid().nullable(),
 kind:z.enum(["PAYMENT","CANCEL","UPGRADE","DOWNGRADE","REFUND","NOOP"]),state:paymentStateSchema,plan:z.enum(["BASIC","PRO"]),amount:z.number().int().nonnegative().max(100000),currency:z.enum(["USD","INR"]),version:z.number().int().positive().max(100),at:z.number().int().nonnegative(),
}).strict();
export type BillingEvent=z.infer<typeof eventSchema>;
export const accountStateSchema=z.object({plan:z.enum(["FREE","BASIC","PRO"]),payment:paymentStateSchema,subscription:z.enum(["FREE","ACTIVE","CANCELLED","EXPIRED","REFUND_REVIEW"]),
 start:z.number().int().nullable(),end:z.number().int().nullable(),source:z.enum(["payment","subscription"]).nullable(),credits:z.number().int().nonnegative(),effects:z.number().int().nonnegative(),version:z.number().int(),
 cancelAt:z.number().int().nullable(),pendingPlan:z.enum(["BASIC","PRO"]).nullable(),
 order:z.object({plan:z.enum(["BASIC","PRO"]),amount:z.number().int(),currency:z.enum(["USD","INR"]),account:z.enum(["control","subject"])}).strict().nullable(),
}).strict();
export type AccountState=z.infer<typeof accountStateSchema>;
export const snapshotSchema=z.object({now:z.number().int(),account:accountStateSchema,inbox:z.number().int().nonnegative()}).strict();
export type BillingSnapshot=z.infer<typeof snapshotSchema>;
export const billingTraceSchema=z.object({
 controlBefore:snapshotSchema.nullable(),controlAfter:snapshotSchema.nullable(),controlFeature:z.boolean().nullable(),before:snapshotSchema.nullable(),after:snapshotSchema.nullable(),stable:snapshotSchema.nullable(),feature:z.boolean().nullable(),
 checkpoints:z.array(z.object({snapshot:snapshotSchema,allowed:z.boolean()}).strict()).max(4),
 events:z.array(z.object({logicalEvent:z.enum(["control","subject","second","third"]),provider:providerSchema,mode:modeSchema,state:paymentStateSchema,kind:eventSchema.shape.kind,amount:z.number().int(),currency:z.enum(["USD","INR"]),plan:z.enum(["BASIC","PRO"]),version:z.number().int(),at:z.number().int(),deliveries:z.union([z.literal(1),z.literal(2)])}).strict()).max(8),
 eventsDelivered:z.number().int().min(0).max(8),providerOperations:z.number().int().min(0).max(10),financialSpend:z.literal(0),reason:z.enum(["NONE","SAFETY_STOP","REQUIRES_CONFIRMATION","UNKNOWN_PROVIDER_STATE","OBSERVATION_FAILED","ADAPTER_TIMEOUT","ADAPTER_FAILURE"]),
}).strict();
export type BillingTrace=z.infer<typeof billingTraceSchema>;
export type BillingFault="NONE"|"REJECT_ALL"|"MUTATE_500"|"ADAPTER_TIMEOUT"|"UNKNOWN_STATE"|"OBSERVATION_FAILED"|"CLEANUP_FAILURE"|"TRANSACTION_FAILURE";
export const failureType=(id:BillingCase)=>id.startsWith("billing.signature")?"INVALID_WEBHOOK_EFFECT":({
 "billing.price":"PRICE_TAMPER","billing.price_plan":"PRICE_TAMPER","billing.currency":"CURRENCY_TAMPER","billing.success":"DUPLICATE_WEBHOOK_EFFECT","billing.failed":"UNPAID_ENTITLEMENT","billing.created":"UNCAPTURED_ENTITLEMENT","billing.pending":"UNCAPTURED_ENTITLEMENT","billing.authorized":"UNCAPTURED_ENTITLEMENT","billing.duplicate":"DUPLICATE_WEBHOOK_EFFECT","billing.concurrent":"DUPLICATE_WEBHOOK_EFFECT","billing.replay":"REPLAYED_PAYMENT_EFFECT","billing.order_cancel":"STALE_EVENT_OVERWRITE","billing.order_upgrade":"STALE_EVENT_OVERWRITE","billing.order_refund":"STALE_EVENT_OVERWRITE","billing.cancel":"CANCEL_POLICY_VIOLATION","billing.expiry":"EXPIRY_POLICY_VIOLATION","billing.upgrade":"UPGRADE_POLICY_VIOLATION","billing.downgrade":"DOWNGRADE_POLICY_VIOLATION","billing.refund":"REFUND_POLICY_VIOLATION","billing.client_plan":"UNPAID_ENTITLEMENT","billing.wrong_account":"UNPAID_ENTITLEMENT","billing.amount_mismatch":"UNPAID_ENTITLEMENT",
 } as Partial<Record<BillingCase,string>>)[id]!;
export const billingAssertions=[{id:"billing_policy",observation:"billing_policy_satisfied",comparator:"equals" as const,expected:true},{id:"paid_access",observation:"paid_access_matches",comparator:"equals" as const,expected:true},{id:"stable_state",observation:"stable_state",comparator:"equals" as const,expected:true}];
