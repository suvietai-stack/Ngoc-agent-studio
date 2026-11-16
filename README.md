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



## Agent Studio v2 — Đốm AI & tự động hóa (2026-11-17)

- Đăng nhập Supabase Auth (không mở đăng ký công khai), phân quyền Row Level Security theo owner.
- Starter workspace: Sứ Việt - SEO & Social, 6 Agent, 3 lịch mẫu và các công việc mẫu.
- Supabase Cron (`ngoc-agent-studio-queue`) chạy mỗi giờ, tự thêm việc **draft** theo lịch daily/weekly. Cron không tự xuất bản.
- Tạo chiến dịch 4 công việc SEO/Content/Social/Marketing bằng một nút bấm.
- Chạy Agent với OpenAI Responses API, ghi task_runs, lưu nội dung draft trong content_assets, phê duyệt thủ công. Không dùng Service Role trong trình duyệt.
- Đốm AI trả lời trong tab riêng, có ngữ cảnh từ projects, tasks và knowledge_items; lịch sử lưu tại dom_messages.
- SEO Audit quét trực tiếp HTML website HTTPS được khai báo, kiểm tra title/description/H1/canonical/robots/OG. Không thay thế Search Console hay Analytics.
- **Tự đăng WordPress/Facebook/Instagram, OAuth Analytics/Search Console, truy xuất dữ liệu Ads, AI tự chạy không cần người khởi phát: CHƯA triển khai**. Cần kết nối quyền chính thức, quyền ghi và triển khai bộ điều phối nền an toàn.

### Bật tính năng AI

Trong Vercel Project → Settings → Environment Variables, thêm **server-side secret**:
```
OPENAI_API_KEY=<set in Vercel dashboard; do not commit>
```
Áp dụng cho production và redeploy. Không đặt key với tiền tố `NEXT_PUBLIC_`.
Model mặc định `gpt-4.1-mini`. Các nút `Chạy AI` và chat Đốm chỉ hoạt động khi biến này có giá trị. OpenAI API có thể phát sinh phí; hệ thống không tự gọi API khi chưa cấu hình key.

### Migrations

- `supabase/migrations/202611170001_initial.sql`
- `supabase/migrations/202611170002_automation.sql`

Chỉ chạy migrations ở Supabase project `ngoc-agent-studio-db`. Tuyệt đối không chạy trên Base Sứ Việt. Cron hoạt động trong Postgres, không cần Vercel Cron/Service Role để thêm việc.

## Agent Workflow v3 — Phê duyệt nối bước (2026-11-17)

- Tạo chuỗi 3 công việc thực tế **SEO → Content → Social** trong tab **Tự động hóa**.
- Mỗi bước dùng Agent đang bật phù hợp dự án hoặc dùng chung, không thay thế bằng Agent ngẫu nhiên.
- Bước 2/3 bị chặn phía máy chủ cho đến khi bản nháp của bước ngay trước được **duyệt tại tab Nội dung**.
- Khi chạy bước sau, bản nháp đã duyệt của bước trước được đưa vào ngữ cảnh AI, tối đa 6.500 ký tự.
- Mọi lần chạy vẫn yêu cầu người dùng nhấn **Chạy AI**. Không tự đăng, gửi, xóa dữ liệu hay tự chạy API ngầm.
- Migration cần áp dụng **chỉ trên** Supabase `ngoc-agent-studio-db`: `supabase/migrations/202611170003_agent_workflows.sql`.
- Luồng phát hành: nhánh tính năng → kiểm tra preview Vercel → PR về `main` → production.
