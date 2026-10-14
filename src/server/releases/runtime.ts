import "server-only";
import { ReleaseWorker } from "../../../services/releases/worker";
import { GitHubProvider } from "../github/provider";
import { githubConfiguration } from "../github/config";
import { processSnapshot } from "../source-analysis/job";
import { releaseStore } from "./store";
// Separately hosted control-plane process; never invoked by a browser route.
// Unsupported customer verification remains explicit missing coverage.
export async function runReleaseWorker(signal: AbortSignal) {
  const worker = new ReleaseWorker(releaseStore(), { publisher: new GitHubProvider(githubConfiguration()), processSnapshot });
  await worker.run(signal);
}
