import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("ScrollStack product cards use editorial hierarchy instead of decorative icons", () => {
  const source = read("src/components/marketing/ProductScrollStackSection.tsx");

  assert.doesNotMatch(source, /\bicon:\s*[A-Z][A-Za-z0-9_]*/);
  assert.doesNotMatch(source, /const Icon = card\.icon/);
  assert.doesNotMatch(source, /CheckCircle2/);
  assert.match(source, /card\.number/);
  assert.match(source, /before:content-\['-'\]/);
});

test("homepage marketing sections avoid decorative icon card maps and check bullets", () => {
  const source = read("src/components/marketing/EnginesSection.tsx");

  assert.doesNotMatch(source, /\bicon:\s*(SearchCheck|Shield|Globe|BarChart3|Users|CheckCircle2|Lightbulb|Swords|DollarSign|Brain|TrendingUp|Target|MessageSquare|Palette|FileText|Zap|Scale)\b/);
  assert.doesNotMatch(source, /const Icon = (engine|tool|f|step|item)\.icon/);
  assert.doesNotMatch(source, /<CheckCircle2\b/);
  assert.match(source, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
});

test("authenticated dashboard and engine intro cards are text-led", () => {
  const dashboard = read("src/app/(app)/dashboard/page.tsx");
  const evidenceEngine = read("src/app/(app)/evidence-engine/page.tsx");
  const engineHeader = read("src/components/app/EngineHeader.tsx");

  assert.doesNotMatch(dashboard, /\bicon:\s*(SearchCheck|Lightbulb|FlaskConical|FileText|Target|ClipboardList|MessageSquare|Settings)\b/);
  assert.doesNotMatch(dashboard, /const Icon = tool\.icon|const Icon = action\.icon/);
  assert.doesNotMatch(evidenceEngine, /icon:\s*(Database|BarChart3|FlaskConical|ShieldCheck)/);
  assert.doesNotMatch(engineHeader, /rounded-xl flex items-center justify-center/);
  assert.match(engineHeader, /border-l border-black\/10/);
});

test("public pricing, methodology, support, and reports replace decorative icon bullets", () => {
  const pricing = read("src/app/(marketing)/pricing/page.tsx");
  const methodology = read("src/app/(marketing)/methodology/page.tsx");
  const support = read("src/app/(marketing)/support/page.tsx");
  const reports = read("src/app/(app)/reports/page.tsx");

  assert.doesNotMatch(pricing, /CheckCircle2|Zap|<X\b/);
  assert.doesNotMatch(methodology, /CheckCircle2/);
  assert.doesNotMatch(support, /Mail, MessageSquare, BookOpen, Zap|ch\.icon|const Icon = ch\.icon/);
  assert.doesNotMatch(reports, /FileText/);
});
