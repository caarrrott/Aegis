---
title: Engineering Error Codes
department: engineering
visibility: restricted
version: 1
status: active
effective: 2026-01-15
updated: 2026-09-10
---

# Engineering Error Codes

## E-1042 Database Connection Pool Exhausted

Error code E-1042 means that the primary PostgreSQL connection pool has reached its maximum capacity and no free connections were returned within the 10-second checkout timeout. On-call engineers must inspect long-running transactions in `pg_stat_activity` and verify that no external API calls are executed inside an open database transaction.

## E-2019 Upstream Identity Token Expired

Error code E-2019 indicates that the OIDC bearer token presented to the internal gateway expired more than 60 seconds ago. Clients must refresh their session token via the identity provider before retrying the request.
