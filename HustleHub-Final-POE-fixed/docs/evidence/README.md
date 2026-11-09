# Evidence index

Everything in this folder was produced by running the commands shown at the top of each file.

| Path | Produced by | Shows |
|---|---|---|
| `tests/api-unit-tests-and-coverage.txt` | `npx jest --coverage --verbose` (API) | 8 suites, 104 tests passing; 91.7 % statement coverage |
| `tests/client-unit-tests-and-coverage.txt` | `npx vitest run --coverage` (client) | 6 files, 58 tests passing; 83.1 % statement coverage |
| `tests/client-build.txt` | `npm run build` (client) | production build succeeds |
| `tests/pipeline-fails-on-broken-code-demo.txt` | a deliberate bug (18 % -> 19 %) | tests fail and the command exits 1, so the pipeline step fails |
| `newman/newman-cli-output.txt`, `.html`, `.json` | `newman run ...HustleHub-Plus-Final...` | 147 requests, 587 assertions, 0 failed |
| `static-analysis/*-eslint-1-initial.txt` | ESLint + eslint-plugin-security, first run | the findings (API 12, client 2) |
| `static-analysis/*-eslint-2-final.txt` | `eslint . --max-warnings 0` | 0 problems after the fixes |
| `static-analysis/api-npm-audit-1-initial.txt` / `-2-final.txt` | `npm audit --omit=dev` | 3 vulnerabilities before, 0 after |
| `static-analysis/*npm-audit*.txt` (gate) | `npm run audit:deps` | the command used in the pipeline |
| `logging/sample-log-events.jsonl` | `logs/app.log` after a full Newman run | one real entry per event type |
| `logging/event-counts.txt` | same | how many of each event one run produced |
| `screenshots/` | you | see `screenshots/README.md` |
