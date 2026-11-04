---
title: Security Policy
department: engineering
visibility: restricted
version: 2
status: active
effective: 2026-06-01
updated: 2026-10-01
---

# Security Policy

## Production Access Approval

Production database and cluster access requires dual approval from both the Engineering Director and the Security On-Call Lead via an expiring privilege ticket. Temporary production access grants expire automatically after four hours and all executed commands are recorded in the central audit log.

## External AI Tools and Source Code

Developers must never upload proprietary source code, customer data, or internal credentials to external AI tools or public language model services. Only company-approved enterprise AI assistants running inside our private cloud boundary may be used with internal code.
