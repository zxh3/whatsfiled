# SEC RSS/Atom Ingestion Plan (Proposed)

## Goal
Add a near-real-time ingestion path based on SEC RSS/Atom feeds to complement the daily index pipeline. The new path should deliver filings minutes after publication while remaining idempotent and fully compatible with the existing queue-based processor.

## Current State (Summary)
- Daily index discovery and processing populate `filing_queue` from index files.
- Filing processing stage fetches and parses queued filings.
- Deduplication uses unique constraints on accession numbers.

## Proposed Strategy
- Add a lightweight RSS/Atom poller that fetches the SEC filings feed at a short interval (e.g., every 1–5 minutes).
- Normalize RSS items into the same `filing_queue` entries used by the existing pipeline.
- Keep the daily index flow as the canonical backstop for completeness.

## Design Principles
- **Idempotent**: RSS inserts are deduped by accession number.
- **Minimal new surfaces**: reuse existing queue + filing processor stages.
- **Observability**: track feed lag, last seen time, and insert stats.
- **Fail-safe**: if RSS is down, daily index still fills gaps.

## Research + Investigation Tasks
1. Identify the SEC RSS/Atom feed(s) for recent filings and confirm:
   - Item fields (accession number, filing date/time, company CIK, form type, document URL).
   - Publication time semantics (ET vs UTC) and timestamp format.
   - Pagination or query params (if any) and update intervals.
2. Confirm SEC fair access / rate guidance for RSS.
3. Validate whether RSS includes Form 4 and Form 4/A consistently.
4. Validate RSS data is sufficient to enqueue without fetching the full filing.

## Data Model Additions
Add a small table to record RSS polling state and metrics.

- `rss_feed_state`
  - `id` (PK)
  - `feed_name` (e.g., "sec-filings")
  - `last_poll_at` (timestamptz)
  - `last_item_published_at` (timestamptz)
  - `last_item_accession` (text)
  - `last_success_at` (timestamptz)
  - `last_error` (text)

Add a `source` enum or text column on `filing_queue` (if useful):
- `source`: `"daily_index" | "rss"`

## Ingestion Flow
1. **RSS Poller (cron or worker)**
   - Fetch RSS/Atom XML.
   - Parse items.
   - For each item:
     - Extract accession number, form type, cik, doc URL, published timestamp.
     - Filter to Form 4 / Form 4/A.
     - Upsert into `filing_queue` with status `pending`.
   - Update `rss_feed_state` with last poll and last seen item.

2. **Queue Processing (existing)**
   - No changes required; it fetches the filing, parses XML, and writes to DB.
   - Dedup via unique accession constraint prevents duplicates if daily index already saw it.

## Timezone Handling
- Store RSS `published` time as `timestamptz` (UTC).
- If RSS timestamps are in ET, convert to UTC at ingestion time.
- Keep SEC `ACCEPTANCE-DATETIME` from the filing as the authoritative `filed_at`.
- `rss_published_at` can be stored separately if needed for diagnostics.

## Error Handling + Observability
- Log RSS fetch errors with cause (HTTP error, parse error, timeout).
- Emit metrics:
  - Items fetched
  - Items enqueued
  - Duplicates ignored
  - Lag between `rss_published_at` and now

## Rollout Plan
1. Implement RSS poller and state table.
2. Dry-run mode: parse feed and log what would be enqueued.
3. Enable enqueue with low frequency (e.g., 5–10 min) to validate.
4. Increase frequency after monitoring stability.
5. Add dashboard section in `/sync` showing RSS lag and last poll time.

## Test Plan
- Unit test RSS XML parsing with fixture data.
- Integration test that RSS items enqueue properly.
- Verify dedupe behavior with daily index.
- Ensure time parsing yields correct UTC values.

## Open Questions
- Should RSS ingestion attempt to backfill if the app was offline for >N hours?
- Do we need separate queue priority for RSS filings to process them ahead of daily index?
- Should we persist RSS published timestamps alongside `filed_at` for analytics?
