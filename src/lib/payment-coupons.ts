export function getPaymentCouponDiscountPercent(): number {
  if (!process.env.PAYMENT_COUPON_CODE?.trim()) {
    return 0;
  }

  const value = Number(process.env.PAYMENT_COUPON_DISCOUNT_PERCENT ?? "20");
  return Number.isFinite(value) && value > 0 && value < 100 ? value : 0;
}

export function getCouponDiscountCents(baseAmount: number, coupon: unknown): number {
  const configuredCode = process.env.PAYMENT_COUPON_CODE?.trim().toUpperCase();
  const submittedCode = String(coupon || "").trim().toUpperCase();

  if (!configuredCode || !submittedCode || submittedCode !== configuredCode) {
    return 0;
  }

  return Math.round(baseAmount * (getPaymentCouponDiscountPercent() / 100));
}
