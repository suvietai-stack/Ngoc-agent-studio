# Ngọc Agent Studio

Private personal AI Agent workspace for SEO, Marketing and Social Media projects.

## Technology
- Source control: GitHub private repository `suvietai-stack/Ngoc-agent-studio`.
- Deployment: Vercel builds code from GitHub (Git integration not yet authorized).
- App: Next.js 16 App Router, React 19, TypeScript, custom responsive CSS.
- Auth/data: NEW Supabase PostgreSQL project, per-owner Row-Level Security.

## Functionality in v0.1
When a separate database is configured: sign-in, add/list projects, create/enable agent definitions, create tasks, approve tasks, add/read knowledge, show live counts. Tools/integrations are placeholders clearly marked disconnected; no fake AI execution.

**Not yet implemented:** calling an AI model, scheduled workflows, connected SEO APIs, WordPress publishing, Facebook posting, real usage analytics. No external publish/send/delete without a separate approval gate.

## First-time setup
1. **Never use base-suviet**. Create a new Supabase project for Ngọc Agent Studio.
2. Run `supabase/migrations/202611170001_initial.sql` on that new project.
3. Turn OFF public signups; create the owner user through Supabase Admin.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` as Vercel environment variables. Never commit secret keys.
5. `npm install && npm run typecheck && npm run build` to validate.
6. Connect GitHub to Vercel and review preview deployment before releasing to production.

## Important rules
- No Lovable, no code reuse of Base Sứ Việt.
- One private repo is source of truth, GPT edits GitHub, Vercel deploys from Git.
- Keep data separated per project and signed-in owner, record approvals, no silent external actions.
- AI providers need backend-only secrets. Frontend publishable Supabase keys are the only public values.

