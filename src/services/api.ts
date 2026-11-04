export type ApiUser = {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  location?: string;
  college?: string;
  department?: string;
  year?: string;
  availability?: string;
  bio?: string;
  avatarUrl?: string;
  walletBalance?: number;
  interests?: string[];
  skillsOfferedText?: string[];
  skillsWantedText?: string[];
};

export type ApiSkill = {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  level: string;
  type: "offer" | "request";
  mode: string;
  location?: string;
  availability?: "Flexible" | "Weekday evenings" | "Weekends";
  credits?: number;
  owner: string | (Pick<ApiUser, "_id" | "name" | "location" | "college" | "avatarUrl"> & { id?: string; ratingAverage?: number; ratingCount?: number });
  createdAt?: string;
};

export type ApiRequest = {
  _id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "completed";
  createdAt: string;
  paymentAmount: number;
  requester: string | Pick<ApiUser, "_id" | "name">;
  recipient: string | Pick<ApiUser, "_id" | "name">;
  skill: string | { _id: string; title: string };
};

export type ApiSession = {
  _id: string;
  status: "scheduled" | "in_progress" | "completed" | "disputed" | "cancelled";
  scheduledAt: string;
  durationMinutes: number;
  paymentAmount?: number;
  meetingUrl?: string;
  participants: (string | Pick<ApiUser, "_id" | "name">)[];
  request: string | { skill?: string | { title: string }; requester?: string; recipient?: string };
};

export type ApiMatch = {
  skill: ApiSkill;
  score: number;
  explanation: { factor: string; points: number; reason: string }[];
};

export type ApiTransaction = {
  _id: string;
  amount: number;
  direction: "credit" | "debit";
  reason: string;
  description: string;
  createdAt: string;
};

export type ApiNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

type ApiEnvelope<T> = T & { error?: { message?: string } };
const baseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "") ?? "";
const tokenKey = "skillbridge-token";

export const apiConfigured = baseUrl.length > 0;
export const getApiToken = () => localStorage.getItem(tokenKey);
export const clearApiToken = () => localStorage.removeItem(tokenKey);

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error("Set VITE_API_URL to connect to the SkillBridge API.");
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  } catch {
    throw new Error("Could not reach the SkillBridge API. Check the server and VITE_API_URL.");
  }
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(payload.error?.message ?? `API request failed (${response.status}).`);
  return payload;
}

export async function apiLogin(email: string, password: string) {
  const result = await apiRequest<{ user: ApiUser; token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  localStorage.setItem(tokenKey, result.token);
  return result.user;
}

export async function apiRegister(name: string, email: string, password: string, profile: Pick<ApiUser, "college" | "department" | "year">) {
  const result = await apiRequest<{ user: ApiUser; token: string }>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, ...profile }) });
  localStorage.setItem(tokenKey, result.token);
  return result.user;
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: "DELETE" });
}
