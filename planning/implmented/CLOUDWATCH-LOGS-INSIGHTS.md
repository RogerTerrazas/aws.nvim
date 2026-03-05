# nvim-aws Roadmap

## Feature: CloudWatch Logs Insights

### Summary

Users can query CloudWatch Logs using Logs Insights QL from a single combined
buffer — log group selection and query configuration live together. Results are
shown in a separate read-only buffer that polls the async AWS API until the
query completes. The feature follows the same accessor → view → commands layer
architecture as the DynamoDB query feature.

### Requirements

#### Functional

| #   | Requirement                                                                                            | Status |
| --- | ------------------------------------------------------------------------------------------------------ | ------ |
| F1  | Load up to 150 log groups via `DescribeLogGroupsCommand` (paginated, sorted alphabetically)            | Done   |
| F2  | Present a combined query form buffer with time, limit, query, and log groups sections                  | Done   |
| F3  | Log groups are listed as commented-out lines; user uncomments to select (max 50 per AWS limit)         | Done   |
| F4  | Users can manually add log group names by typing them as uncommented lines                             | Done   |
| F5  | Query field is pre-populated with `filter @message like //` template                                   | Done   |
| F6  | Query field supports multi-line Insights QL (all non-comment lines after `Query:` label)               | Done   |
| F7  | `Limit:` field controls max results returned (1–10000, defaults to 1000)                               | Done   |
| F8  | Relative time window: `"60 minutes"`, `"24 hours"`, `"7 days"` (singular/plural both accepted)         | Done   |
| F9  | Absolute time range: `"2024-01-15 TO 2024-01-16 14:30:00"` with flexible date precision                | Done   |
| F10 | Right-hand absolute date defaults to end-of-day (`23:59:59`) when no time component is given           | Done   |
| F11 | `<CR>` on the query form validates input and routes to the results view                                | Done   |
| F12 | Results view shows a `Running...` placeholder while the async query executes                           | Done   |
| F13 | Results view polls `GetQueryResultsCommand` (500 ms interval, 60 s timeout) until terminal state       | Done   |
| F14 | Results rendered as labeled fields (`@timestamp: ...`, `@message: ...`) with blank line between events | Done   |
| F15 | `@timestamp` and `@message` fields sorted first; `@ptr` field suppressed                               | Done   |
| F16 | Results header shows query, log groups, time range, status, match/scan statistics, and result count    | Done   |
| F17 | `r` keymap on results view re-runs the query with a shifted time window ending at the current time     | Done   |
| F18 | `c` shortcut on the Home view opens the query form                                                     | Done   |
| F19 | `:NvimAws route cloudwatch_query` opens the query form at any time                                     | Done   |
| F20 | All SDK clients use the active profile's credentials and region                                        | Done   |

#### Non-Functional

| #   | Requirement                                                                  | Status |
| --- | ---------------------------------------------------------------------------- | ------ |
| N1  | Follows existing layer architecture: accessor → view → commands              | Done   |
| N2  | Async polling uses `setTimeout`-based sleep loop (no blocking)               | Done   |
| N3  | TypeScript strict mode passes cleanly                                        | Done   |
| N4  | All new code covered by unit tests using `aws-sdk-client-mock` and `vi.fn()` | Done   |

### Architecture

```
src/
├── accessors/cloudwatch/
│   ├── log-groups.ts          # listLogGroups(prefix?) → LogGroup[] (paginated, cap 150)
│   ├── log-groups.test.ts     # 7 tests
│   ├── query.ts               # startInsightsQuery(), pollQueryResults(), runInsightsQuery()
│   └── query.test.ts          # 8 tests
├── session/
│   └── index.ts               # createCloudWatchLogsClient() added alongside DynamoDB factory
└── views/cloudwatch/
    ├── query/
    │   ├── query.ts           # initializeCWQueryView() + cwQueryViewEntry
    │   ├── query.test.ts      # 9 tests
    │   ├── commands.ts        # parseTimeInput(), extractLogGroups(), extractQueryString(), submitCWQuery()
    │   └── commands.test.ts   # 26 tests
    └── query-results/
        ├── query-results.ts   # initializeCWQueryResultsView() + cwQueryResultsViewEntry
        ├── query-results.test.ts # 9 tests
        └── commands.ts        # refreshCWQuery(), initializeCWQueryResultsCommands()
```

### User Workflow

1. Press `c` on the Home view (or `:NvimAws route cloudwatch_query`)
2. Plugin loads log groups from AWS and opens the combined query form:

   ```
   Time Mode:  relative
   Time:       60 minutes
   Limit:      1000
   Query:
   filter @message like //

   # ── Log Groups (uncomment to include) ──────────────────────────────────────
   # /aws/lambda/my-function
   # /aws/lambda/another-function
   # /ecs/my-service

   # ── Docs ─────────────────────────────────────────────────────────────────────
   # Uncomment log groups above to include them in the query (max 50).
   # ...
   ```

3. Uncomment desired log groups, edit the query, adjust time and limit
4. Press `<CR>` → results buffer opens showing `Running...`
5. Once the query completes, the buffer is replaced with formatted results:

   ```
   Query:       filter @message like //
   Log Groups:  /aws/lambda/my-function
   Time:        2024-01-15 00:00:00 UTC → 2024-01-15 01:00:00 UTC
   Status:      Complete
   Stats:       42 matched, 1200000 scanned
   Results:     42
   ────────────────────────────────────────────────────────────────────────────────

   @timestamp: 2024-01-15 00:23:11.000
   @message:   [ERROR] Something failed

   @timestamp: 2024-01-15 00:41:05.000
   @message:   [ERROR] Another failure
   ```

6. Press `r` to re-run the same query with the time window shifted to now
7. Press `q` to return to the query form

### Keybindings

| View       | Key    | Action                                   |
| ---------- | ------ | ---------------------------------------- |
| Home       | `c`    | Open CloudWatch Logs Insights query form |
| CW Query   | `<CR>` | Execute query → open results view        |
| CW Query   | `q`    | Go back (jump list)                      |
| CW Results | `r`    | Refresh — re-run query with current time |
| CW Results | `q`    | Go back to query form (jump list)        |

### Time Parsing Reference

| Input                                                     | Parsed as                                           |
| --------------------------------------------------------- | --------------------------------------------------- |
| `relative` / `60 minutes`                                 | `now − 60 min → now`                                |
| `relative` / `24 hours`                                   | `now − 24 h → now`                                  |
| `relative` / `7 days`                                     | `now − 7 d → now`                                   |
| `absolute` / `2024-01-15 TO 2024-01-16`                   | `2024-01-15 00:00:00 UTC → 2024-01-16 23:59:59 UTC` |
| `absolute` / `2024-01-15 14:00 TO 2024-01-16`             | `2024-01-15 14:00:00 UTC → 2024-01-16 23:59:59 UTC` |
| `absolute` / `2024-01-15 14:30:00 TO 2024-01-16 09:00:00` | exact timestamps                                    |
