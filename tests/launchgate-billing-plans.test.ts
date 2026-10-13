import { billingTriplets,configured } from "./fixtures/billing-lab";
billingTriplets(["billing.upgrade","billing.downgrade","billing.client_plan"]);
billingTriplets(["billing.downgrade"],configured("SYNTHETIC",{downgrade:"NEXT_PERIOD"}),"next-period ");
