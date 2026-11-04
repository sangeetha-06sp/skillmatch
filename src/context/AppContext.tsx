import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiConfigured, apiDelete, apiGet, apiPatch, apiPost, clearApiToken, getApiToken, type ApiMatch, type ApiNotification, type ApiRequest, type ApiSession, type ApiSkill, type ApiTransaction, type ApiUser } from "../services/api";

export type Skill = {
  id: string;
  ownerId?: string;
  title: string;
  category: string;
  level: string;
  description: string;
  owner: string;
  college: string;
  avatar: string;
  rating: number;
  availability: string;
  tags: string[];
  credits: number;
};

export type Student = {
  id?: string;
  role?: "student" | "admin";
  name: string;
  email: string;
  college: string;
  department: string;
  year: string;
  availability: string;
  bio: string;
  avatar: string;
  interests: string[];
  skillsOffered: string[];
  skillsWanted: string[];
};

export type ExchangeRequest = { id: string; skill: string; skillId?: string; person: string; direction: "incoming" | "outgoing"; status: "Pending" | "Accepted" | "Declined" | "Cancelled" | "Completed"; date: string };
export type LearningSession = { id: string; requestId?: string; title: string; person: string; date: string; time: string; duration: string; credits: number; status: "Upcoming" | "Awaiting confirmation" | "Completed" | "Disputed" | "Cancelled"; meetingLink?: string };
export type SkillMatch = { skill: Skill; score: number; reason: string };
export type Activity = { id: string; title: string; detail: string; date: string; tone: "violet" | "cyan" | "pink"; read?: boolean; category?: string };
export type WalletEntry = { id: string; title: string; detail: string; amount: number; date: string; direction: "earned" | "spent" };

type AppContextValue = {
  user: Student | null;
  apiLoading: boolean;
  theme: "dark" | "light";
  skills: Skill[];
  requests: ExchangeRequest[];
  sessions: LearningSession[];
  activities: Activity[];
  transactions: WalletEntry[];
  credits: number;
  savedSkills: string[];
  setTheme: (theme: "dark" | "light") => void;
  login: (email: string) => void;
  loginApiUser: (user: ApiUser) => void;
  register: (name: string, email: string, profile?: Partial<Student>) => void;
  logout: () => void;
  updateProfile: (profile: Student) => Promise<void>;
  addSkill: (skill: Omit<Skill, "id" | "owner" | "college" | "avatar" | "rating">) => Promise<void>;
  updateSkill: (id: string, updates: Pick<Skill, "title" | "description" | "category" | "level" | "tags">) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  searchSkills: (query: string, category: string, level: string, availability: string) => Promise<Skill[]>;
  getSkill: (id: string) => Promise<Skill>;
  getMatches: () => Promise<SkillMatch[]>;
  sendRequest: (skill: Skill) => Promise<void>;
  updateRequest: (id: string, status: ExchangeRequest["status"]) => Promise<void>;
  confirmSession: (id: string) => Promise<void>;
  confirmPartner: (id: string) => void;
  cancelSession: (id: string) => Promise<void>;
  reportSession: (id: string, reason: string) => Promise<void>;
  scheduleSession: (session: Omit<LearningSession, "id" | "status" | "credits"> & { requestId?: string; scheduledAt?: string; durationMinutes?: number; credits?: number }) => Promise<void>;
  toggleSaved: (id: string) => void;
  markNotificationsRead: () => Promise<void>;
};

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function mapApiUser(user: ApiUser): Student {
  return {
    id: user._id,
    role: user.role === "admin" ? "admin" : "student",
    name: user.name,
    email: user.email,
    college: user.college || user.location || "Student community",
    department: user.department || "Student",
    year: user.year || "Student",
    availability: user.availability || "Flexible",
    bio: user.bio || "",
    avatar: user.avatarUrl || initials(user.name),
    interests: user.interests ?? [],
    skillsOffered: user.skillsOfferedText ?? [],
    skillsWanted: user.skillsWantedText ?? [],
  };
}

function mapApiSkill(skill: ApiSkill, currentUser?: ApiUser): Skill {
  const owner = typeof skill.owner === "string" ? currentUser ?? null : skill.owner;
  return {
    id: skill._id,
    ownerId: skill.ownerId ?? (owner && "_id" in owner ? String(owner._id) : undefined),
    title: skill.title,
    category: skill.category,
    level: skill.level.charAt(0).toUpperCase() + skill.level.slice(1),
    description: skill.description,
    owner: owner?.name ?? "SkillBridge student",
    college: owner?.college || owner?.location || skill.location || "Student community",
    avatar: owner?.avatarUrl ?? initials(owner?.name ?? "S"),
    rating: owner && "ratingAverage" in owner ? owner.ratingAverage ?? 0 : 0,
    availability: skill.availability ?? "Flexible",
    tags: skill.tags ?? [],
    credits: skill.credits ?? 2,
  };
}

function asObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) return String((value as { _id: unknown })._id);
  return "";
}

function mapApiRequest(request: ApiRequest, currentUser: ApiUser): ExchangeRequest {
  const incoming = asObjectId(request.recipient) === currentUser._id;
  const person = incoming
    ? typeof request.requester === "string" ? "SkillBridge student" : request.requester.name
    : typeof request.recipient === "string" ? "SkillBridge student" : request.recipient.name;
  const status = ({ pending: "Pending", accepted: "Accepted", rejected: "Declined", cancelled: "Cancelled", completed: "Completed" } as const)[request.status];
  return { id: request._id, skill: typeof request.skill === "string" ? "Skill session" : request.skill.title, skillId: request.skillId ?? (typeof request.skill === "string" ? undefined : request.skill._id), person, direction: incoming ? "incoming" : "outgoing", status, date: new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
}

function mapApiSession(session: ApiSession, currentUser: ApiUser, skills: Skill[]): LearningSession {
  const peer = session.participants.find((person) => asObjectId(person) !== currentUser._id);
  const request = typeof session.request === "string" ? null : session.request;
  const skillRef = request?.skill;
  const skillTitle = skillRef && typeof skillRef !== "string" ? skillRef.title : skills.find((item) => item.id === skillRef)?.title;
  const when = new Date(session.scheduledAt);
  const status = ({ scheduled: "Upcoming", in_progress: "Awaiting confirmation", completed: "Completed", disputed: "Disputed", cancelled: "Cancelled" } as const)[session.status];
  return {
    id: session._id,
    requestId: session.requestId ?? (typeof session.request === "string" ? undefined : session.request._id),
    title: skillTitle ?? "Skill exchange",
    person: peer && typeof peer !== "string" ? peer.name : "Your learning partner",
    date: when.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    duration: `${session.durationMinutes} min`,
    credits: session.paymentAmount ?? 0,
    status,
    meetingLink: session.meetingUrl,
  };
}

function mapApiTransaction(transaction: ApiTransaction): WalletEntry {
  return {
    id: transaction._id,
    title: transaction.description,
    detail: transaction.reason.replace(/_/g, " "),
    amount: transaction.amount,
    date: new Date(transaction.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    direction: transaction.direction === "credit" ? "earned" : "spent",
  };
}

function mapApiNotification(notification: ApiNotification): Activity {
  const category = notification.type.startsWith("request") ? "Requests" : notification.type.startsWith("session") ? "Sessions" : notification.type.startsWith("wallet") ? "Wallet" : "Updates";
  return {
    id: notification._id,
    title: notification.title,
    detail: notification.message,
    date: new Date(notification.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    tone: category === "Requests" ? "cyan" : category === "Sessions" ? "violet" : "pink",
    category,
    read: Boolean(notification.readAt),
  };
}

const demoUser: Student = {
  name: "Alex Morgan",
  email: "alex@stanford.edu",
  college: "Stanford University",
  department: "Computer Science",
  year: "3rd year",
  availability: "Weekday evenings",
  bio: "Curious builder exploring the intersection of AI and thoughtful design. Always happy to share what I know, and excited to learn something new.",
  avatar: "AM",
  interests: ["Artificial intelligence", "Product design", "Startups", "Photography"],
  skillsOffered: ["React & TypeScript", "Figma UI Design", "Python Fundamentals"],
  skillsWanted: ["Machine Learning", "Public Speaking"],
};

const seedSkills: Skill[] = [
  { id: "s1", title: "Build modern apps with React", category: "Web Development", level: "Intermediate", description: "Let's turn an idea into a polished React app. We'll work through component architecture, hooks, and shipping your first project.", owner: "Priya Sharma", college: "UC Berkeley", avatar: "PS", rating: 4.9, availability: "Weekday evenings", tags: ["React", "TypeScript", "Web"], credits: 2 },
  { id: "s2", title: "Machine learning, made approachable", category: "AI & Machine Learning", level: "Beginner", description: "Get hands-on with the foundations of ML. We'll build a tiny model, make sense of the math, and explore where AI is headed.", owner: "Jordan Lee", college: "MIT", avatar: "JL", rating: 5.0, availability: "Flexible", tags: ["Python", "AI", "Machine Learning"], credits: 3 },
  { id: "s3", title: "Design a portfolio in Figma", category: "Design", level: "All levels", description: "Learn to think in systems and create beautiful interfaces. Together we will design and prototype a portfolio you'll love sharing.", owner: "Sam Rivera", college: "Parsons", avatar: "SR", rating: 4.8, availability: "Weekends", tags: ["Figma", "UI/UX", "Portfolio"], credits: 2 },
  { id: "s4", title: "Speak with confidence", category: "Communication", level: "Beginner", description: "Practical, friendly public speaking practice for people who would rather not be speaking. Let's make it feel natural.", owner: "Amara Okafor", college: "NYU", avatar: "AO", rating: 4.9, availability: "Weekday evenings", tags: ["Speaking", "Confidence", "Career"], credits: 2 },
  { id: "s5", title: "Electronics & Arduino essentials", category: "Electronics", level: "Intermediate", description: "Bring your hardware ideas to life. Learn the fundamentals of circuits, microcontrollers, and programming an Arduino.", owner: "Kai Chen", college: "Georgia Tech", avatar: "KC", rating: 4.7, availability: "Flexible", tags: ["Arduino", "Hardware", "Circuits"], credits: 2 },
  { id: "s6", title: "Python for your first data project", category: "Programming", level: "Beginner", description: "From your first notebook to a meaningful data story. Learn Python by building something you care about.", owner: "Elena Petrova", college: "UCLA", avatar: "EP", rating: 4.9, availability: "Weekends", tags: ["Python", "Data", "Jupyter"], credits: 2 },
];

type PersistedData = {
  user: Student | null; theme: "dark" | "light"; skills: Skill[];
  requests: ExchangeRequest[]; sessions: LearningSession[]; activities: Activity[];
  transactions: WalletEntry[];
  credits: number; savedSkills: string[];
};

const initialData: PersistedData = {
  user: null,
  theme: "dark",
  skills: apiConfigured ? [] : seedSkills,
  requests: apiConfigured ? [] : [
    { id: "r1", skill: "React & TypeScript", person: "Taylor Kim", direction: "incoming", status: "Pending", date: "2 hours ago" },
    { id: "r2", skill: "Public Speaking", person: "Alex Morgan", direction: "outgoing", status: "Accepted", date: "Yesterday" },
    { id: "r3", skill: "Figma UI Design", person: "Jordan Lee", direction: "outgoing", status: "Pending", date: "Oct 26" },
  ],
  sessions: apiConfigured ? [] : [
    { id: "l1", title: "React & TypeScript", person: "Priya Sharma", date: "Today", time: "4:30 PM", duration: "60 min", credits: 2, status: "Upcoming" },
    { id: "l2", title: "Design thinking basics", person: "Sam Rivera", date: "Tomorrow", time: "11:00 AM", duration: "45 min", credits: 2, status: "Upcoming" },
  ],
  activities: apiConfigured ? [] : [
    { id: "a1", title: "Welcome to SkillBridge!", detail: "Your learning journey starts here.", date: "Just now", tone: "violet" },
    { id: "a2", title: "Profile ready to shine", detail: "Add your skills to get better matches.", date: "Today", tone: "cyan" },
    { id: "a3", title: "The learning galaxy awaits", detail: "Explore 240+ student-led sessions.", date: "Today", tone: "pink" },
  ],
  transactions: apiConfigured ? [] : [
    { id: "w1", title: "Session with Sam Rivera", detail: "UI design fundamentals", amount: 2, date: "Oct 26", direction: "spent" },
    { id: "w2", title: "Taught Python basics", detail: "60 min learning session", amount: 2, date: "Oct 24", direction: "earned" },
    { id: "w3", title: "Welcome bonus", detail: "Your first SkillBridge credits", amount: 10, date: "Oct 21", direction: "earned" },
  ],
  credits: apiConfigured ? 0 : 10,
  savedSkills: [],
};

function readData(): PersistedData {
  try {
    const stored = localStorage.getItem("skillbridge-data");
    if (!stored) return initialData;
    const saved = JSON.parse(stored) as Partial<PersistedData>;
    if (apiConfigured) {
      return {
        ...initialData,
        theme: saved.theme === "light" ? "light" : "dark",
        savedSkills: Array.isArray(saved.savedSkills) ? saved.savedSkills : [],
      };
    }
    return { ...initialData, ...saved };
  } catch {
    return initialData;
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(readData);
  const [apiLoading, setApiLoading] = useState(apiConfigured);

  useEffect(() => {
    const persisted = apiConfigured ? { theme: data.theme, savedSkills: data.savedSkills } : data;
    localStorage.setItem("skillbridge-data", JSON.stringify(persisted));
    document.documentElement.dataset.theme = data.theme;
  }, [data]);

  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;
    const loadWorkspace = async () => {
      setApiLoading(true);
      try {
        const skillResponse = await apiGet<{ skills: ApiSkill[] }>("/skills?limit=100");
        const skills = skillResponse.skills.map((skill) => mapApiSkill(skill));
        const token = getApiToken();
        if (!token) {
          if (active) setData((current) => ({ ...current, skills }));
          return;
        }
        const [profileResponse, skillResponseMine, requestResponse, sessionResponse, walletResponse, notificationResponse] = await Promise.all([
          apiGet<{ user: ApiUser }>("/auth/me"),
          apiGet<{ skills: ApiSkill[] }>("/skills/mine"),
          apiGet<{ requests: ApiRequest[] }>("/requests?limit=100"),
          apiGet<{ sessions: ApiSession[] }>("/sessions?limit=100"),
          apiGet<{ balance: number; transactions: ApiTransaction[] }>("/wallet?limit=100"),
          apiGet<{ notifications: ApiNotification[] }>("/notifications?limit=100"),
        ]);
        if (!active) return;
        const currentUser = profileResponse.user;
        const ownedSkills = skillResponseMine.skills.map((skill) => mapApiSkill(skill, currentUser));
        const allSkills = [...new Map([...skills, ...ownedSkills].map((skill) => [skill.id, skill])).values()];
        setData((current) => ({
          ...current,
          user: mapApiUser(currentUser),
          skills: allSkills,
          requests: requestResponse.requests.map((request) => mapApiRequest(request, currentUser)),
          sessions: sessionResponse.sessions.map((session) => mapApiSession(session, currentUser, allSkills)),
          credits: walletResponse.balance,
          transactions: walletResponse.transactions.map(mapApiTransaction),
          activities: notificationResponse.notifications.map(mapApiNotification),
        }));
      } catch (error) {
        if (!active) return;
        console.error("Could not load SkillBridge API data:", error);
        toast.error(error instanceof Error ? error.message : "Could not load SkillBridge API data.");
        if (getApiToken()) {
          clearApiToken();
          setData((current) => ({ ...current, user: null, skills: [], requests: [], sessions: [], activities: [], transactions: [], credits: 0 }));
        }
      } finally {
        if (active) setApiLoading(false);
      }
    };
    void loadWorkspace();
    return () => { active = false; };
  }, [data.user?.id]);

  useEffect(() => {
    const userId = data.user?.id;
    if (!apiConfigured || !userId || !getApiToken()) return;
    let active = true;
    let refreshing = false;
    let errorNotified = false;
    const refreshWorkspace = async () => {
      if (document.visibilityState === "hidden" || !getApiToken() || refreshing) return;
      refreshing = true;
      try {
        const [profile, skillResponse, mineResponse, requestResponse, sessionResponse, walletResponse, notificationResponse] = await Promise.all([
          apiGet<{ user: ApiUser }>("/auth/me"),
          apiGet<{ skills: ApiSkill[] }>("/skills?limit=100"),
          apiGet<{ skills: ApiSkill[] }>("/skills/mine"),
          apiGet<{ requests: ApiRequest[] }>("/requests?limit=100"),
          apiGet<{ sessions: ApiSession[] }>("/sessions?limit=100"),
          apiGet<{ balance: number; transactions: ApiTransaction[] }>("/wallet?limit=100"),
          apiGet<{ notifications: ApiNotification[] }>("/notifications?limit=100"),
        ]);
        if (!active || profile.user._id !== userId) return;
        const skills = [...new Map([
          ...skillResponse.skills.map((skill) => mapApiSkill(skill)),
          ...mineResponse.skills.map((skill) => mapApiSkill(skill, profile.user)),
        ].map((skill) => [skill.id, skill])).values()];
        setData((current) => current.user?.id !== userId ? current : ({
          ...current,
          user: mapApiUser(profile.user),
          skills,
          requests: requestResponse.requests.map((request) => mapApiRequest(request, profile.user)),
          sessions: sessionResponse.sessions.map((session) => mapApiSession(session, profile.user, skills)),
          credits: walletResponse.balance,
          transactions: walletResponse.transactions.map(mapApiTransaction),
          activities: notificationResponse.notifications.map(mapApiNotification),
        }));
        errorNotified = false;
      } catch (error) {
        if (!active) return;
        console.error("Could not refresh SkillBridge API data:", error);
        if (!errorNotified) {
          toast.error(error instanceof Error ? error.message : "Could not refresh SkillBridge API data.");
          errorNotified = true;
        }
      } finally {
        refreshing = false;
      }
    };
    const interval = window.setInterval(() => { void refreshWorkspace(); }, 30_000);
    const onFocus = () => { void refreshWorkspace(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [data.user?.id]);

  const setTheme = useCallback((theme: "dark" | "light") => setData((current) => ({ ...current, theme })), []);
  const login = useCallback((email: string) => {
    if (apiConfigured) throw new Error("Demo sign-in is disabled while the API is configured.");
    clearApiToken();
    setData((current) => ({ ...current, user: { ...demoUser, role: email === "admin@skillbridge.ai" ? "admin" : "student", email: email || demoUser.email } }));
  }, []);
  const loginApiUser = useCallback((user: ApiUser) => {
    const profile = mapApiUser(user);
    setApiLoading(true);
    setData((current) => ({ ...current, user: profile, skills: [], requests: [], sessions: [], activities: [], transactions: [], credits: user.walletBalance ?? 0 }));
  }, []);
  const register = useCallback((name: string, email: string, profile?: Partial<Student>) => {
    if (apiConfigured) throw new Error("Create your account using the API registration form.");
    clearApiToken();
    const first = name.trim().split(/\s+/)[0] || "Student";
    setData((current) => ({ ...current, user: { ...demoUser, ...profile, role: "student", name: name.trim(), email, avatar: `${first[0]}${name.trim().split(/\s+/)[1]?.[0] ?? ""}`.toUpperCase(), bio: "New to SkillBridge and excited to learn together." } }));
  }, []);
  const logout = useCallback(() => {
    clearApiToken();
    if (apiConfigured) {
      setApiLoading(true);
      setData((current) => ({ ...current, user: null, skills: [], requests: [], sessions: [], activities: [], transactions: [], credits: 0 }));
      return;
    }
    setData((current) => ({ ...current, user: null }));
  }, []);
  const updateProfile = useCallback(async (profile: Student) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before updating your profile.");
    if (token) {
      const body = { name: profile.name, bio: profile.bio, location: profile.college, college: profile.college, department: profile.department, year: profile.year, availability: profile.availability, interests: profile.interests, skillsOfferedText: profile.skillsOffered, skillsWantedText: profile.skillsWanted, ...(profile.avatar.startsWith("http") ? { avatarUrl: profile.avatar } : {}) };
      const response = await apiPatch<{ user: ApiUser }>("/auth/me", body);
      setData((current) => ({ ...current, user: { ...profile, id: response.user._id } }));
      return;
    }
    setData((current) => ({ ...current, user: profile }));
  }, []);
  const addSkill = useCallback(async (skill: Omit<Skill, "id" | "owner" | "college" | "avatar" | "rating">) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before publishing a listing.");
    if (token) {
      const level = ["beginner", "intermediate", "advanced"].includes(skill.level.toLowerCase()) ? skill.level.toLowerCase() : "intermediate";
      const response = await apiPost<{ skill: ApiSkill }>("/skills", { title: skill.title, category: skill.category, description: skill.description, tags: skill.tags, level, type: "offer", mode: "online", availability: skill.availability, credits: skill.credits });
      setData((current) => ({
        ...current,
        skills: [{ ...mapApiSkill(response.skill), owner: current.user?.name ?? "You", college: current.user?.college ?? "Your college", avatar: current.user?.avatar ?? "ME", rating: 0 }, ...current.skills],
        activities: [{ id: `a${Date.now()}`, title: "New skill listed", detail: skill.title, date: "Just now", tone: "violet" }, ...current.activities],
      }));
      return;
    }
    setData((current) => ({
      ...current,
      skills: [{ ...skill, id: `s${Date.now()}`, owner: current.user?.name ?? "You", college: current.user?.college ?? "Your college", avatar: current.user?.avatar ?? "ME", rating: 5 }, ...current.skills],
      activities: [{ id: `a${Date.now()}`, title: "New skill listed", detail: skill.title, date: "Just now", tone: "violet" }, ...current.activities],
    }));
  }, []);
  const updateSkill = useCallback(async (id: string, updates: Pick<Skill, "title" | "description" | "category" | "level" | "tags">) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before updating a listing.");
    if (token) {
      const level = ["beginner", "intermediate", "advanced", "expert"].includes(updates.level.toLowerCase()) ? updates.level.toLowerCase() : "intermediate";
      await apiPatch<{ skill: ApiSkill }>(`/skills/${encodeURIComponent(id)}`, { ...updates, level });
    }
    setData((current) => ({ ...current, skills: current.skills.map((skill) => skill.id === id ? { ...skill, ...updates } : skill) }));
  }, []);
  const deleteSkill = useCallback(async (id: string) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before removing a listing.");
    if (token) await apiDelete<{ message: string }>(`/skills/${encodeURIComponent(id)}`);
    setData((current) => ({ ...current, skills: current.skills.filter((skill) => skill.id !== id) }));
  }, []);
  const searchSkills = useCallback(async (query: string, category: string, level: string, availability: string) => {
    if (!apiConfigured) return [];
    const params = new URLSearchParams({ limit: "100", type: "offer" });
    if (query.trim()) params.set("q", query.trim());
    if (category !== "All skills") params.set("category", category);
    if (level !== "Any level" && level !== "All levels") params.set("level", level.toLowerCase());
    if (availability !== "Any schedule") params.set("availability", availability);
    const response = await apiGet<{ skills: ApiSkill[] }>(`/skills?${params.toString()}`);
    return response.skills.map((skill) => mapApiSkill(skill));
  }, []);
  const getSkill = useCallback(async (id: string) => {
    const response = await apiGet<{ skill: ApiSkill }>(`/skills/${encodeURIComponent(id)}`);
    return mapApiSkill(response.skill);
  }, []);
  const getMatches = useCallback(async () => {
    const token = getApiToken();
    if (!apiConfigured || !token) return [];
    const currentUser = data.user;
    if (!currentUser) throw new Error("Your signed-in profile could not be verified. Please sign in again.");
    const query = [...currentUser.skillsWanted, ...currentUser.interests, ...currentUser.skillsOffered].join(" ").trim();
    if (!query) return [];
    const response = await apiGet<{ matches: ApiMatch[] }>(`/matches?q=${encodeURIComponent(query)}`);
    return response.matches.map((match) => ({
      skill: mapApiSkill(match.skill),
      score: match.score,
      reason: match.explanation.map((factor) => factor.reason).join(" · ") || "Relevant to your learning profile",
    }));
  }, [data.user]);
  const sendRequest = useCallback(async (skill: Skill) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before requesting an exchange.");
    if (token) {
      const response = await apiPost<{ request: ApiRequest }>("/requests", { skillId: skill.id });
      setData((current) => ({
        ...current,
        requests: [{ id: response.request._id, skill: skill.title, skillId: skill.id, person: skill.owner, direction: "outgoing", status: "Pending", date: "Just now" }, ...current.requests],
        activities: [{ id: `a${Date.now()}`, title: "Request sent", detail: `You reached out to ${skill.owner}.`, date: "Just now", tone: "cyan" }, ...current.activities],
      }));
      return;
    }
    setData((current) => {
      if (current.requests.some((request) => (request.skillId ? request.skillId === skill.id : request.skill === skill.title) && request.status === "Pending")) return current;
      return {
        ...current,
        requests: [{ id: `r${Date.now()}`, skill: skill.title, skillId: skill.id, person: skill.owner, direction: "outgoing", status: "Pending", date: "Just now" }, ...current.requests],
        activities: [{ id: `a${Date.now()}`, title: "Request sent", detail: `You reached out to ${skill.owner}.`, date: "Just now", tone: "cyan" }, ...current.activities],
      };
    });
  }, []);
  const updateRequest = useCallback(async (id: string, status: ExchangeRequest["status"]) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before updating a request.");
    if (token) {
      const apiStatus = status === "Accepted" ? "accepted" : status === "Declined" ? "rejected" : status === "Cancelled" ? "cancelled" : null;
      if (!apiStatus) throw new Error("This request status cannot be changed.");
      await apiPatch<{ request: ApiRequest }>(`/requests/${encodeURIComponent(id)}/status`, { status: apiStatus });
    }
    setData((current) => ({ ...current, requests: current.requests.map((request) => request.id === id ? { ...request, status } : request) }));
  }, []);
  const confirmSession = useCallback(async (id: string) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before confirming a session.");
    if (token) {
      const response = await apiPost<{ session: ApiSession }>(`/sessions/${encodeURIComponent(id)}/confirm-completion`, {});
      if (response.session.status === "completed") {
        const wallet = await apiGet<{ balance: number; transactions: ApiTransaction[] }>("/wallet?limit=100");
        setData((current) => ({
          ...current,
          credits: wallet.balance,
          transactions: wallet.transactions.map(mapApiTransaction),
          sessions: current.sessions.map((session) => session.id === id ? { ...session, status: "Completed" } : session),
          requests: current.requests.map((request) => request.id === response.session.requestId ? { ...request, status: "Completed" } : request),
        }));
      } else {
        setData((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, status: "Awaiting confirmation" } : session) }));
      }
      return;
    }
    setData((current) => {
      const session = current.sessions.find((item) => item.id === id);
      if (!session || session.status !== "Upcoming" || current.credits < 2) return current;
      return {
        ...current,
        sessions: current.sessions.map((item) => item.id === id ? { ...item, status: "Awaiting confirmation" } : item),
      };
    });
  }, []);
  const confirmPartner = useCallback((id: string) => {
    if (apiConfigured) return;
    setData((current) => {
      const session = current.sessions.find((item) => item.id === id);
      if (!session || session.status !== "Awaiting confirmation") return current;
      const now = Date.now();
      return {
        ...current,
        sessions: current.sessions.map((item) => item.id === id ? { ...item, status: "Completed" } : item),
        credits: current.credits - 2,
        transactions: [{ id: `w${now}`, title: `Session with ${session.person}`, detail: session.title, amount: 2, date: "Just now", direction: "spent" }, ...current.transactions],
        activities: [{ id: `a${now}`, title: "Session completed", detail: "Both learners confirmed. 2 credits transferred.", date: "Just now", tone: "cyan" }, ...current.activities],
      };
    });
  }, []);
  const cancelSession = useCallback(async (id: string) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before cancelling a session.");
    const response = token ? await apiPost<{ session: ApiSession }>(`/sessions/${encodeURIComponent(id)}/cancel`, {}) : undefined;
    setData((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === id ? { ...session, status: "Cancelled" } : session),
      requests: response?.session.requestId
        ? current.requests.map((request) => request.id === response.session.requestId ? { ...request, status: "Cancelled" } : request)
        : current.requests,
    }));
  }, []);
  const reportSession = useCallback(async (id: string, reason: string) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before reporting a session.");
    if (token) await apiPost<{ dispute: { _id: string } }>(`/sessions/${encodeURIComponent(id)}/dispute`, { reason });
    setData((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === id ? { ...session, status: "Disputed" } : session),
      activities: [{ id: `a${Date.now()}`, title: "Session dispute opened", detail: "The SkillBridge team will help resolve this fairly.", date: "Just now", tone: "pink" }, ...current.activities],
    }));
  }, []);
  const scheduleSession = useCallback(async (session: Omit<LearningSession, "id" | "status" | "credits"> & { requestId?: string; scheduledAt?: string; durationMinutes?: number; credits?: number }) => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before scheduling a session.");
    if (token) {
      if (!session.requestId || !session.scheduledAt) throw new Error("Choose an accepted exchange request before scheduling a session.");
      const response = await apiPost<{ session: ApiSession }>("/sessions", { requestId: session.requestId, scheduledAt: session.scheduledAt, durationMinutes: session.durationMinutes ?? 60, mode: "online", meetingUrl: session.meetingLink });
      const currentUser = data.user;
      if (!currentUser?.id) throw new Error("Your signed-in profile could not be verified. Please sign in again.");
      setData((current) => ({ ...current, sessions: [mapApiSession(response.session, { _id: currentUser.id!, name: currentUser.name, email: currentUser.email, role: currentUser.role === "admin" ? "admin" : "user" }, current.skills), ...current.sessions] }));
      return;
    }
    setData((current) => ({ ...current, sessions: [{ ...session, id: `l${Date.now()}`, credits: session.credits ?? 2, status: "Upcoming" }, ...current.sessions] }));
  }, [data.user]);
  const toggleSaved = useCallback((id: string) => setData((current) => ({
    ...current,
    savedSkills: current.savedSkills.includes(id) ? current.savedSkills.filter((saved) => saved !== id) : [...current.savedSkills, id],
  })), []);
  const markNotificationsRead = useCallback(async () => {
    const token = getApiToken();
    if (apiConfigured && !token) throw new Error("Please sign in again before updating notifications.");
    if (token) await apiPost<{ updated: number }>("/notifications/read-all", {});
    setData((current) => ({ ...current, activities: current.activities.map((activity) => ({ ...activity, read: true })) }));
  }, []);

  const value = useMemo(() => ({ ...data, apiLoading, setTheme, login, loginApiUser, register, logout, updateProfile, addSkill, updateSkill, deleteSkill, searchSkills, getSkill, getMatches, sendRequest, updateRequest, confirmSession, confirmPartner, cancelSession, reportSession, scheduleSession, toggleSaved, markNotificationsRead }), [data, apiLoading, setTheme, login, loginApiUser, register, logout, updateProfile, addSkill, updateSkill, deleteSkill, searchSkills, getSkill, getMatches, sendRequest, updateRequest, confirmSession, confirmPartner, cancelSession, reportSession, scheduleSession, toggleSaved, markNotificationsRead]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
