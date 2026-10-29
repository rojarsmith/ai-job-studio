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
