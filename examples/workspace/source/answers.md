# Answers (shared)

Values the S5 form filler may type into any application form. Lines marked needs_confirmation are NEVER filled
automatically; you answer them in the browser. Keep facts identical to profile.yml.
Per-application overrides live in generated/applications/NNN/answers.md and win over this file key by key.
tailor-prep regenerates this file from profile.yml only if it is missing.

## Identity
- full_name: Your Name
- email: you@example.com
- phone: +886-9xx-xxx-xxx
- location: Taipei, Taiwan
- linkedin:
- website:

## Eligibility (needs_confirmation)
- work_authorization_taiwan: citizen   # needs_confirmation
- work_authorization_other: needs_sponsorship   # needs_confirmation
- requires_sponsorship: yes (outside Taiwan)   # needs_confirmation
- willing_to_relocate:    # needs_confirmation
- remote_preference: hybrid

## Compensation (needs_confirmation)
- salary_expectation: TWD 100000/month minimum   # needs_confirmation
- notice_period:    # needs_confirmation
- earliest_start:   # needs_confirmation
