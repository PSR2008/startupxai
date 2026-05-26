# StartupX AI — Phase 2: Usage Tracking Integration Guide

## What This Adds

| Feature | Status |
|---------|--------|
| `usage_logs` Supabase table | ✅ NEW |
| `logUsage()` server-side helper | ✅ NEW |
| `getUsageSummary()` for API | ✅ NEW |
| `logUsageClient()` fire-and-forget client helper | ✅ NEW |
| `GET /api/check-usage` — dashboard data endpoint | ✅ NEW |
| `POST /api/usage-log` — receives client-side usage pings | ✅ NEW |
| `UsageWidget` — animated progress card | ✅ NEW |
| `SubscriptionStatusCard` — billing detail card | ✅ NEW |
| Dashboard patched with both cards | ✅ NEW |
| All 8 engine pages patched (1 import + 1 call each) | ✅ PATCHED |
| No hard limit blocking | ✅ CONFIRMED |
| All existing engine logic unchanged | ✅ CONFIRMED |

---

## File Map

### NEW FILES — create these

```
migrations/002_usage_tracking.sql
src/lib/usage.ts
src/lib/usage-client.ts
src/app/api/check-usage/route.ts
src/app/api/usage-log/route.ts
src/components/app/UsageWidget.tsx
src/components/app/SubscriptionStatusCard.tsx
```

### REPLACE FILES — copy over same path

```
src/app/(app)/dashboard/page.tsx          ← adds UsageWidget + SubscriptionStatusCard
src/app/(app)/brand-forge/page.tsx        ← adds logUsageClient("brand-forge")
src/app/(app)/cold-dm/page.tsx            ← adds logUsageClient("cold-dm")
src/app/(app)/competitor-intelligence/page.tsx ← adds logUsageClient("competitor")
src/app/(app)/founder-decision/page.tsx   ← adds logUsageClient("decision")
src/app/(app)/growth-engine/page.tsx      ← adds logUsageClient("growth")
src/app/(app)/idea-engine/page.tsx        ← adds logUsageClient("idea")
src/app/(app)/revenue-engine/page.tsx     ← adds logUsageClient("revenue")
src/app/(app)/user-psychology/page.tsx    ← adds logUsageClient("psychology")
```

### UNTOUCHED — do not modify

```
All API engine routes (src/app/api/analyze/*/route.ts)
All API generate routes (src/app/api/generate/*/route.ts)
src/app/api/razorpay/*
src/lib/supabase.ts
src/lib/supabase-client.ts
src/lib/ai.ts
src/lib/rate-limit.ts
src/lib/plans.ts
src/lib/subscription.ts
package.json / next.config.ts / tsconfig.json
```

---

## Integration Order

### Step 1 — SQL Migration

> **Prerequisite**: `migrations/001_billing_infrastructure.sql` must already be applied.

Open **Supabase Dashboard → SQL Editor**, paste `migrations/002_usage_tracking.sql`, click **Run**.

Verify:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_plans', 'payments', 'usage_logs');
-- Must return 3 rows
```

### Step 2 — Copy new lib files

```bash
cp phase2/src/lib/usage.ts          your-project/src/lib/usage.ts
cp phase2/src/lib/usage-client.ts   your-project/src/lib/usage-client.ts
```

### Step 3 — Copy new API routes

```bash
cp phase2/src/app/api/check-usage/route.ts    your-project/src/app/api/check-usage/route.ts
cp phase2/src/app/api/usage-log/route.ts      your-project/src/app/api/usage-log/route.ts
```
(Create the directories first if they don't exist.)

### Step 4 — Copy new components

```bash
cp phase2/src/components/app/UsageWidget.tsx             your-project/src/components/app/UsageWidget.tsx
cp phase2/src/components/app/SubscriptionStatusCard.tsx  your-project/src/components/app/SubscriptionStatusCard.tsx
```

### Step 5 — Replace dashboard + engine pages

```bash
# Dashboard
cp "phase2/src/app/(app)/dashboard/page.tsx" \
   "your-project/src/app/(app)/dashboard/page.tsx"

# Engine pages (8 files)
for page in brand-forge cold-dm competitor-intelligence founder-decision \
            growth-engine idea-engine revenue-engine user-psychology; do
  cp "phase2/src/app/(app)/$page/page.tsx" \
     "your-project/src/app/(app)/$page/page.tsx"
done
```

### Step 6 — Build check

```bash
npm run type-check   # 0 TypeScript errors
npm run build        # must pass
```

---

## npm Installs

No new packages required. All dependencies already in your project:
- `@supabase/supabase-js` ✓
- `framer-motion` ✓
- `lucide-react` ✓

---

## How Usage Logging Works

```
User runs engine page
       ↓
Engine page calls fetch("/api/analyze/idea", ...)
       ↓
API returns { success: true, data: ... }
       ↓
Engine page: setResult(data.data); setStatus("success");
             logUsageClient("idea");   ← NEW: fire-and-forget
       ↓
logUsageClient() reads Supabase session token from localStorage
       ↓
Calls POST /api/usage-log { engine_name: "idea" } with Bearer token
       ↓
/api/usage-log verifies token → gets user_id
       ↓
Calls logUsage(userId, "idea") → inserts to usage_logs table
       ↓
/api/check-usage aggregates usage_logs for dashboard display
```

---

## Testing Checklist

### Supabase verification steps

After running an engine analysis:
```sql
-- Check usage was logged
SELECT user_id, engine_name, created_at
FROM usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check monthly count for a user
SELECT COUNT(*) FROM usage_logs
WHERE user_id = 'YOUR_USER_UUID'
AND created_at >= date_trunc('month', now());
```

### Dashboard testing steps

1. Log in to the app
2. Open `/dashboard`
3. **UsageWidget** should show:
   - "Free Plan" badge (if no user_plans row) OR "Founder Plan" badge
   - Progress bar at the correct percentage
   - Correct "X / 15" or "X / 500" count
4. **SubscriptionStatusCard** should show:
   - "Free Plan" with upgrade CTA for free users
   - "Founder / Active" with renewal date for paid users

5. Run any engine analysis
6. Return to `/dashboard`
7. Count should increment by 1

### API testing steps

```bash
# Test check-usage (replace TOKEN with your Supabase session token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/check-usage

# Expected response:
# { "plan": "free", "billing_cycle": null, "monthly_limit": 15,
#   "analyses_used": 3, "analyses_remaining": 12, "expires_at": null }

# Test usage-log
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"engine_name":"test"}' \
  http://localhost:3000/api/usage-log

# Expected: { "ok": true }
```

### Confirm no blocking

- Run 20 analyses as a free user
- All should succeed — no 429, no blocked responses
- Dashboard will show 20 / 15 (over-limit display only)
- Upgrade prompt becomes more prominent

---

## Engine Name → Slug Reference

| Engine Page | logUsageClient slug |
|-------------|---------------------|
| Idea & Market Engine | `"idea"` |
| Competitor Intelligence | `"competitor"` |
| Revenue Engine | `"revenue"` |
| User Psychology Engine | `"psychology"` |
| Growth Engine | `"growth"` |
| Founder Decision Engine | `"decision"` |
| BrandForge AI | `"brand-forge"` |
| ColdDM AI | `"cold-dm"` |
