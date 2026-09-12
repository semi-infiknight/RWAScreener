# `@rwascreener/db` stub

SQL migrations matching `docs/SPEC.md` §6.

Apply later when Postgres exists (Railway `rwascreener` — do not provision from this stub).

```
psql "$DATABASE_URL" -f packages/db/migrations/001_init.sql
```
