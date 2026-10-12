# Isolated technician proof regression fixture

Start from the repository root:

```powershell
node node_modules/vite/bin/vite.js --config scripts/tests/tech-proof-focus/vite.config.ts
```

Open `http://127.0.0.1:6193/scripts/tests/tech-proof-focus/index.html`.
This loads the actual dashboard, hook, order card and collection sheet. Auth,
Supabase, attendance and technician reads are synthetic in-memory fixtures;
the upload and save counters do not perform network writes. The production
entry point does not import this fixture. Do not use this config for normal app development.

1. Complete the initial read, open collection, choose Instapay, and select a small synthetic PNG through the gallery or camera input.
2. Trigger the return event (focus + visibilitychange). The preview must remain visible, the full-page loader must remain absent, and sending must be disabled until the reads complete.
3. Complete reads, including reversed completion. The preview must still be present and sending enabled.
4. Fail a refresh and complete its read. The preview remains; sending stays disabled. Restore reads, trigger another return, and complete it to recover sending.
5. Send once. The counters must show uploads=1;saves=1. Complete the post-success read.
6. Open another collection form. Change the route or current order and complete the read. The old form must close. Withdraw leadership and complete the read: collection closes and follow-only mode appears.

To reproduce the original failure, export the deployed-before-fix hook with
`git show 65fafd7:src/hooks/useTechnicianData.ts` into a temporary file outside
the source tree and set `QA_BASELINE_HOOK` to its absolute path before starting
the fixture on another port. The return event then shows the full-page loader
and removes the form. This comparison uses the same synthetic services.

This is a manual browser regression fixture, not a production storage/payment,
Auth, or physical Android camera test. Stop its loopback server after use.
