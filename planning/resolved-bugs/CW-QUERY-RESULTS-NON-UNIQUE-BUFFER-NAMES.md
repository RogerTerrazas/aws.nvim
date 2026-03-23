# Bug: CloudWatch Query Results Buffers Were Not Unique Per Query

## Symptom

Submitting multiple CloudWatch Logs Insights queries did not open a new results
buffer for each query. Every submission routed to the same buffer
(`nvim-aws | CloudWatch Logs Insights — Results`), overwriting previous results
and making it impossible to switch between different queries.

## Root Cause

`initializeCWQueryResultsView` always called:

```ts
getBufferTitle('CloudWatch Logs Insights — Results')
```

producing a static buffer name regardless of the query parameters. Because the
router's `findExistingBuffer` reuses any buffer whose name matches, a second
query with different parameters would simply display the existing (now stale)
buffer instead of creating a fresh one.

The `bufferLabel` on `cwQueryResultsViewEntry` was also a static string, so the
router computed the same `expectedName` for every query and believed it had
already created the buffer.

## Fix

### `src/session/index.ts` — `hashQueryParams()`

Added a dependency-free FNV-1a 32-bit hash function that accepts the five query
parameters (`logGroupNames`, `queryString`, `startTime`, `endTime`, `limit`) and
returns an 8-character lowercase hex string. Log group names are sorted before
hashing so that parameter order does not affect the result.

### `src/views/cloudwatch/query-results/query-results.ts`

1. **Buffer title** — the static label was replaced with a hash-suffixed one:

   ```ts
   const hash = hashQueryParams(params)
   const bufferTitle = getBufferTitle(`CloudWatch Logs Insights — Results | ${hash}`)
   // e.g. "nvim-aws | CloudWatch Logs Insights — Results | a1b2c3d4"
   ```

2. **`bufferLabel` resolver** — converted from a static string to a
   `BufferLabelResolver` function so the router computes the same name from the
   raw route args and its buffer-reuse / deduplication logic remains correct:

   ```ts
   bufferLabel: (logGroupsJson, queryString, startTime, endTime, limit) => {
     const hash = hashQueryParams({ ... })
     return `CloudWatch Logs Insights — Results | ${hash}`
   }
   ```

## Behaviour After Fix

| Scenario | Result |
| --- | --- |
| Submit query A | New buffer `... Results \| <hashA>` created |
| Submit query B (different params) | New buffer `... Results \| <hashB>` created; A's buffer preserved |
| Submit query A again (identical params) | Router reuses the existing `hashA` buffer — no duplicate fetch |
| `r` refresh on results buffer | Re-runs with shifted time window; new hash → new buffer |

## Tests Added

- `src/session/index.test.ts` — 7 tests for `hashQueryParams`: format, determinism, sensitivity to each field, and log group order independence.
- `src/views/cloudwatch/query-results/query-results.test.ts` — 2 tests: different queries produce different buffer names matching `Results | <8-hex>`; identical queries produce the same buffer name.
