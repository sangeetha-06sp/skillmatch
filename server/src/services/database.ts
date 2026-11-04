import { supabase } from "../config/database";
import { AppError } from "../utils/errors";

export type DbRow = Record<string, unknown> & { id: string };
export type AuthUser = {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  passwordHash: string;
  tokenVersion: number;
  isActive: boolean;
  walletBalance: number;
  bio: string;
  location: string;
  college: string;
  department: string;
  year: string;
  availability: string;
  interests: string[];
  skillsOfferedText: string[];
  skillsWantedText: string[];
  avatarUrl?: string;
  ratingAverage: number;
  ratingCount: number;
};

const camel = (key: string) => key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

export function apiRow<T extends DbRow>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row)
    .filter(([key]) => key !== "password_hash" && key !== "token_version")
    .map(([key, value]) => [camel(key), value])
    .concat([["_id", row.id]]));
}

export function apiUser(row: DbRow, walletBalance = 0): AuthUser {
  const mapped = apiRow(row);
  return {
    ...mapped,
    _id: row.id,
    id: row.id,
    name: String(row.name),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    passwordHash: String(row.password_hash),
    tokenVersion: Number(row.token_version ?? 0),
    isActive: Boolean(row.is_active),
    walletBalance,
    bio: String(row.bio ?? ""),
    location: String(row.location ?? ""),
    college: String(row.college ?? ""),
    department: String(row.department ?? ""),
    year: String(row.year ?? ""),
    availability: String(row.availability ?? "Flexible"),
    interests: Array.isArray(row.interests) ? row.interests as string[] : [],
    skillsOfferedText: Array.isArray(row.skills_offered_text) ? row.skills_offered_text as string[] : [],
    skillsWantedText: Array.isArray(row.skills_wanted_text) ? row.skills_wanted_text as string[] : [],
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
    ratingAverage: Number(row.rating_average ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
  };
}

export function publicUser(row: DbRow): Record<string, unknown> {
  const mapped = apiRow(row);
  delete mapped.email;
  delete mapped.role;
  delete mapped.isActive;
  delete mapped.passwordHash;
  delete mapped.tokenVersion;
  delete mapped.walletBalance;
  return mapped;
}

export function safeUser(user: AuthUser): Record<string, unknown> {
  const { passwordHash: _passwordHash, tokenVersion: _tokenVersion, ...safe } = user;
  return safe;
}

export function apiSkill(row: DbRow, owner?: DbRow): Record<string, unknown> {
  return {
    ...apiRow(row),
    owner: owner ? publicUser(owner) : String(row.owner_id),
  };
}

export function apiRequest(row: DbRow, users: Map<string, DbRow>, skills: Map<string, DbRow>): Record<string, unknown> {
  const requester = users.get(String(row.requester_id));
  const recipient = users.get(String(row.recipient_id));
  const skill = skills.get(String(row.skill_id));
  return {
    ...apiRow(row),
    requester: requester ? { _id: requester.id, name: requester.name, avatarUrl: requester.avatar_url } : String(row.requester_id),
    recipient: recipient ? { _id: recipient.id, name: recipient.name, avatarUrl: recipient.avatar_url } : String(row.recipient_id),
    skill: skill ? { _id: skill.id, title: skill.title, category: skill.category, type: skill.type } : String(row.skill_id),
  };
}

export async function fetchUsers(ids: string[]): Promise<Map<string, DbRow>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("users").select("*").in("id", unique);
  if (error) throwDatabaseError(error);
  return new Map(((data ?? []) as DbRow[]).map((row) => [row.id, row]));
}

export async function fetchSkills(ids: string[]): Promise<Map<string, DbRow>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("skills").select("*").in("id", unique);
  if (error) throwDatabaseError(error);
  return new Map(((data ?? []) as DbRow[]).map((row) => [row.id, row]));
}

export async function fetchWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new AppError(500, "The wallet record for this account is missing", "WALLET_UNAVAILABLE");
  return Number(data.balance);
}

export function throwDatabaseError(error: { code?: string; message: string; details?: string; hint?: string }): never {
  if (error.code === "23505" || error.code === "23P01") {
    throw new AppError(409, "A record with that value already exists", "CONFLICT");
  }
  if (error.code === "23503" || error.code === "23514" || error.code === "22P02" || error.code === "22023") {
    throw new AppError(400, "The submitted data is invalid", "INVALID_DATA", error.details);
  }
  if (error.code === "P0002") throw new AppError(404, error.message, "NOT_FOUND");
  if (error.code === "42501") throw new AppError(403, error.message, "FORBIDDEN");
  if (error.code === "P0001") throw new AppError(409, error.message, "CONFLICT");
  throw new Error(`Supabase database error (${error.code ?? "unknown"}): ${error.message}`);
}

export function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new AppError(404, message, "NOT_FOUND");
  return data;
}
