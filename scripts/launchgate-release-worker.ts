import { runReleaseWorker } from "../src/server/releases/runtime";
const stop = new AbortController();
process.once("SIGINT", () => stop.abort());
process.once("SIGTERM", () => stop.abort());
void runReleaseWorker(stop.signal).catch(() => { process.stderr.write("LaunchGate release worker configuration unavailable.\n"); process.exitCode = 1; });
