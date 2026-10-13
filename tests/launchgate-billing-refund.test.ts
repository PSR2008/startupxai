import { billingTriplets,configured } from "./fixtures/billing-lab";
billingTriplets(["billing.refund"]);
billingTriplets(["billing.refund"],configured("SYNTHETIC",{refund:"MANUAL_REVIEW"}),"manual-review ");
