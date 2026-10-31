# Adapters (L2)

One module per site. Pure code, no LLM. Each exports:

| Function | P1 | Purpose |
| --- | --- | --- |
| `search(cfg)` | yes | Login-free discovery. Returns `Job[]` |
| `detail(url)` | yes | Full job text for S2. Returns `JobDetail` or `null` when closed |
| `isLive(url)` | yes | Cheap liveness check |
| `login_state(ctx)` | P3 | Detect logged-in state in an L1 browser context |
| `fill(ctx, answers)` | P3 | Fill the application form, never submit |
| `submit_gate(ctx)` | P3 | Always returns `needs_human` |

```ts
Job = { url, company, title, source, location?, salary?, posted?, external_id? }
JobDetail = Job & { description, requirements?, meta? }
```

## What belongs in this repo

This repo is public and meant to be reused anywhere in the world, so it holds only what is true for every user:

- Site mechanics shared by everyone: public API endpoints and parameters, page parsing, login-state detection, form-filling flow, per-site defaults for selectors.
- Neutral examples under `examples/`: invented names, `example.com` addresses, placeholder values.

Nothing that identifies a person goes in: no real name, email, phone, account id, employer, city-level address, photo, resume text, keywords tuned to one person, workspace paths, or captured pages and session data. Tests and fixtures use invented values. Those live in the private workspace (`original/`, `source/`, `runtime/`). Project metadata is not personal data: the copyright holder in `LICENSE`, the owning account or organization, and the public repository URL may appear.

When a site changes, fix the default here if it is a general fix; put a one-person workaround in the workspace's `source/sites.yml`.

Out of scope for adapters: working around bot challenges, CAPTCHA, 2FA or rate limits. On those the code stops and hands the page back to the human.
