# Native Host CKA_ID Debug Checklist

Use this checklist when `SIGN_PDF_END` fails with `CMS_BUILD_FAILED` or
`no private key with the requested CKA_ID`.

## 1) Instrument `SIGN_PDF_START`

- Log incoming `request_id`, `job_id`, `slot_id`.
- Log incoming `cert_id` in safe form:
  - raw length,
  - normalized hex length (after trimming/removing `0x`),
  - decode success/failure (without printing sensitive bytes in full).
- Log session/slot handle selected for this job.

## 2) Instrument Pre-Sign Key Lookup (`SIGN_PDF_END`)

- Before CMS build, enumerate candidate private-key objects in active slot.
- For each candidate, log redacted key metadata and `CKA_ID` (safe/redacted).
- Log whether any key `CKA_ID` matches the normalized cert `CKA_ID`.
- If no match, emit a distinct machine-readable failure code (recommended:
  `KEY_NOT_FOUND_FOR_CERT_ID`) instead of generic CMS failure.

## 3) Failure Logging Contract

When signing fails, include these fields in one structured log event:

- `request_id`, `job_id`, `slot_id`
- `cert_id_len`, `cert_id_normalized_len`
- `private_key_candidates_count`
- `match_found` (boolean)
- `error_code` and short error reason

## 4) One-Run Verification Steps

1. Trigger a failing signing flow from UI with debug preflight enabled.
2. Confirm UI logs show exact outbound `slotId` and `certId`.
3. Confirm host logs show same normalized `cert_id`.
4. Confirm host logs explicitly show whether matching private key exists.
5. Classify root cause as one of:
   - malformed `certId`,
   - wrong slot/session,
   - certificate present but private key missing/mismatched.
