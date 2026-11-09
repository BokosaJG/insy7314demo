# HustleHub+ API - Workload 2: Security Hardening & Backend Testing

> **Historical document (Part 2).** It is kept to show the progression of the project. The current system,
> its tests and its security review are documented in the root `README.md`. Since this was written:
> the Postman collection was extended and renamed to `HustleHub-Plus-Final.postman_collection.json`
> (147 requests, 587 assertions); the "tokens are not revocable" limitation below was **resolved** by
> server-side token revocation; and the per-account login limit is now complemented by a persistent,
> database-backed account lockout.

## 1. What was added (mapped to the rubric)

### API Security (15) - validation, sanitisation, errors
| Requirement | Where | How |
|---|---|---|
| Input validation on every endpoint | `validators/*.js`, `middleware/validate.js` | `express-validator` chains on register, login, create/update gig, create booking and every `:id` param. Checks presence, **type**, length, format. Failures -> `400 {error:"Validation failed", details:[{field,message}]}`; submitted values are never echoed back. |
| Mass-assignment protection | `middleware/validate.js` | `req.body` is replaced with `matchedData()` - only validated fields survive (`role:"Admin"`, `freelancer`, `_id`, `amount` are dropped/rejected). |
| NoSQL injection | `middleware/sanitizeRequest.js`, `config/db.js` | Keys starting with `$` or containing `.` are stripped from body and query; validators reject non-string values (`{"$gt":""}`); `mongoose.set('sanitizeFilter', true)` kept as a third layer. |
| XSS | `middleware/sanitizeRequest.js`, `utils/sanitize.js` | Script/style blocks **including their contents**, all tags, stray `<>` and control chars removed from every string (passwords excluded). |
| Safe, consistent errors | `middleware/errorHandler.js` | One shape `{error}`; full error + stack logged server-side only with a request id; generic messages for 400/404/409/413/415/500/503; `X-Request-Id` header for tracing; 404 handler; `unhandledRejection` logged. |
| Other hardening | `index.js`, `authController.js` | JSON-only (`415`), 10kb body cap, password max 72 chars (bcrypt limit), timing-equalised login (no user enumeration), JWT signed/verified as HS256, startup refuses a missing/weak `JWT_SECRET`. |

> **Why custom sanitising middleware instead of `express-mongo-sanitize` / `xss-clean`?**
> This project uses Express 5, where `req.query` is a read-only getter. Both packages assign to it and crash
> every request with `Cannot set property query of #<IncomingMessage> which has only a getter` (reproduced).
> `xss-clean` is also unmaintained. `sanitizeRequest.js` does the same job and works on Express 5.

### Rate Limiting (10) - `middleware/rateLimiters.js` (`express-rate-limit`)
| Limiter | Applies to | Default |
|---|---|---|
| API-wide | all `/api` | 300 / 15 min / IP |
| Login (per IP) | `POST /auth/login`, failed attempts only | 20 / 15 min |
| Login (per account) | `POST /auth/login`, key = IP + email, failed only | 5 / 15 min |
| Registration | `POST /auth/register`, successful sign-ups only | 5 / hour / IP |
| Booking | `POST /bookings`, per authenticated user | 10 / min |

429 response: `{"error":"<meaning>","retryAfterSeconds":N}` + `Retry-After` + standard `RateLimit` / `RateLimit-Policy` headers.
All limits are configurable in `.env` (see `.env.example`).

### Security Headers (10) - `middleware/securityHeaders.js` (Helmet)
* **CSP**: `default-src 'none'` with every fetch directive explicitly `'none'`, plus `base-uri`, `form-action`, `frame-ancestors` = `'none'` (these do not fall back to `default-src`) and `upgrade-insecure-requests` on HTTPS. The API only returns JSON, so nothing needs to be allowed.
* HSTS (1 year, includeSubDomains, preload), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP `same-origin`, CORP `same-site`, `Permissions-Policy` (camera/mic/geolocation/payment/usb off), `Cache-Control: no-store`, `X-Powered-By` removed, CORS locked to `CLIENT_ORIGIN`.
* If the React/Android client is later served from this same server, relax only the directives that client needs.

### Backend Testing (10) - `postman/`
`HustleHub-Plus-Part2.postman_collection.json` - 99 requests / 469 assertions in 11 folders:
success paths, invalid input, NoSQL + XSS payloads, missing/garbage/forged/`alg:none`/tampered JWTs, wrong role, **another user's gig** (PUT/DELETE) and **another user's booking**, header checks, error-leak checks, and rate-limit-exceeded (login, register, booking).
A collection-level script also scans **every** response for stack traces, file paths and DB error text.
The Part 1 collection is kept in `postman/archive/` (its exact-message assertions predate the new error format; all its scenarios are covered again in Part 2).

## 2. How to run

```bash
npm install
cp .env.example .env            # set JWT_SECRET (32+ chars), MONGO_URI
npm run seed:admin              # creates the Admin used by the tests
# HTTPS needs certs (or set USE_HTTPS=false and baseUrl=http://localhost:4000):
mkdir -p certs && openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -subj "/CN=localhost" -keyout certs/localhost-key.pem -out certs/localhost-cert.pem
npm start                       # terminal 1  (RESTART before every Newman run - see note)
npm run test:api                # terminal 2
```
Outputs: `reports/newman-report.html` (open in a browser), `reports/newman-report.json`.

**Note:** rate-limit counters live in memory. Restart the API before each Newman run, otherwise earlier runs
leave the register/booking quotas used up and functional tests will (correctly) return 429.

## 3. Evidence in `reports/`
* `newman-report.html / .json` - full Newman run (116 requests incl. rate-limit probes, **469 assertions, 0 failed**)
* `newman-cli-output.txt` - terminal output of the same run
* `screenshots/01-05` - Newman: summary, validation/sanitisation, wrong-role & other-user's-gig, headers, 429s
* `screenshots/06-08` + `evidence-*.txt` - raw `curl`: headers, attack payloads, login lockout 429
* `screenshots/09` + `evidence-before-after.txt` - same suite against the Workload 1 code: **82 assertions failed**; against Workload 2: **0**

## 4. Known limitations (worth stating in the report)
* Rate-limit counters are per process (memory). Multiple servers would need a shared store (e.g. Redis).
* Per-account login lockout is keyed by IP + email; a distributed attack on one account is only slowed by the per-IP and API-wide limits.
* Behind a proxy, set `TRUST_PROXY` or every client appears to have the proxy's IP.
* ~~Tokens are not revocable before expiry (1h).~~ **Resolved in the final part** (token versioning + logout).
