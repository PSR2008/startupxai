// This module is for the operator-owned Reference Lab only. It never imports a
// customer/model module: validateAutomaticPatch admits exact registered bytes.
import ts from "typescript";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonical, digest } from "../runner/metadata";
import { labSourceIdentity, type RegisteredLabPreview } from "../../reference-lab/host";
import { type RemediationContext, type Proposal } from "./contracts";
import { inPatchWorkspace } from "./patch";
import { validateAutomaticPatch } from "./provider";

export async function withRegisteredPreview<T>(context: RemediationContext, proposal: Proposal, currentSha: string, use: (preview: RegisteredLabPreview, root: string) => Promise<T>): Promise<T> {
  const patch = validateAutomaticPatch(context, proposal, currentSha), harness = labSourceIdentity();
  return inPatchWorkspace(patch, async root => {
    const file = patch.files[0], source = await readFile(join(root, file.path), "utf8");
    if (source !== file.content) throw new Error("PREVIEW_SOURCE_CHANGED");
    const original = new URL(`../../${file.path}`, import.meta.url), require = createRequire(original);
    const transformed = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, transformers: { before: [ctx => node => ts.visitNode(node, function visit(n: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const spec = n.moduleSpecifier.text;
        const resolved = spec.startsWith("node:") ? spec : spec.startsWith(".") ? new URL(spec + ".ts", original).href : pathToFileURL(require.resolve(spec)).href;
        return ctx.factory.updateImportDeclaration(n, n.modifiers, n.importClause, ctx.factory.createStringLiteral(resolved), n.attributes);
      }
      return ts.visitEachChild(n, visit, ctx);
    }) as ts.SourceFile] } });
    const entry = join(root, "registered-preview.mjs"); await writeFile(entry, transformed.outputText, { flag: "wx", mode: 0o600 });
    const fixtureModule = await import(pathToFileURL(entry).href);
    const identityBytes = canonical({ harness, files: patch.files.map(f => ({ path: f.path, digest: digest(f.content) })) });
    const identity = { revision: createHash("sha1").update(identityBytes).digest("hex"), sourceDigest: digest(identityBytes) };
    const preview: RegisteredLabPreview = { identity() {
      if (canonical(labSourceIdentity()) !== canonical(harness)) throw new Error("PREVIEW_HARNESS_CHANGED");
      return identity;
    }, ...(file.path === "reference-lab/runtime.ts" ? { startFixture: fixtureModule.startFixture } : file.path.includes("billing") ? { startBillingFixture: fixtureModule.startBillingFixture } : { startAiFixture: fixtureModule.startAiFixture }) };
    // No Git/Vercel identity is fabricated: revision is explicitly the lab's
    // content-addressed revision, bound before the execution grant is signed.
    return use(preview, fileURLToPath(pathToFileURL(root)));
  });
}
