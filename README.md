# Ngọc Agent Studio

Private Next.js 16 / React 19 Agent workspace for SEO, Content, Marketing and Social Media.

## Deploy & data

- **Private GitHub source:** `suvietai-stack/Ngoc-agent-studio`; changes are reviewed in pull requests.
- **Existing Vercel project:** `ngoc-agent-studio`, automatically deployed from the `main` branch.
- **Production:** https://ngoc-agent-studio.vercel.app
- **Dedicated Supabase project:** `ngoc-agent-studio-db` (`zvbwknltooymuenpvptr`). Never migrate or modify **Base Sứ Việt** for this app.
- **Security:** Supabase Auth + owner-only access, RLS and per-project foreign key constraints. Confidential API credentials are encrypted on the server using AES-256-GCM.
- **Runtime:** Node.js 22.x, the same major version as GitHub CI.

## Modules and actual functionality

| Module | Available | Not yet verified or not implemented |
| --- | --- | --- |
| Projects / Agents / Tasks / Knowledge | Create, update and manage within project; isolation enforced by database | Browser interaction tests require the authenticated owner |
| AI (OpenAI) | Per-project key entry and verification, manual draft generation, Đốm AI | Real task end-to-end needs an actual API request; incurs provider charges |
| Content / workflows | Draft edit, approval; SEO → Content → Social approval chain | No automatic public posting |
| SEO audit | Live HTML audit of the configured HTTPS site | Not Google Search Console data |
| Cron | Supabase hourly queue generation | AI worker disabled until separately configured and opted in |
| WordPress | Application Password entry and read-only connection verification | Writing/publishing posts not implemented |
| Google (GSC, GA4, Drive, Ads) | In-app encrypted OAuth Client config, consent and provider read-access verification | No analytics ingestion/sync, Ads mutations or report dashboards |
| Meta (Facebook, Instagram) | In-app encrypted OAuth App config, consent and provider asset verification | No posts, messages or external mutations |
| Operational reporting | Internal tasks, run logs and approval statuses | No unified Google/Meta metrics or billing ledger |

**Provider connection verification is not a full integration test.** A key may authenticate without sufficient usage balance or service-specific permissions.

## Owner setup

1. Sign in at https://ngoc-agent-studio.vercel.app. Only the `STUDIO_OWNER_UID` account can open the workspace.
2. Select the project from the top navigation; each project owns its Agent, knowledge, keys, tasks, schedules, content and chat.
3. On the **Kết nối** tab, enter a per-project OpenAI key and press **Kiểm tra**.
4. For Google/Meta, create an OAuth web application in the official provider console, then enter Client ID and Client Secret in **Kết nối** (encrypted in the project). Register this callback with the provider:

   `https://ngoc-agent-studio.vercel.app/api/integrations/oauth/callback`

5. Select **Kết nối** for each provider to consent and verify the account/asset. Google Ads also needs a Developer Token. Some Meta permissions require App Review.
6. For a manual end-to-end test, open **Công việc**, run a draft and review it in **Nội dung & báo cáo**. No external publishing is performed.

### Direct links (iPad/mobile/desktop)

- [Kết nối](https://ngoc-agent-studio.vercel.app/?tab=integrations)
- [Công việc](https://ngoc-agent-studio.vercel.app/?tab=tasks)
- [Đội ngũ AI](https://ngoc-agent-studio.vercel.app/?tab=agents)
- [Nội dung](https://ngoc-agent-studio.vercel.app/?tab=content)
- [Tự động hóa](https://ngoc-agent-studio.vercel.app/?tab=automations)

## Environment variables

Always server-side (no `NEXT_PUBLIC_` prefix for secrets):

- Required: `INTEGRATION_ENCRYPTION_KEY` (32-byte Base64 AES key), `STUDIO_OWNER_UID`.
- Required public Supabase configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Optional fallback for Google OAuth: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- Optional fallback for Meta OAuth: `META_APP_ID`, `META_APP_SECRET`.
- Optional for Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN`.
- Optional opt-in auto-run worker: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `AUTO_AGENT_RUNNER_ENABLED=true`, optionally `AUTO_AI_DAILY_LIMIT`.
- OpenAI is configured by an encrypted **per-project** key in the app, not a shared server fallback.

Keep tokens and service role credentials out of GitHub, chat, browser local storage and public environment values. Rotating `INTEGRATION_ENCRYPTION_KEY` requires a re-encryption migration.

## Testing

```bash
npm install
npm test
npm run typecheck
npm run build
```

Supabase migrations are in `supabase/migrations`. Deploy only against the dedicated Ngọc database. See `docs/OPERATING_MODEL.md` for the operational safety model and approval gates.
