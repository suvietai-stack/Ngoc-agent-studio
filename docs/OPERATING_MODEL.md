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
| Knowledge | Create/edit/delete | Strictly per-project; no shared knowledge across projects |
| Content & reports | Review/edit/copy/approve | No external publication |
| Đốm AI | Chat with project context | API key required |
| API connections | OpenAI and WordPress | Server-encrypted key; manual test |
| Google Search Console / GA4 / Drive / Google Ads | OAuth setup & per-project token verification | User must register Google OAuth app, enable APIs and grant consent; reports/sync not yet implemented |
| Meta Facebook / Instagram | OAuth setup & per-project token verification | Meta App credentials, permissions and possibly App Review required; no posting |
| Reporting & billing | Internal task logs | Real API analytics and cost ledger pending |

## 5. External API contracts

- OpenAI: verified encrypted API key for the selected project only, text generation only, no external publishing.
- WordPress: Application Password stored encrypted per project. Connection check uses the read-only `/wp-json/wp/v2/users/me` endpoint. No post-writing endpoint is enabled.
- Google Search Console / GA4 / Drive / Google Ads: OAuth consent and scoped callback are implemented; per-project encrypted tokens and provider connection checks are implemented. Account selection, reporting queries and scheduled data sync are not yet implemented.
- Meta Pages / Instagram: OAuth setup, page scope checks and token storage are implemented; publishing and a second publish approval gate are not implemented.
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

## OAuth integrations (read-only, per-project)

- Authenticated owner-only endpoints: `/api/integrations/oauth/start` and `/api/integrations/oauth/callback`.
- Google OAuth applications require `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; Meta requires `META_APP_ID`, `META_APP_SECRET`; Google Ads also requires `GOOGLE_ADS_DEVELOPER_TOKEN`. Set these only in Vercel server environment variables, never in browser or GitHub.
- Register `https://ngoc-agent-studio.vercel.app/api/integrations/oauth/callback` as an authorized redirect URI for both providers. `NEXT_PUBLIC_SITE_URL` must match the production domain.
- OAuth consent uses a random state nonce in short-lived HttpOnly/Secure/SameSite=Lax cookie; callback revalidates owner and project. Provider tokens are encrypted per project and not displayed after saving.
- Permissions: read-only GSC/GA4/Drive; Google Ads OAuth can authorize broad scope but our code only calls read-only customers:listAccessibleCustomers and never modifies ads. Meta requests only pages_show_list/pages_read_engagement/instagram_basic, no publish permissions.
- Status `connected` means a real provider API call succeeded and an accessible asset was found (except Drive, which verifies read metadata permission). Empty accounts, missing API enablement or denied scopes remain `error` and can be retested.
- Current Vercel OAuth app credentials are **not provisioned** until configured by the owner. OAuth code deployment alone cannot connect an actual Google/Meta account. OAuth access and App Review may require provider approval.
- External data ingestion, account-specific account selection, analytics dashboards, publishing, ad management, or data sync are **not** claimed implemented by OAuth authorization alone.
- Pinned runtime Node.js 22.x to match GitHub CI and prevent untested major upgrades.

### In-app OAuth Client Configuration

- The **Kết nối** tab now has secure Google and Meta OAuth App configuration forms, stored encrypted per project under `google_oauth_app` / `meta_oauth_app` provider records.
- Credentials in the project vault take priority over optional Vercel environment credentials. Google Ads developer token can be entered in the Google form.
- Changing a project's OAuth app credentials deletes old provider tokens/status for that project, requiring re-consent. It does not touch other projects.
- Configure Google/Meta authorized callback URL `https://ngoc-agent-studio.vercel.app/api/integrations/oauth/callback` before clicking Connect; OAuth app registration and provider App Review cannot be automated without owner access.

## Release checks and security hardening

- Vercel's build invokes `npm test` **before** Next.js compilation. This provides a test gate when GitHub Actions runners cannot start; an unusable GitHub job is not treated as a passing check.
- Migration 009 implements an immutable approval guard on content and tasks at PostgreSQL level. `approve_content_asset` is owner-checked SECURITY DEFINER because the authenticated role is not allowed to update the approval status column directly. Unapproved drafts alone remain editable by owner.
- `recover_stale_task` only runs on owner-owned `running` tasks older than 15 minutes; it reuses any saved draft and never calls OpenAI.
- Task and project website inputs use the same HTTPS-only, no-literal-IP URL parser. WordPress connection testing provides provider HTTP status diagnostics without revealing credentials.
- Server-side tab queries load deterministic 200-row pages up to 2,000 records per table and explicitly warn when the cap is hit. This is a safety cap, **not full unlimited pagination**.
- The owner still needs to run a real authenticated Agent draft / approval integration test. No automatic external publication is enabled.
