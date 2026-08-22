import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  getRazorpayPlanAmountPaise,
  getRazorpayPlanAmountRupees,
  isExpectedRazorpayPlanAmount,
  RAZORPAY_CURRENCY,
} from "../src/lib/razorpay-plans";

const root = process.cwd();
const createOrderRoute = readFileSync(join(root, "src/app/api/razorpay/create-order/route.ts"), "utf8");
const verifyPaymentRoute = readFileSync(join(root, "src/app/api/razorpay/verify-payment/route.ts"), "utf8");
const webhookRoute = readFileSync(join(root, "src/app/api/razorpay/webhook/route.ts"), "utf8");
const paymentPage = readFileSync(join(root, "src/app/(app)/payment/page.tsx"), "utf8");
const activation = readFileSync(join(root, "src/lib/payment-activation.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/013_user_plan_monthly_analysis_limit.sql"), "utf8");

test("Razorpay paid-plan prices use fixed server-side INR amounts", () => {
  assert.equal(RAZORPAY_CURRENCY, "INR");
  assert.equal(getRazorpayPlanAmountRupees("founder", "monthly"), 399);
  assert.equal(getRazorpayPlanAmountRupees("founder", "yearly"), 3999);
  assert.equal(getRazorpayPlanAmountRupees("growth", "monthly"), 799);
  assert.equal(getRazorpayPlanAmountRupees("growth", "yearly"), 7999);
  assert.equal(getRazorpayPlanAmountRupees("scale", "monthly"), 1199);
  assert.equal(getRazorpayPlanAmountRupees("scale", "yearly"), 11999);
  assert.equal(getRazorpayPlanAmountPaise("scale", "yearly"), 1199900);
  assert.equal(isExpectedRazorpayPlanAmount("growth", "monthly", 79900, "INR"), true);
  assert.equal(isExpectedRazorpayPlanAmount("growth", "monthly", 1000, "INR"), false);
  assert.equal(isExpectedRazorpayPlanAmount("growth", "monthly", 79900, "USD"), false);
});

test("create-order chooses Razorpay amount and currency on the server", () => {
  assert.match(createOrderRoute, /getRazorpayPlanAmountPaise\(selectedPlan, normalizedBilling\)/);
  assert.match(createOrderRoute, /currency:\s*RAZORPAY_CURRENCY/);
  assert.match(createOrderRoute, /notes:\s*\{[\s\S]*plan:\s*selectedPlan[\s\S]*billing:\s*normalizedBilling/);
  assert.doesNotMatch(createOrderRoute, /amount\s*=\s*body|body\.amount|getPlanPriceCents|getAllowedPaidAmounts|getCouponDiscountCents|USD/);
});

test("payment verification and webhook validate fetched order against the same INR plan map", () => {
  for (const source of [verifyPaymentRoute, webhookRoute]) {
    assert.match(source, /isExpectedRazorpayPlanAmount\(orderPlan,\s*orderBilling|isExpectedRazorpayPlanAmount\(orderPlan,\s*billingCycle/);
    assert.doesNotMatch(source, /getAllowedPaidAmounts|getPaymentCouponDiscountPercent|currency !== "USD"/);
  }
});

test("payment page supports all paid plans without sending client-controlled amount", () => {
  for (const plan of ["founder", "growth", "scale"]) {
    assert.match(paymentPage, new RegExp(`${plan}: \\{`));
  }
  assert.match(paymentPage, /getRazorpayPlanAmountRupees\(planParam, billing\)/);
  assert.match(paymentPage, /body:\s*JSON\.stringify\(\{ plan: planParam, billing \}\)/);
  assert.doesNotMatch(paymentPage, /coupon|body:\s*JSON\.stringify\(\{ plan: planParam, billing, amount|body:\s*JSON\.stringify\(\{ plan: planParam, billing, currency/);
});

test("paid plan activation stores plan, billing, active expiry and monthly limit", () => {
  assert.match(activation, /getPlanEntitlements\(params\.plan\)\.monthlyAnalyses/);
  assert.match(activation, /plan:\s*params\.plan/);
  assert.match(activation, /billing_cycle:\s*params\.billingCycle/);
  assert.match(activation, /active:\s*true/);
  assert.match(activation, /expires_at:\s*expiresAt/);
  assert.match(activation, /monthly_analysis_limit:\s*monthlyAnalysisLimit/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS monthly_analysis_limit integer/);
  assert.match(migration, /WHEN 'founder' THEN 50/);
  assert.match(migration, /WHEN 'growth' THEN 150/);
  assert.match(migration, /WHEN 'scale' THEN 400/);
});
