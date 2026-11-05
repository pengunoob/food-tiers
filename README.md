# Food Tiers

A straightforward, people-powered restaurant tier list. Visitors can browse the public consensus without an account; signed-in users have one editable vote per restaurant.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Appwrite setup

Copy `.env.example` to `.env`. The public project values are already included. Add the database ID and an API key with Database read/write scope. The API key remains server-only; never prefix it with `NEXT_PUBLIC_`.

Create these two tables in the configured TablesDB database:

| Table ID | Required columns |
| --- | --- |
| `restaurants` | `name` string (120, required), `city` string (100, required), `neighborhood` string (100, required), `cuisine` string (100, required), `categories` string (400, optional), `averagePrice` integer (1–5, optional), `active` boolean (default `true`, not required), `voteCount` integer (default `0`, not required), `scoreTotal` integer (default `0`, not required) |
| `votes` | `restaurantId` string (36), `userId` string (36), `tier` integer |

Add a unique index to `votes` that covers `restaurantId` and `userId`, plus a key index on `userId`. Restaurant rows keep the aggregate total and vote count, so the public board never exposes voter identities and can calculate a tier from the rounded average: S=6, A=5, B=4, C=3, D=2, F=1.

Enable email/password authentication and add `http://localhost:3000` as an Appwrite web platform during local development. Before deployment, add the production origin too.

To designate an administrator, add that user’s Appwrite user ID to `APPWRITE_ADMIN_USER_IDS` as a comma-separated list. The protected restaurant API endpoints support create, edit, and archival; only that allowlist can call them.

## API routes

- `GET /api/restaurants` returns active restaurants and their public aggregates.
- `POST /api/restaurants`, `PATCH /api/restaurants`, and `DELETE /api/restaurants` require an administrator ID.
- `GET /api/votes`, `POST /api/votes`, and `DELETE /api/votes` require a signed-in Appwrite user. A vote is upserted per restaurant and can always be revised or removed.

The interface falls back to illustrative preview data until the database settings are present, so the design remains reviewable before Appwrite is configured.
