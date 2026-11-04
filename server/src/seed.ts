import { supabase } from "./config/database";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { hashPassword } from "./utils/auth";
import { throwDatabaseError, type DbRow } from "./services/database";

async function seed() {
  await connectDatabase();
  const fixtures = [
    { name: "SkillBridge Admin", email: "admin@skillbridge.demo", password: env.seedAdminPassword, role: "admin", bio: "Platform administrator", location: "Online" },
    { name: "Avery Chen", email: "avery@skillbridge.demo", password: "AveryDemo123!", role: "user", bio: "Product designer who enjoys helping people get started with design tools.", location: "Toronto" },
    { name: "Jordan Lee", email: "jordan@skillbridge.demo", password: "JordanDemo123!", role: "user", bio: "Frontend developer and patient mentor, specializing in accessible web apps.", location: "Toronto" },
  ];
  const users: Record<string, DbRow> = {};
  for (const fixture of fixtures) {
    const { data: existing, error: existingError } = await supabase.from("users").select("*").eq("email", fixture.email).maybeSingle();
    if (existingError) throwDatabaseError(existingError);
    if (existing) {
      users[fixture.email] = existing as DbRow;
      continue;
    }
    const { data, error } = await supabase.from("users").insert({
      name: fixture.name,
      email: fixture.email,
      password_hash: await hashPassword(fixture.password),
      role: fixture.role,
      bio: fixture.bio,
      location: fixture.location,
      college: fixture.location,
    }).select("*").single();
    if (error) throwDatabaseError(error);
    users[fixture.email] = data as DbRow;
  }
  const listings = [
    { owner: users["avery@skillbridge.demo"], title: "Figma interface design", description: "Learn to create clean interface layouts and clickable prototypes in Figma, from wireframes to handoff.", category: "Design", tags: ["figma", "ui", "prototyping"], level: "intermediate", type: "offer", mode: "online" },
    { owner: users["jordan@skillbridge.demo"], title: "Accessible React development", description: "Build accessible React components with keyboard support, semantic HTML, and practical testing tips.", category: "Programming", tags: ["react", "javascript", "accessibility"], level: "advanced", type: "offer", mode: "either" },
    { owner: users["avery@skillbridge.demo"], title: "Learn JavaScript fundamentals", description: "Looking for a peer to help me practice JavaScript and understand async programming.", category: "Programming", tags: ["javascript", "async"], level: "beginner", type: "request", mode: "online" },
  ];
  for (const fixture of listings) {
    const { data: existing, error: existingError } = await supabase.from("skills").select("id")
      .eq("owner_id", fixture.owner.id).eq("title", fixture.title).maybeSingle();
    if (existingError) throwDatabaseError(existingError);
    if (existing) continue;
    const { error } = await supabase.from("skills").insert({
      owner_id: fixture.owner.id,
      title: fixture.title,
      description: fixture.description,
      category: fixture.category,
      tags: fixture.tags,
      level: fixture.level,
      type: fixture.type,
      mode: fixture.mode,
      location: String(fixture.owner.location ?? ""),
      credits: 2,
    });
    if (error) throwDatabaseError(error);
  }
  console.info("Demo data ready.");
  console.info("Admin: admin@skillbridge.demo / password from SEED_ADMIN_PASSWORD");
  console.info("Demo users: avery@skillbridge.demo and jordan@skillbridge.demo (passwords in the documentation)");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
}).finally(disconnectDatabase);
