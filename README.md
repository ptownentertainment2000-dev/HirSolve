# HirSolve

HirSolve is a production-oriented marketplace platform for buying, selling, and hiring services with a wallet and ledger foundation.

## Stage 1 foundation

This repository establishes the foundational architecture for:

- customer marketplace web app
- business API
- admin console
- shared auth, ledger, security, and DB packages
- Prisma-backed relational schema
- immutable financial transaction modeling

## Monorepo structure

```text
HirSolve/
├── apps/
│   ├── web/
│   ├── api/
│   └── admin/
├── packages/
│   ├── db/
│   ├── auth/
│   ├── ledger/
│   └── security/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── README.md
```

## Getting started

1. Install dependencies:
   pnpm install
2. Start PostgreSQL:
   docker compose up -d
3. Copy environment file:
   cp .env.example .env
4. Generate Prisma client:
   pnpm db:generate
5. Push schema:
   pnpm db:push
6. Seed data:
   pnpm db:seed

## Notes

- Monetary values are always stored as decimal values with immutable ledger postings.
- Balance updates happen through account postings rather than direct arithmetic updates.
- Sensitive actions require authentication and, where required, step-up security flows.
