# Windows SDP2 Landing Page — Webserver Codex Handoff

## Objective

Build a new bilingual Cloudwrxs landing page for Windows EC2 SDP Campaign 2.

## Target URL

`/windows-sdp2/`

## Primary Source

Use `landing-page-brief.md` as the source of truth. It now contains both English and Arabic page copy, section structure, SEO requirements, and implementation notes.

## Required Behaviour

- Build a polished Cloudwrxs-branded landing page matching the current Cloudwrxs site style.
- Include English and Arabic content.
- Provide an English / Arabic language toggle.
- Use RTL layout for Arabic content.
- Keep the page mobile-first and responsive.
- Use the supporting campaign PDFs and LinkedIn images as reference material and optional page assets.
- Include clear CTAs for:
  - Book Free Windows Migration Assessment
  - Calculate SDP Savings
  - Download Windows Modernisation Guide

## Calendar CTA

All assessment-booking CTAs should go to:

`https://calendar.google.com/calendar/u/0?cid=bWF0dGhldy5zbWl0aC13cmlnaHRAY2xvdWR3cnhzLmNvbQ`

## ACF Pro Requirement

Cloudwrxs uses Advanced Custom Fields Pro on the website.

Store the calendar link in an editable ACF field rather than hard-coding it throughout the template.

Recommended field name:

`windows_sdp2_calendar_url`

Recommended additional fields:

- `windows_sdp2_guide_download_url`
- `windows_sdp2_video_url`
- `windows_sdp2_primary_language`
- `windows_sdp2_ga4_conversion_event`
- `windows_sdp2_hubspot_form_id`

## Tracking

Preserve inbound query parameters where possible and carry them into CTA links or form submissions:

- `campaignId`
- `persona`
- `link`
- `email`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

## Included Reference Assets

- Campaign overview PDF
- Campaign calendar PDF
- Collateral brief PDF
- LinkedIn calendar PDF
- LinkedIn creative assets PDF
- Video script PDF
- LinkedIn article cover image
- LinkedIn feedshare image

## Build Notes

- If a video asset is not available, use a strong static hero with a clearly marked video placeholder field controlled via ACF.
- If the Windows Modernisation Guide download is not available yet, create the CTA as configurable and non-blocking.
- The live page should not expose internal campaign operations language.
- Use concise, executive-friendly copy on the page; the brief is intentionally more detailed than the visible landing page needs to be.
