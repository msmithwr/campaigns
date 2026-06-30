# Technical Debt Backlog

Last updated: 2026-06-23

## TD-001 - Formal Approval Model For Automatic Sends

Status: Open  
Area: Email automation / Send Review  
Priority: High  

Today, Send Review approves generated send runs. It does not yet formally approve the reusable configuration of email content, audience, sender split, campaign mapping, and schedule.

Future model:

- Add approval states to each email campaign mapping: `Draft`, `Ready for review`, `Approved for manual sends`, `Approved for automatic sends`.
- Automatic calendar sends can skip send-run approval only when the campaign email mapping is approved for automatic sends.
- If email content, audience, sender list, schedule, campaign assignment, or placeholder configuration changes after approval, reset the mapping to review-needed.
- Keep generated send-run approval for mappings that are not approved for automatic sends.

Decision on 2026-06-23:

- Keep send-run approval for now.
- Treat item 4, Automatic Review Run Lifecycle, as complete for the current operating model because the app already keeps generated automatic runs in the approval path.
- Revisit this when we want fully trusted automatic campaign sends.

## TD-002 - Non-Email Calendar Execution Sync

Status: Open  
Area: Calendar / Channel execution  
Priority: High  

Email-linked calendar activity is now durable and result-aware. The remaining calendar work is to bring non-email execution channels into the same source-of-truth model.

Remaining work:

- Extend execution-result sync beyond email to call, WhatsApp, LinkedIn, landing page, webinar, and manual tasks.
- Add explicit deferred status rather than treating all deferrals as queued/wip/paused.
- Add calendar-side filtering for late/due/upcoming items once activity volume grows.
- Add rule/playbook-created activities to the same durable activity model.

## TD-003 - Audience And Contact Data Quality

Status: Open  
Area: Audience  
Priority: High  

Imported contacts are now canonicalized by email across HubSpot and Google Sheets, but the data quality workflow needs to become safer and more transparent.

Remaining work:

- Improve field mapping review for imported sheets before committing large imports.
- Show skipped-row reasons in the UI with export/download.
- Add dedupe confidence indicators where imported records have conflicting company, phone, title, country, or persona values.
- Add bulk cleanup tools for common fixes.
- Make suppression, bounced, unsubscribed, and missing-company impacts more prominent before send.

## TD-004 - HubSpot Sync Coverage

Status: In progress  
Area: HubSpot integration  
Priority: High  

HubSpot contact sync exists for selected actions, but needs broader and more reliable bidirectional coverage.

Progress on 2026-06-23:

- Added HubSpot audit engagement records when the app writes contact updates or Lead Nurture call notes/tasks to HubSpot.
- Added configured HubSpot owner ID support on sender profiles so task ownership can avoid repeated owner lookup by email.
- Added company to individually syncable HubSpot contact fields.
- Lead Nurture contact save now syncs changed HubSpot-safe fields back to HubSpot when a contact is linked.
- Added export from a reusable filtered audience to a HubSpot static segment, with HubSpot contact create/update and audience stamping so future sync treats HubSpot as the system of record.
- Added suppression sync so unsubscribed, bounced, or complaint contacts are removed from reusable audiences and exported HubSpot segment memberships before scheduled sends run.

Remaining work:

- Add explicit conflict handling when HubSpot has newer values than the local contact.
- Extend sync status surfaces so managers can filter errored/pending HubSpot writes.
- Support company-level properties such as `cw_product_name`.
- Add safe company creation and contact-company association during audience export, using domain-based dedupe and a review step before creating new companies.
- Add a governed HubSpot delete/anonymise policy for contacts who unsubscribe, with clear approval and audit controls before any destructive CRM action is enabled.

## TD-005 - Lead Nurture Operational Flow

Status: Open  
Area: Lead Nurture  
Priority: High  

The Lead Nurture page exists, but the end-to-end rep workflow needs hardening.

Remaining work:

- Make call outcomes drive the next action: no answer, voicemail, callback, meeting booked, no thanks, wrong contact, and completed.
- Ensure callbacks create HubSpot tasks immediately and appear again in the app on the due date.
- Add manager views for all owners and rep views for owned contacts.
- Add autosave and clearer sync state per row.
- Store JustCall call links or recordings against completed calls when available.

## TD-006 - Playbooks / Rules Engine Execution

Status: Open  
Area: Playbooks  
Priority: Medium  

Playbooks are configurable in the UI, but the execution engine is not yet the main orchestration layer.

Remaining work:

- Evaluate rules from email events, contact status, campaign state, and Lead Nurture outcomes.
- Create manual tasks based on configured rules.
- Suppress remaining manual touches when meeting booked, no thanks, bounced, or unsubscribed.
- Add rule test previews before activation.
- Add rule execution logs for debugging.

## TD-007 - WhatsApp And LinkedIn Channels

Status: Open  
Area: Channels  
Priority: Medium  

WhatsApp and LinkedIn appear in campaign planning, but are not yet integrated execution channels.

Remaining work:

- Configure WhatsApp Business users/accounts per campaign or sender.
- Decide what can be automated safely versus assigned as a manual task.
- Track WhatsApp send/reply outcomes against contacts.
- Track LinkedIn connection, message, and post activity.
- Add channel-specific compliance and opt-in controls.

## TD-008 - Content And Asset Management

Status: Open  
Area: Content  
Priority: Medium  

Email content is stored, but broader content and creative asset management is still basic.

Remaining work:

- Store email banners and campaign creative assets in S3 with references from templates.
- Add version history for email and landing-page content.
- Add preview rendering for final email HTML with sender and contact placeholders.
- Add AI-assisted content generation using campaign design specifications.
- Add approval and rollback for content changes.

## TD-009 - Roles And Permissions

Status: Open  
Area: Security / UX  
Priority: High  

The app is behind Cognito/Google Workspace, but application roles are still not fully enforced.

Remaining work:

- Add roles such as Admin, Manager, Campaign Builder, Sales Rep, and Viewer.
- Restrict send approval, sender configuration, integrations, secrets, and bulk data changes by role.
- Make managers able to see all reps while reps only see their own assigned work.
- Add an audit log for sensitive changes.

## TD-010 - Operational Reliability

Status: Open  
Area: AWS operations  
Priority: High  

The scheduled send engine is now guarded against duplicate recipient sends, but production operations need more visibility.

Remaining work:

- Add CloudWatch alarms for Lambda errors, throttles, duration, SES failures, and EventBridge failures.
- Add a run health dashboard in the app.
- Add dead-letter or retry handling for failed external API writes.
- Add backup/export strategy for key DynamoDB tables.
- Add deployment smoke tests for auth, state load, send-review load, and results ingestion.

## TD-011 - Security And Compliance

Status: Open  
Area: Security / Compliance  
Priority: High  

Core suppression checks exist, but campaign compliance needs stronger guardrails before broad automation.

Remaining work:

- Review cold outbound rules by target geography.
- Add per-channel consent and lawful-basis fields where needed.
- Surface suppression sync status and failures in the Audience UI.
- Ensure secrets are never exposed in frontend state.
- Add retention policy for event data and imported contact data.

## TD-012 - UX Polish And Scale

Status: Open  
Area: Frontend  
Priority: Medium  

The app has many operational screens now; next UX work should focus on scale, speed, and clarity.

Remaining work:

- Improve loading states for large audience and results pages.
- Add stronger empty states and error recovery.
- Improve table virtualization or pagination where rows can exceed thousands.
- Tighten mobile/tablet layouts for review-only use.
- Add global search across campaigns, contacts, audiences, emails, and send runs.
