import "server-only";

import { Account, Client, TablesDB } from "node-appwrite";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See .env.example.`);
  return value;
}

function baseClient() {
  return new Client()
    .setEndpoint(required("NEXT_PUBLIC_APPWRITE_ENDPOINT"))
    .setProject(required("NEXT_PUBLIC_APPWRITE_PROJECT_ID"));
}

export function databaseConfig() {
  return {
    databaseId: required("APPWRITE_DATABASE_ID"),
    restaurantsTableId: required("APPWRITE_RESTAURANTS_TABLE_ID"),
    votesTableId: required("APPWRITE_VOTES_TABLE_ID"),
  };
}

export function adminTables() {
  return new TablesDB(baseClient().setKey(required("APPWRITE_API_KEY")));
}

export async function requireUser(request: Request): Promise<{ $id: string }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sign in to vote.");

  const account = new Account(baseClient().setJWT(token));
  return account.get();
}

export function isAdmin(userId: string) {
  return (process.env.APPWRITE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

export function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return Response.json({ error: message }, { status });
}
