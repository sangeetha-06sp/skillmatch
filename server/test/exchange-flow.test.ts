import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { connectDatabase, disconnectDatabase, supabase } from "../src/config/database";
import { env } from "../src/config/env";
import { throwDatabaseError } from "../src/services/database";

const liveSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
const emailSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
const userIds: string[] = [];
const skillIds: string[] = [];
const requestIds: string[] = [];
const sessionIds: string[] = [];
const waitlistEmails: string[] = [];

async function createAccount(name: string, localPart: string) {
  const email = `${localPart}-${emailSuffix}`;
  const password = "IntegrationPass123!";
  const response = await request(app).post("/api/auth/register").send({ name, email, password }).expect(201);
  userIds.push(response.body.user._id);
  expect(response.body.user.passwordHash).toBeUndefined();
  expect(response.body.user.tokenVersion).toBeUndefined();
  const login = await request(app).post("/api/auth/login").send({ email, password }).expect(200);
  expect(login.body.user._id).toBe(response.body.user._id);
  return { id: response.body.user._id as string, token: login.body.token as string, email };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function createRequest(learnerToken: string, skillId: string, providerToken: string) {
  const created = await request(app).post("/api/requests").set(auth(learnerToken)).send({ skillId }).expect(201);
  requestIds.push(created.body.request._id);
  await request(app).patch(`/api/requests/${created.body.request._id}/status`).set(auth(providerToken)).send({ status: "accepted" }).expect(200);
  return created.body.request._id as string;
}

async function createSession(token: string, requestId: string) {
  const created = await request(app).post("/api/sessions").set(auth(token)).send({
    requestId,
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    durationMinutes: 60,
    mode: "online",
    meetingUrl: "https://meet.jit.si/skillmatch-integration-test",
  }).expect(201);
  sessionIds.push(created.body.session._id);
  return created.body.session._id as string;
}

beforeAll(async () => {
  if (liveSupabaseConfigured) await connectDatabase();
});

afterAll(async () => {
  if (liveSupabaseConfigured) {
    if (userIds.length) {
      const { error: notificationsError } = await supabase.from("notifications").delete().in("user_id", userIds);
      if (notificationsError) throwDatabaseError(notificationsError);
      const { error: transactionsError } = await supabase.from("wallet_transactions").delete().in("user_id", userIds);
      if (transactionsError) throwDatabaseError(transactionsError);
      if (sessionIds.length) {
        const { error: disputesError } = await supabase.from("disputes").delete().in("session_id", sessionIds);
        if (disputesError) throwDatabaseError(disputesError);
        const { error: sessionTransactionsError } = await supabase.from("wallet_transactions").delete().in("session_id", sessionIds);
        if (sessionTransactionsError) throwDatabaseError(sessionTransactionsError);
        const { error: sessionsError } = await supabase.from("sessions").delete().in("id", sessionIds);
        if (sessionsError) throwDatabaseError(sessionsError);
      }
      if (requestIds.length) {
        const { error } = await supabase.from("exchange_requests").delete().in("id", requestIds);
        if (error) throwDatabaseError(error);
      }
      if (skillIds.length) {
        const { error } = await supabase.from("skills").delete().in("id", skillIds);
        if (error) throwDatabaseError(error);
      }
      const { error: walletsError } = await supabase.from("wallets").delete().in("user_id", userIds);
      if (walletsError) throwDatabaseError(walletsError);
      const { error: usersError } = await supabase.from("users").delete().in("id", userIds);
      if (usersError) throwDatabaseError(usersError);
    }
    if (waitlistEmails.length) {
      const { error } = await supabase.from("waitlists").delete().in("email", waitlistEmails);
      if (error) throwDatabaseError(error);
    }
  }
  await disconnectDatabase();
});

describe.skipIf(!liveSupabaseConfigured)("Supabase-backed exchange lifecycle", () => {
  it("registers and logs in, manages skills, searches/recommends, exchanges, settles credits atomically, cancels, disputes, and returns history", async () => {
    const provider = await createAccount("Integration Provider", "provider");
    const learner = await createAccount("Integration Learner", "learner");
    const password = "IntegrationPass123!";
    const login = await request(app).post("/api/auth/login").send({ email: provider.email, password }).expect(200);
    expect(login.body.token).toBeTruthy();

    const skillResponse = await request(app).post("/api/skills").set(auth(provider.token)).send({
      title: "Integration React mentoring",
      description: "Learn to build dependable React interfaces and understand practical component architecture.",
      category: "Programming",
      tags: ["react", "testing"],
      type: "offer",
      level: "advanced",
      availability: "Weekends",
      credits: 4,
    }).expect(201);
    const skillId = skillResponse.body.skill._id as string;
    skillIds.push(skillId);

    const search = await request(app).get("/api/skills?q=Integration%20React&availability=Weekends").expect(200);
    expect(search.body.skills.some((skill: { _id: string }) => skill._id === skillId)).toBe(true);
    const matches = await request(app).get("/api/matches?q=React").set(auth(learner.token)).expect(200);
    expect(matches.body.matches[0].skill._id).toBe(skillId);
    expect(matches.body.matches[0].explanation.length).toBeGreaterThan(0);

    await request(app).patch(`/api/skills/${skillId}`).set(auth(provider.token))
      .send({ title: "Updated integration React mentoring" }).expect(200);
    await request(app).get(`/api/skills/${skillId}`).expect(200);

    const pendingRequest = await request(app).post("/api/requests").set(auth(learner.token)).send({ skillId }).expect(201);
    requestIds.push(pendingRequest.body.request._id);
    const cancelledRequest = await request(app).patch(`/api/requests/${pendingRequest.body.request._id}/status`)
      .set(auth(learner.token)).send({ status: "cancelled" }).expect(200);
    expect(cancelledRequest.body.request.status).toBe("cancelled");

    const { error: walletError } = await supabase.from("wallets").update({ balance: 50 }).eq("user_id", learner.id);
    if (walletError) throwDatabaseError(walletError);
    const { error: openingLedgerError } = await supabase.from("wallet_transactions").insert({
      user_id: learner.id,
      amount: 50,
      direction: "credit",
      reason: "seed",
      idempotency_key: `integration:${learner.id}`,
      description: "Integration test opening credits",
    });
    if (openingLedgerError) throwDatabaseError(openingLedgerError);

    const completionRequest = await createRequest(learner.token, skillId, provider.token);
    const completionSession = await createSession(learner.token, completionRequest);
    await request(app).post(`/api/sessions/${completionSession}/confirm-completion`).set(auth(learner.token)).send({}).expect(200);
    const completed = await request(app).post(`/api/sessions/${completionSession}/confirm-completion`).set(auth(provider.token)).send({}).expect(200);
    expect(completed.body.session.status).toBe("completed");
    await request(app).post(`/api/sessions/${completionSession}/confirm-completion`).set(auth(provider.token)).send({}).expect(200);
    const wallet = await request(app).get("/api/wallet").set(auth(learner.token)).expect(200);
    expect(wallet.body.balance).toBe(46);
    const settlementKey = `session:${completionSession}`;
    const { data: ledger, error: ledgerError } = await supabase.from("wallet_transactions")
      .select("direction").eq("idempotency_key", settlementKey);
    if (ledgerError) throwDatabaseError(ledgerError);
    expect(ledger?.map((row) => row.direction).sort()).toEqual(["credit", "debit"]);

    const cancelRequest = await createRequest(learner.token, skillId, provider.token);
    const cancelledSession = await createSession(learner.token, cancelRequest);
    const cancelled = await request(app).post(`/api/sessions/${cancelledSession}/cancel`).set(auth(learner.token)).send({}).expect(200);
    expect(cancelled.body.session.status).toBe("cancelled");

    const lowBalanceLearner = await createAccount("Low Balance Learner", "low-balance");
    const lowBalanceRequest = await createRequest(lowBalanceLearner.token, skillId, provider.token);
    const lowBalanceSession = await createSession(lowBalanceLearner.token, lowBalanceRequest);
    await request(app).post(`/api/sessions/${lowBalanceSession}/confirm-completion`).set(auth(lowBalanceLearner.token)).send({}).expect(200);
    await request(app).post(`/api/sessions/${lowBalanceSession}/confirm-completion`).set(auth(provider.token)).send({}).expect(409);
    const lowBalanceWallet = await request(app).get("/api/wallet").set(auth(lowBalanceLearner.token)).expect(200);
    expect(lowBalanceWallet.body.balance).toBe(0);
    expect(lowBalanceWallet.body.balance).toBeGreaterThanOrEqual(0);

    const disputeRequest = await createRequest(learner.token, skillId, provider.token);
    const disputedSession = await createSession(learner.token, disputeRequest);
    const dispute = await request(app).post(`/api/sessions/${disputedSession}/dispute`).set(auth(learner.token))
      .send({ reason: "The meeting did not take place as scheduled." }).expect(201);
    expect(dispute.body.dispute.status).toBe("open");

    const requestHistory = await request(app).get("/api/requests?limit=100").set(auth(learner.token)).expect(200);
    expect(requestHistory.body.requests.map((entry: { _id: string }) => entry._id)).toEqual(expect.arrayContaining([completionRequest, cancelRequest, disputeRequest]));
    const sessionHistory = await request(app).get("/api/sessions?limit=100").set(auth(learner.token)).expect(200);
    expect(sessionHistory.body.sessions.map((entry: { status: string }) => entry.status)).toEqual(expect.arrayContaining(["completed", "cancelled", "disputed"]));
    const disputes = await request(app).get("/api/disputes").set(auth(learner.token)).expect(200);
    expect(disputes.body.disputes.some((entry: { _id: string }) => entry._id === dispute.body.dispute._id)).toBe(true);

    const waitlistEmail = `waitlist-${emailSuffix}`;
    waitlistEmails.push(waitlistEmail);
    await request(app).post("/api/waitlist").send({ email: waitlistEmail, interests: ["React"] }).expect(201);
    await request(app).post("/api/waitlist").send({ email: waitlistEmail }).expect(409);

    const extra = await request(app).post("/api/skills").set(auth(provider.token)).send({
      title: "Temporary integration listing",
      description: "A temporary listing used to verify soft deletion behavior.",
      category: "Programming",
      credits: 1,
    }).expect(201);
    skillIds.push(extra.body.skill._id);
    await request(app).delete(`/api/skills/${extra.body.skill._id}`).set(auth(provider.token)).expect(200);
    await request(app).get(`/api/skills/${extra.body.skill._id}`).expect(404);
  });
});
