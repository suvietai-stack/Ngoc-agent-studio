# Ngọc Agent Studio — SEO-First integrated release

This release continues the **existing** private repository, project-first UI, Supabase project and Vercel deployment.

## Shipped capabilities
1. SEO Website dashboard reorganized as a compact manager cockpit, with source connection status, four observed counters, clear issue table, internal linking analysis, Entity/Google Maps/backlink status and SEO task inbox. Mobile responsive.
2. Manual **Audit nhanh** checks up to 8 actual HTML URLs; **Audit mở rộng** checks up to 30. Reads robots.txt when reachable, normal sitemap locations and same-host HTML links, with safety checks (HTTPS, no private IP, no redirects, response/time budget, no query or admin URLs). A Vercel function never claims full-site coverage.
3. Structured, versioned JSON audit evidence stored in existing per-project content_assets. Old plain Markdown reports remain supported as legacy history; project home summary reads both.
4. Audit findings may be converted into up to 8 **draft** remediation tasks, with affected sample URLs, evidence codes and a matching SEO Agent where installed. Repeated requests on the same audit do not create the same task again.
5. Authority planning button creates **draft** Entity/Local SEO, Backlink/Digital PR and Facebook tasks. No external posting, outreach or spending.
6. Đốm can summarize the latest sampled SEO audit in project context with an explicit source/limitations note. Uploaded/user-supplied text is treated as untrusted reference content, not new instructions.
7. Existing Knowledge tab supports **text-based TXT, MD, CSV, JSON** uploads (local file text extraction into project knowledge, max 90 KB and max 28,500 characters). No claim of PDF/DOCX ingestion, vector search or model fine-tuning.
8. Existing SEO-first template, per-project isolation, optional template installation and disabled new schedules remain unchanged.

## Not supported by this release
- Full crawl of an unlimited site, background URL jobs or Google-confirmed indexing.
- Live Search Console, GA4, Google Business Profile, backlink-provider, Google Ads or Meta Ads metrics. Connection status is not data ingestion.
- PDF/DOCX parsing, media library/image upload, RAG vector index, or professional rulebook auto-updates.
- Posting to WordPress, Facebook Page, Google Maps; editing ecommerce prices, SEO meta through plugins, ad budgets, or sending CRM messages.
- Automatic AI execution for newly created SEO tasks. AI runs only when explicitly requested, enabled, and configured.

## Safety and verification
- Only existing authorized owner can create audits and tasks; all read/writes remain scoped to owner + project.
- Audit strictly reads public HTTPS only and does not make changes to audited website.
- No database schema migrations and no automated publishing credentials added.
- Test suite covers pure audit URL/sitemap/robots parsing, measured issue summaries, typed UI source labels and action scoping.
- Verify Vercel Preview tests/TypeScript/Next build, then merge PR and confirm Production SHA and READY state.

## Follow-on implementation scope
Proper async crawler/sitemap queue, full structured site inventory, actual GSC/GA4 API data ingestion, knowledge PDF/DOCX+RAG, WordPress post/product/category/media adapter, Facebook publishing, approved Maps API access and real backlink analysis.
