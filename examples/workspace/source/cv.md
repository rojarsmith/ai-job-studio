<!--
cv.md — the single source of truth for everything the loop may claim about you.

Who reads it: modes/score.md (evidence for scoring), modes/tailor.md (the only material a tailored resume may use),
ats-check (after tailoring, the same shape is required of every draft). Humans read it too, so keep it honest.

Rules that make it work for both an AI drafter and an ATS parser:
1. One fact per line. A bullet = what you did + a number + the scope. "Cut p99 latency 40% for 2M daily orders".
2. Keep the headings below exactly (an ATS keys on them). Add only from: Certifications, Projects, Publications,
   Languages, Awards, Volunteering. No other H2.
3. Every role is "### Company — Title" and the next line is "YYYY-MM to YYYY-MM|present · City · context".
   One date format for the whole file, newest first.
4. Write the technology names the way postings write them (Kubernetes, not "k8s"; PostgreSQL, not "pg").
   Mention a technology inside the bullet where you used it; the Skills list alone is weak evidence.
5. Put more here than any one resume needs. The tailor mode cuts; it never adds.
6. No tables, images, columns or emoji. Comments like this one are ignored by every reader.
7. Do NOT put age, gender, marital status, photo, ID numbers, full street address, desired salary or desired titles
   here. Those belong in profile.yml and answers.md, and most ATS flag them.

A translated copy may live next to this file as cv.<lang>.md (cv.zh-TW.md). Keep the facts identical.
-->
# Full Name
email@example.com · +886-9xx-xxx-xxx · City, Country · linkedin.com/in/handle · github.com/handle · yoursite.example

## Summary
<!-- 3 to 5 lines. Who you are in one noun phrase, years, the two or three things you are known for, what you want next. -->
Backend engineer with 8 years building payment and order systems in Go on Kubernetes. Led a 6-person team through an AWS migration with zero customer-facing downtime. Looking for a staff or lead role on a platform team.

## Skills
<!-- Group by category. Exact product names. Only what you can defend in an interview. -->
- Languages: Go, TypeScript, Python, SQL
- Backend: gRPC, REST, GraphQL, PostgreSQL, Redis, Kafka
- Infrastructure: AWS (EKS, RDS, S3, IAM), Kubernetes, Terraform, Helm, GitHub Actions
- Observability: Prometheus, Grafana, OpenTelemetry
- Practices: system design, incident response and on-call, code review, mentoring
- Leadership: hiring, roadmap planning, cross-functional delivery with product and sales

## Experience
<!-- Newest first. 3 to 8 bullets for recent roles, 1 to 3 for old ones. Every bullet is a fact you can prove. -->
### Acme Corp — Senior Backend Engineer
2021-03 to present · Taipei · fintech, 400 people
- Cut p99 latency 40% for the order service (2M orders/day) by rewriting it in Go and moving it to Kubernetes
- Led the migration of 30 services to AWS EKS with Terraform; zero customer-facing downtime over 6 months
- Built the CI/CD pipeline on GitHub Actions used by 25 engineers; deploy lead time from 2 days to 20 minutes
- Mentored 3 junior engineers; two promoted within 18 months
- On-call lead for payments; wrote the incident runbook adopted by all backend teams

### Beta Co — Backend Engineer
2017-06 to 2021-02 · Hsinchu · e-commerce, 120 people
- Built the PostgreSQL billing pipeline handling 2M rows/day with Kafka change-data-capture
- Introduced OpenTelemetry tracing; mean time to detect dropped from 45 to 8 minutes

### Gamma Ltd — Junior Developer
2015-09 to 2017-05 · Taipei · SaaS, 30 people
- Shipped the customer-facing reporting API in Node.js; 300 paying accounts

## Education
### National Taiwan University — B.S. Computer Science
2011-09 to 2015-06

## Certifications
- AWS Certified Solutions Architect – Associate (2022)
- Certified Kubernetes Administrator (2021)

## Projects
<!-- Side projects, open source, products you own. Name, one line of what it is, your role, a number. -->
- **otel-sampler** (github.com/handle/otel-sampler): tail-based sampling for OpenTelemetry; 400 stars, used by 2 companies in production
- **Personal site** (yoursite.example): Next.js, writing on distributed systems

## Publications
- "Zero-downtime migrations with Terraform and EKS", company engineering blog, 2022
- Talk: "Tracing payments end to end", Taipei Go Meetup, 2021

## Languages
- Mandarin Chinese: native
- English: professional working proficiency (TOEIC 900)
- Japanese: basic (JLPT N4)

## Awards
- Company Engineering Excellence Award, Acme Corp, 2023
