import { billingTriplets,configured } from "./fixtures/billing-lab";
billingTriplets(["billing.cancel","billing.expiry"]);
billingTriplets(["billing.cancel"],configured("SYNTHETIC",{cancel:"PERIOD_END"}),"period-end ");
