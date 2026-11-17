# SEO-First Foundation — implementation handover

## Scope delivered in this release
- Existing project-first flow preserved, no new app, no new Supabase project.
- Choose SEO-First team when creating a project, or install into an existing project from **Tự động hóa**.
- Template has expert prompts across SEO (technical, internal links, backlink/PR, local/entity, ecommerce, performance, guardian), Content/Media, Facebook, Marketing, reporting and quality.
- Installation appends missing role names and creates seven **disabled** schedules. Existing Agent prompts and project knowledge are never overwritten. No API credentials, user data, media or budgets are cloned.
- New **SEO Website** tab with responsive cards for inspected URL count, high-priority findings, medium findings and discovered internal-link targets. All figures are parsed from a persisted actual audit, not estimates or placeholders. Audit history remains in existing content_assets.
- The existing Audit button now inspects at most six same-host HTTPS pages discovered from the starting page. Requests are short, size-limited, pinned to publicly validated IPv4, and do not follow redirects.
- Agent manager adds department filters, avoiding an unstructured wall of Agent cards.

## Not yet included (must not be represented as operational)
- Full-site crawl and URL index with snapshots/history trends.
- Search Console, GA4, WooCommerce and Facebook data ingestion, live ranking and conversion metrics.
- Document uploads/RAG and common professional Rulebook versioning.
- WordPress, Facebook Page or Google Maps external publishing.
- Real backlink database, authoritative position tracking, automated edits, Ads spending or CRM.
- Automated AI worker remains off unless previously explicitly enabled per-project with server secrets. This release does not change its activation state.

## Quality / security
- New project chosen by authenticated, approved owner; row scope is always owner_id + project_id.
- No schema migration in this foundation release.
- A source audit report is saved as content_asset(channel='seo-audit', status='draft'). The dashboard never converts older unknown report formats into fabricated scores.
- No external publishing, spending or marketing sending added.
- Client and server code support current Node 22 / Next 16.4.6 project; Vercel Preview runs npm test and Next production build.
- Audit is a **sample**, not a complete SEO score or proof of Google indexing. Potentially intentional noindex/canonical decisions must be reviewed by a human.

## Rollout, review and follow-up
1. Validate Preview on existing Vercel project, confirm tests and Next build.
2. Review PR, merge to existing main, verify production commit and HTTP response.
3. Authenticate into existing project and check SEO tab + template install manually. Installation is an explicit action, never silently run on the existing project.
4. Next releases: robust sitemap-backed crawler, persisted URL-level structured audits, GSC/GA4 read-only ingestion, source-aware knowledge upload and RAG, WordPress draft/approval/publishing adapter, Facebook publishing, Entity/Maps, backlink and PR, CRO/lead reporting.

## Troubleshooting
If a website redirects, audit rejects it deliberately. Save its canonical final HTTPS host in project settings.
If audit pages are zero or fewer than six, this is not automatically an error: pages must be linked via same-host HTML anchors. For pages that cannot be fetched, the report lists failures.
Existing legacy audit reports are shown under history, without summary dashboard metrics.
