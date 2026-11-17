# SEO-first Foundation 2.0 — Incremental implementation

Reference: user-supplied "NGỌC AGENT STUDIO 2.0 — MASTER BLUEPRINT", 17/11/2026. This release implements the P0/P1 **foundation** rather than claiming the entire Definition of Done.

## Delivered
- Canonical SEO-first template key \`seo-first-standard\`, version 2.0.0, stable \`role_key\` for the 18 specialist roles. Existing manual Agent instructions are preserved.
- 13 Blueprint workflow templates, each with ordered dependencies and gates (\`read\`, \`draft\`, \`approval\`, \`external\`). Definitions are stored per project with version, disabled by default. Creating a plan is an explicit user action.
- New project-scoped \`workflow_definitions\`, \`workflow_runs\`, \`workflow_step_runs\`. The legacy 3-stage SEO → Content → Social flow remains available and unchanged. New plans use independent step rows instead of the old \`tasks.workflow_step <= 3\` constraint.
- Manual step confirmation requires a meaningful note and all dependencies completed; externally mutating steps are **blocked**. This is not a claim of fully autonomous execution or independent QA.
- New project-scoped \`seo_crawl_runs\`, \`seo_site_urls\`, \`seo_findings\`. Future real HTML audits are saved to both the legacy asset for compatibility and the normalized per-URL index. Writes are idempotent; the user may reindex a saved audit if normalization failed.
- New **Việc chờ tôi** workspace screen, using actual pending content approvals, high-severity findings, unassigned SEO tasks and errored provider connections.
- Workflow v2 catalog UI with plan creation and evidence recording; still responsive on tablet/mobile.
- Additive SQL migration \`202611170008_seo_first_foundation_v2.sql\`. All new tables have RLS and composite same-project FKs; old records and automation status are preserved.

## Security and operating behavior
- Server checks user identity, permitted project and current project state on every write.
- Project-first loading scopes every table by \`owner_id\` and \`project_id\`.
- The new workflow definitions and schedules default OFF. Plan creation and manual evidence do not invoke AI.
- External actions (WordPress, Facebook, GBP and Ads) have **no executable handler** via this release; 'external' steps remain blocked.
- Existing 3 enabled schedules are left as-is, without turning on the AI auto-run worker.
- No WordPress/Meta/Ads API keys, content, customers, image library or permission grants are copied when applying templates.
- No change to any Supabase project except \`zvbwknltooymuenpvptr\`.

## What is intentionally *not* delivered yet
- Provider authorization and real GSC/GA4/GBP/Ads/Meta metrics.
- Full-site asynchronous crawler, Google indexing data, backlink APIs, Core Web Vitals field data.
- Upload/parse PDF/DOCX and RAG vector retrieval, approved media and ecommerce CMS.
- Independent Quality Auditor as an enforced executable pipeline.
- Automated DAG execution, retry/compensation, publishing adapter or verified external URL.
- Marketing budget automation or paid Ads mutation.

## Verification and rollout
1. Vercel Preview must pass \`npm test\` and TypeScript/Next build.
2. Apply SQL migration only to the dedicated Ngọc Supabase project; verify RLS and composite FKs.
3. Merge PR into existing GitHub \`main\`; confirm Vercel Production READY and matching commit.
4. Authenticated UI review: choose project, open **Tự động hóa → Cài bộ mẫu** (explicit action), see 13 disabled definitions, create a manual plan, verify blocked external steps, open **Việc chờ tôi**.
5. Run a new SEO Audit manually; confirm both source asset and normalized SEO index. No new SEO URL inventory is fabricated before a real scan.

## Next implementation priorities
1. Real GSC/GA4 read-only ingestion with property selection and API data freshness/limits.
2. Background crawl queue and URL-level historical snapshots + internal linking graph.
3. Knowledge PDF/DOCX import and source-aware RAG.
4. Content/Media Studio and WordPress draft/approval/publish/verify pipeline.
5. Facebook Page, GBP, backlink quality monitors, CRO/lead integrations.
