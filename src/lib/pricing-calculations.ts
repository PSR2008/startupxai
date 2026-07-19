export interface PricingScenario {
  label: "Conservative" | "Base" | "Aggressive";
  price: number;
  payingCustomers: number;
  monthlyRevenue: number;
  grossProfit: number | null;
  cacPaybackMonths: number | null;
}

export interface PricingCalculationInput {
  existingPriceIdea?: string;
  expectedCustomerWillingnessToPay?: string;
  estimatedCac?: string;
  grossMarginPercent?: string;
  freeTierAvailability?: string;
  expectedFreeToPaidConversion?: string;
  targetMonthlyRevenue?: string;
  customerVolumeAssumption?: string;
  variableCostPerCustomer?: string;
}

export interface PricingCalculationOutput {
  assumptionsUsed: string[];
  scenarios: PricingScenario[];
  customersRequiredForTargetRevenue: number | null;
  freemiumPayingCustomers: number | null;
  warnings: string[];
}

function parseNumber(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function clampPercent(value: number | null): number | null {
  if (value == null) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePricingScenarios(input: PricingCalculationInput): PricingCalculationOutput {
  const priceIdea = parseNumber(input.existingPriceIdea);
  const willingness = parseNumber(input.expectedCustomerWillingnessToPay);
  const cac = parseNumber(input.estimatedCac);
  const grossMarginPercent = clampPercent(parseNumber(input.grossMarginPercent));
  const conversionPercent = clampPercent(parseNumber(input.expectedFreeToPaidConversion));
  const targetRevenue = parseNumber(input.targetMonthlyRevenue);
  const totalUsers = parseNumber(input.customerVolumeAssumption);
  const variableCost = parseNumber(input.variableCostPerCustomer);
  const basePrice = willingness ?? priceIdea ?? null;
  const payingCustomers =
    totalUsers != null && conversionPercent != null
      ? Math.max(0, Math.floor(totalUsers * (conversionPercent / 100)))
      : totalUsers ?? null;

  const warnings: string[] = [];
  if (parseNumber(input.grossMarginPercent) != null && grossMarginPercent == null) {
    warnings.push("Gross margin must be between 0 and 100 percent.");
  }
  if (parseNumber(input.expectedFreeToPaidConversion) != null && conversionPercent == null) {
    warnings.push("Free-to-paid conversion must be between 0 and 100 percent.");
  }
  if (!basePrice) {
    warnings.push("Add a price idea or willingness-to-pay estimate to calculate scenarios.");
  }
  if (!payingCustomers) {
    warnings.push("Add customer volume assumptions to estimate scenario revenue.");
  }

  const assumptionsUsed = [
    basePrice != null ? `Base price: $${basePrice}` : "",
    payingCustomers != null ? `Paying customers: ${payingCustomers}` : "",
    grossMarginPercent != null ? `Gross margin: ${grossMarginPercent}%` : "",
    cac != null ? `CAC: $${cac}` : "",
    targetRevenue != null ? `Target monthly revenue: $${targetRevenue}` : "",
    input.freeTierAvailability ? `Free tier: ${input.freeTierAvailability}` : "",
  ].filter(Boolean);

  const multipliers: Array<{ label: PricingScenario["label"]; price: number; customers: number }> = [
    { label: "Conservative", price: 0.8, customers: 0.75 },
    { label: "Base", price: 1, customers: 1 },
    { label: "Aggressive", price: 1.25, customers: 1.15 },
  ];

  const scenarios =
    basePrice && payingCustomers
      ? multipliers.map((scenario) => {
          const price = roundMoney(basePrice * scenario.price);
          const customerCount = Math.max(1, Math.floor(payingCustomers * scenario.customers));
          const monthlyRevenue = roundMoney(price * customerCount);
          const grossProfit =
            grossMarginPercent != null
              ? roundMoney(monthlyRevenue * (grossMarginPercent / 100))
              : variableCost != null
              ? roundMoney((price - variableCost) * customerCount)
              : null;
          const cacPaybackMonths =
            cac != null && grossProfit != null && grossProfit > 0
              ? roundMoney(cac / (grossProfit / customerCount))
              : null;

          return {
            label: scenario.label,
            price,
            payingCustomers: customerCount,
            monthlyRevenue,
            grossProfit,
            cacPaybackMonths,
          };
        })
      : [];

  return {
    assumptionsUsed,
    scenarios,
    customersRequiredForTargetRevenue:
      targetRevenue != null && basePrice ? Math.ceil(targetRevenue / basePrice) : null,
    freemiumPayingCustomers:
      totalUsers != null && conversionPercent != null
        ? Math.floor(totalUsers * (conversionPercent / 100))
        : null,
    warnings,
  };
}
