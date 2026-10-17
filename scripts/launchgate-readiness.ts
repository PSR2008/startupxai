import { localQualificationReport } from "../src/server/production/configuration";
// No provider probing or secret values. General CI can execute this safely.
process.stdout.write(`${JSON.stringify(localQualificationReport(), null, 2)}\n`);
