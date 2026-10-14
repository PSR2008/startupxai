import { z } from "zod";
const sha = z.string().regex(/^[a-f0-9]{40}$/), id = z.number().int().positive().safe();
// Called only after raw-body HMAC verification. V1 needs push and same-repository
// PR changes. Provider deployments arrive through the existing verified adapter.
export function releaseEvent(event: string, input: unknown) {
  if (!["push", "pull_request", "check_suite"].includes(event)) return null;
  const common = z.object({ installation: z.object({ id }), repository: z.object({ id }) }).parse(input);
  if (event === "push") {
    const p = z.object({ after: sha, before: sha, deleted: z.boolean(), ref: z.string().max(300) }).parse(input);
    if (p.deleted || p.after === "0".repeat(40) || !p.ref.startsWith("refs/heads/")) return null;
    return { installationId: common.installation.id, repositoryId: common.repository.id, headSha: p.after, baseSha: p.before === "0".repeat(40) ? null : p.before, pullRequest: null };
  }
  if (event === "pull_request") {
    const p = z.object({ action: z.string(), number: id, pull_request: z.object({ head: z.object({ sha, repo: z.object({ id }) }), base: z.object({ sha, repo: z.object({ id }) }) }) }).parse(input);
    if (!["opened", "synchronize", "reopened", "ready_for_review"].includes(p.action) || p.pull_request.head.repo.id !== common.repository.id || p.pull_request.base.repo.id !== common.repository.id) return null;
    return { installationId: common.installation.id, repositoryId: common.repository.id, headSha: p.pull_request.head.sha, baseSha: p.pull_request.base.sha, pullRequest: p.number };
  }
  const p = z.object({ action: z.string(), check_suite: z.object({ head_sha: sha }) }).parse(input);
  if (!["requested", "rerequested"].includes(p.action)) return null;
  return { installationId: common.installation.id, repositoryId: common.repository.id, headSha: p.check_suite.head_sha, baseSha: null, pullRequest: null, rerun:p.action==="rerequested" };
}
