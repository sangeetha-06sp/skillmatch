import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { Dispute } from "../src/models/Dispute";
import { ExchangeRequest } from "../src/models/ExchangeRequest";
import { Notification } from "../src/models/Notification";
import { Session } from "../src/models/Session";
import { Skill } from "../src/models/Skill";
import { User } from "../src/models/User";
import { WalletTransaction } from "../src/models/WalletTransaction";
import { Waitlist } from "../src/models/Waitlist";
import { signAccessToken } from "../src/utils/auth";
import { hashPassword } from "../src/utils/auth";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  await Promise.all([User, Skill, ExchangeRequest, Session, WalletTransaction, Notification, Waitlist, Dispute].map((model) => model.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("peer exchange lifecycle", () => {
  it("applies CORS, validates JSON, and rejects unauthenticated protected requests", async () => {
    const preflight = await request(app).options("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    await request(app).get("/api/requests").expect(401);
    const malformed = await request(app).post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send('{"name":')
      .expect(400);
    expect(malformed.body.error.code).toBe("INVALID_JSON");
  });

  it("registers, logs in, updates profiles, searches listings, and preserves data across reconnects", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Persistence Tester",
      email: "persist@example.com",
      password: "PersistentPass123!",
      college: "North Star University",
      department: "Computer Science",
    }).expect(201);
    const token = registration.body.token as string;
    const userId = registration.body.user._id as string;

    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    const login = await request(app).post("/api/auth/login").send({
      email: "persist@example.com",
      password: "PersistentPass123!",
    }).expect(200);
    expect(login.body.user._id).toBe(userId);

    const profile = await request(app).patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "I enjoy teaching accessible web development." })
      .expect(200);
    expect(profile.body.user.bio).toContain("accessible");

    const listing = await request(app).post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Accessible React mentoring",
        description: "Learn to build inclusive React interfaces and test common accessibility needs.",
        category: "Programming",
        tags: ["react", "accessibility"],
        type: "offer",
        level: "advanced",
        availability: "Weekends",
        credits: 4,
      }).expect(201);
    const search = await request(app).get("/api/skills?q=accessible&availability=Weekends&level=advanced").expect(200);
    expect(search.body.skills.map((skill: { _id: string }) => skill._id)).toContain(listing.body.skill._id);

    await mongoose.disconnect();
    await mongoose.connect(mongo.getUri());
    const persistedProfile = await request(app).get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`).expect(200);
    expect(persistedProfile.body.user._id).toBe(userId);
    const persistedSkill = await Skill.findById(listing.body.skill._id);
    expect(persistedSkill?.credits).toBe(4);
    expect(persistedSkill?.availability).toBe("Weekends");
  });

  it("returns an explicit unavailable response when the database is disconnected", async () => {
    await mongoose.disconnect();
    await request(app).get("/api/health").expect(503);
    await request(app).get("/api/skills").expect(503);
    await mongoose.connect(mongo.getUri());
  });

  it("revokes existing JWTs when a password changes", async () => {
    const signup = await request(app).post("/api/auth/register").send({
      name: "Password Tester", email: "password@example.com", password: "InitialPass123!",
    }).expect(201);
    const oldToken = signup.body.token as string;
    const changed = await request(app).patch("/api/auth/password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: "InitialPass123!", newPassword: "UpdatedPass123!" })
      .expect(200);
    expect(changed.body.token).toBeTruthy();
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`).expect(401);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${changed.body.token}`).expect(200);
    const login = await request(app).post("/api/auth/login").send({
      email: "password@example.com", password: "UpdatedPass123!",
    }).expect(200);
    expect(login.body.token).toBeTruthy();
  });

  it("limits administration to admins and handles waitlist signups", async () => {
    const signup = await request(app).post("/api/auth/register").send({
      name: "Regular User", email: "regular@example.com", password: "RegularPass123!",
    }).expect(201);
    await request(app).get("/api/admin/stats")
      .set("Authorization", `Bearer ${signup.body.token}`).expect(403);

    const admin = await User.create({
      name: "Admin", email: "admin@example.com", passwordHash: await hashPassword("AdminPass123!"), role: "admin",
    });
    await request(app).get("/api/admin/stats")
      .set("Authorization", `Bearer ${signAccessToken(admin)}`).expect(200);

    await request(app).post("/api/waitlist").send({ email: "waitlist@example.com", interests: ["design"] }).expect(201);
    await request(app).post("/api/waitlist").send({ email: "waitlist@example.com" }).expect(409);
  });

  it("authenticates, schedules an exchange, and settles a mutually confirmed payment once", async () => {
    const providerSignup = await request(app).post("/api/auth/register").send({
      name: "Skill Provider", email: "provider@example.com", password: "ProviderPass123!",
    }).expect(201);
    const learnerSignup = await request(app).post("/api/auth/register").send({
      name: "Skill Learner", email: "learner@example.com", password: "LearnerPass123!",
    }).expect(201);
    const providerToken = providerSignup.body.token as string;
    const learnerToken = learnerSignup.body.token as string;
    const providerId = providerSignup.body.user._id as string;
    const learnerId = learnerSignup.body.user._id as string;

    const skill = await request(app).post("/api/skills").set("Authorization", `Bearer ${providerToken}`).send({
      title: "React mentoring", description: "One-to-one mentoring on React components and application structure.",
      category: "Programming", tags: ["react"], type: "offer", credits: 25,
    }).expect(201);
    const matches = await request(app).get("/api/matches?q=react")
      .set("Authorization", `Bearer ${learnerToken}`).expect(200);
    expect(matches.body.matches[0].skill._id).toBe(skill.body.skill._id);
    expect(matches.body.matches[0].explanation.length).toBeGreaterThan(0);
    const exchange = await request(app).post("/api/requests").set("Authorization", `Bearer ${learnerToken}`).send({
      skillId: skill.body.skill._id, message: "I would like to learn about components.", paymentAmount: 1,
    }).expect(201);
    await request(app).patch(`/api/requests/${exchange.body.request._id}/status`)
      .set("Authorization", `Bearer ${providerToken}`).send({ status: "accepted" }).expect(200);
    const session = await request(app).post("/api/sessions").set("Authorization", `Bearer ${learnerToken}`).send({
      requestId: exchange.body.request._id, scheduledAt: new Date().toISOString(), durationMinutes: 45,
    }).expect(201);
    await User.updateOne({ _id: learnerId }, { $set: { walletBalance: 100 } });

    await request(app).post(`/api/sessions/${session.body.session._id}/confirm-completion`)
      .set("Authorization", `Bearer ${learnerToken}`).expect(200);
    await request(app).post(`/api/sessions/${session.body.session._id}/confirm-completion`)
      .set("Authorization", `Bearer ${providerToken}`).expect(200);
    await request(app).post(`/api/sessions/${session.body.session._id}/confirm-completion`)
      .set("Authorization", `Bearer ${providerToken}`).expect(200);

    const [learner, provider, completed, ledgerEntries] = await Promise.all([
      User.findById(learnerId), User.findById(providerId), Session.findById(session.body.session._id),
      WalletTransaction.find({ idempotencyKey: `session:${session.body.session._id}` }),
    ]);
    expect(completed?.status).toBe("completed");
    expect(learner?.walletBalance).toBe(75);
    expect(provider?.walletBalance).toBe(25);
    expect(ledgerEntries).toHaveLength(2);
    expect(await Notification.countDocuments({ user: providerId })).toBeGreaterThan(0);
    const learnerWallet = await request(app).get("/api/wallet")
      .set("Authorization", `Bearer ${learnerToken}`).expect(200);
    const providerWallet = await request(app).get("/api/wallet")
      .set("Authorization", `Bearer ${providerToken}`).expect(200);
    expect(learnerWallet.body.balance).toBe(75);
    expect(providerWallet.body.balance).toBe(25);
    expect(learnerWallet.body.transactions).toHaveLength(1);
    const completedSessions = await request(app).get("/api/sessions")
      .set("Authorization", `Bearer ${providerToken}`).expect(200);
    expect(completedSessions.body.sessions[0].status).toBe("completed");
    const completedRequests = await request(app).get("/api/requests")
      .set("Authorization", `Bearer ${learnerToken}`).expect(200);
    expect(completedRequests.body.requests[0].status).toBe("completed");
    const notifications = await request(app).get("/api/notifications")
      .set("Authorization", `Bearer ${providerToken}`).expect(200);
    expect(notifications.body.notifications.length).toBeGreaterThan(0);
  });
});
