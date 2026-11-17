# Ngọc Agent Studio — Operating Model

## 1. Single source of truth

- Repository: private GitHub `suvietai-stack/Ngoc-agent-studio`.
- Changes must use a feature branch, automated typecheck/build, reviewed Pull Request and Vercel Preview before merge to `main`.
- Vercel must be connected to the **existing** project through Git Integration; do not create a second production project or change code from Lovable / Vercel editor.
- Production release follows migration review → tested preview → merge to main → Vercel production → smoke test. Keep prior Vercel deployment for rollback.

## 2. Datastore & authority

- Dedicated Supabase project `ngoc-agent-studio-db` only. Never execute migrations against Base Sứ Việt.
- Owner authentication is enforced by Supabase Auth and `STUDIO_OWNER_UID`; RLS restricts project/task/Agent/knowledge/content rows by owner.
- Client receives only metadata; `integration_secrets` ciphertext never enters `WorkspaceData`.
- App-managed API keys use AES-256-GCM with `INTEGRATION_ENCRYPTION_KEY` stored server-side in Vercel. Rotate this encryption key only with a documented re-encryption plan.
- Service role, CRON_SECRET, OpenAI API key and other privileged credentials must never use `NEXT_PUBLIC_`; never commit them.

## 3. Automation state machine

1. Supabase Cron enqueues tasks from active schedules hourly; it **does not** call AI.
2. Optional Vercel Cron worker runs once daily at 02:00 UTC on the current Hobby plan. It runs **only** if configured with server secrets, explicitly enabled in Vercel and opted in for a project.
3. Worker claims one eligible task at a time and produces a draft. Daily run budget defaults to three; a task with three failed attempts is skipped until reviewed.
4. SEO → Content → Social dependencies are checked against the **approved content asset** of the immediately preceding task in the same project and workflow.
5. All publishing, sending, external writes and destructive actions are disabled. Content review is human-mediated.
6. Editable drafts can be revised; approved content is immutable and is the source of context for downstream Agent work.
7. Logs, task runs, approval events and task status are saved. No silent claim of success if storage fails.

### Task states

`draft` → `running` → `pending_approval` → `approved`

On failure: `running` → `failed`, review errors and retry where appropriate.

## 4. Module inventory

| Module | Present | Guard / next gate |
| --- | --- | --- |
| Owner login & RLS | Yes | Disable public signup; use dedicated owner |
| Operational dashboard | Yes | Counts are internal, not external analytics |
| Projects | Create/edit/pause/archive | Pause/archive disables background AI for project |
| AI Agents | Create/edit/enable/disable | Cross-project selection is rejected |
| Tasks | Create/edit draft/run | Review happens in Content |
| Workflow SEO → Content → Social | Yes | Upstream content approval required |
| Schedules & queue | Yes | Supabase Cron creates tasks hourly |
| Optional AI auto-draft worker | Yes, off by default | Vercel server credentials + explicit per-project enable |
| Knowledge | Create/edit/delete | Project-specific and shared knowledge |
| Content & reports | Review/edit/copy/approve | No external publication |
| Đốm AI | Chat with project context | API key required |
| API connections | OpenAI and WordPress | Server-encrypted key; manual test |
| Google Search Console / GA4 | Placeholder | Official OAuth and data scope needed |
| Meta Facebook / Instagram | Placeholder | Official OAuth and review required |
| Reporting & billing | Internal task logs | Real API analytics and cost ledger pending |

## 5. External API contracts

- OpenAI: API key per project or server fallback, text generation only, no external publishing.
- WordPress: Application Password stored encrypted per project. Connection check uses the read-only `/wp-json/wp/v2/users/me` endpoint. No post-writing endpoint is enabled.
- Google Search Console / GA4 / Drive: OAuth consent, scoped callback, encrypted token refresh and account selection must be built and reviewed before activation.
- Meta Pages / Instagram: official OAuth, page scope validation and a second publish approval gate; never use unofficial tokens.
- Do not claim an integration is connected until a real verification succeeds.

## 6. Release validation checklist

- [ ] GitHub Action typecheck/build is green at the exact PR head.
- [ ] Supabase migrations reviewed and applied to isolated project, with RLS verified.
- [ ] Encryption key exists only on server and is not logged or exposed to the client.
- [ ] Vercel Git Integration creates a preview from PR; authenticated smoke test passes.
- [ ] Confirm no external publish/write side effects before enable.
- [ ] Production commit and Vercel deployment match after merge; rollback plan ready.

## 7. Remaining roadmap

1. Git Integration and deployment preview verification.
2. OpenAI key provisioning in the new app UI and end-to-end SEO → Content → Social test.
3. Google OAuth read-only Search Console / GA4 reporting.
4. WordPress publishing with explicit publish permission, content preview, draft vs publish and audit trail.
5. Meta OAuth with human publish approval and rate limits.
6. Document ingestion, retrieval indexing, Agent evaluation, alerts and performance/cost reporting.

These remaining items must be verified against the real provider accounts and permissions. Do not mark them operational based on mock output.
