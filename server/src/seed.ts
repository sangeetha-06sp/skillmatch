import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { Skill } from "./models/Skill";
import { User } from "./models/User";
import { WalletTransaction } from "./models/WalletTransaction";
import { hashPassword } from "./utils/auth";

async function seed() {
  await connectDatabase();
  const fixtures = [
    { name: "SkillBridge Admin", email: "admin@skillbridge.demo", password: env.seedAdminPassword, role: "admin" as const, bio: "Platform administrator", location: "Online", walletBalance: 0 },
    { name: "Avery Chen", email: "avery@skillbridge.demo", password: "AveryDemo123!", role: "user" as const, bio: "Product designer who enjoys helping people get started with design tools.", location: "Toronto", walletBalance: 100 },
    { name: "Jordan Lee", email: "jordan@skillbridge.demo", password: "JordanDemo123!", role: "user" as const, bio: "Frontend developer and patient mentor, specializing in accessible web apps.", location: "Toronto", walletBalance: 100 },
  ];
  const users: Record<string, InstanceType<typeof User>> = {};
  for (const fixture of fixtures) {
    const user = await User.findOne({ email: fixture.email });
    users[fixture.email] = user ?? await User.create({
      name: fixture.name,
      email: fixture.email,
      passwordHash: await hashPassword(fixture.password),
      role: fixture.role,
      bio: fixture.bio,
      location: fixture.location,
      walletBalance: fixture.walletBalance,
    });
    if (fixture.walletBalance > 0) {
      await WalletTransaction.updateOne(
        { idempotencyKey: `seed:${fixture.email}`, direction: "credit" },
        { $setOnInsert: { user: users[fixture.email]._id, amount: fixture.walletBalance, direction: "credit", reason: "seed", idempotencyKey: `seed:${fixture.email}`, description: "Demo account opening balance" } },
        { upsert: true },
      );
    }
  }
  const listings = [
    { owner: users["avery@skillbridge.demo"], title: "Figma interface design", description: "Learn to create clean interface layouts and clickable prototypes in Figma, from wireframes to handoff.", category: "Design", tags: ["figma", "ui", "prototyping"], level: "intermediate" as const, type: "offer" as const, mode: "online" as const },
    { owner: users["jordan@skillbridge.demo"], title: "Accessible React development", description: "Build accessible React components with keyboard support, semantic HTML, and practical testing tips.", category: "Programming", tags: ["react", "javascript", "accessibility"], level: "advanced" as const, type: "offer" as const, mode: "either" as const },
    { owner: users["avery@skillbridge.demo"], title: "Learn JavaScript fundamentals", description: "Looking for a peer to help me practice JavaScript and understand async programming.", category: "Programming", tags: ["javascript", "async"], level: "beginner" as const, type: "request" as const, mode: "online" as const },
  ];
  for (const fixture of listings) {
    let skill = await Skill.findOne({ owner: fixture.owner._id, title: fixture.title });
    if (!skill) skill = await Skill.create(fixture);
    const field = skill.type === "offer" ? "skillsOffered" : "skillsWanted";
    await User.updateOne({ _id: skill.owner }, { $addToSet: { [field]: skill._id } });
  }
  console.info("Demo data ready.");
  console.info("Admin: admin@skillbridge.demo / password from SEED_ADMIN_PASSWORD");
  console.info("Demo users: avery@skillbridge.demo / AveryDemo123! and jordan@skillbridge.demo / JordanDemo123!");
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await disconnectDatabase();
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
});
