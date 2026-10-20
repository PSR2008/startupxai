import { loadEnvConfig } from "@next/env";
import { lstat, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { configurationInventory, runtimeConfigurationDigest } from "../src/server/production/inventory";
import { qualificationNames, qualify, stagingManifestSchema, persistQualification, configurationDigest } from "../services/production/qualification";
import { operationsStore } from "../src/server/production/store";

/** Safe default: inventory and persist LOCAL blocked results, never probe a provider. */
async function main() {
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const args = process.argv.slice(2);
  if (args.some((a, i) => a !== "--persist-staging" && a !== "--manifest" && args[i - 1] !== "--manifest")) throw new Error("INVALID_ARGUMENTS");
  let manifest: unknown;
  const index = args.indexOf("--manifest");
  if (index >= 0) {
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("MANIFEST_REQUIRED");
    const file = resolve(args[index + 1]), stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error("MANIFEST_INVALID");
    manifest = stagingManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
  }
  // No live drivers are registered in this environment. Missing infrastructure
  // remains blocked; configured-but-unimplemented drivers stay NOT_IMPLEMENTED.
  const results = await Promise.all(qualificationNames.map(capability => qualify(capability, manifest)));
  if (args.includes("--persist-staging")) {
    const approved = stagingManifestSchema.parse(manifest), inventory = configurationInventory();
    if (process.env.LAUNCHGATE_ENVIRONMENT !== "staging" || process.env.LAUNCHGATE_RESOURCE_ENVIRONMENT !== "staging" ||
        process.env.NEXT_PUBLIC_SUPABASE_URL !== approved.supabaseOrigin ||
        inventory.SUPABASE_SERVICE_ROLE_KEY !== "CONFIGURED") throw new Error("DEDICATED_STAGING_DATABASE_REQUIRED");
    const store = operationsStore();
    await store.command("QUALIFICATION_CONFIG", { organizationId: approved.organizationId, environment: "staging", configurationDigest: configurationDigest(approved), runtimeDigest: runtimeConfigurationDigest() });
    for (const result of results) await persistQualification(store, approved.organizationId, result, runtimeConfigurationDigest());
  }
  const report = { schemaVersion: 1, observedAt: new Date().toISOString(), inventory: configurationInventory(), results, liveOperations: 0, spendUsd: { openai: 0, anthropic: 0 }, productionReady: false };
  const directory = resolve(".launchgate/phase13"); await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `qualification-${randomUUID()}.json`), JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
void main().catch(() => { process.stderr.write("Qualification configuration unavailable or invalid; no secret diagnostics are emitted.\n"); process.exitCode = 1; });
