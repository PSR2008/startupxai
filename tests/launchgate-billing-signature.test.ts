import { billingTriplets } from "./fixtures/billing-lab";
billingTriplets(["billing.signature_invalid","billing.signature_missing","billing.signature_modified","billing.signature_secret","billing.signature_malformed"]);
