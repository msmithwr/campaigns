# Resolved Technical Debt

Move completed items here from `backlog.md`.

## 2026-06-23 - Scheduled Send Engine Duplicate-Send Guard

Area: Email automation / AWS operations  

Resolved by adding per-recipient DynamoDB conditional claiming before SES sends, stale `sending` recovery, run-total recalculation from send records, and repeatable deployment scripts.

## 2026-06-23 - Campaign Calendar Email Integration

Area: Calendar / Campaign activities  

Resolved the email side of step 5 by making calendar-linked email send runs create and update durable campaign activity rows when review runs are created, approved, rejected, rescheduled, partially sent, failed, completed, or result-ingested. Drag/drop of email-assignment calendar tiles now updates the email assignment `sendDate`, completed email tiles visually recede, and the calendar drawer shows email execution and result metrics.
