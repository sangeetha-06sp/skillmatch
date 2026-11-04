import { app } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env, validateEnvironment } from "./config/env";

async function main() {
  validateEnvironment();
  await connectDatabase();
  const server = app.listen(env.port, () => console.info(`SkillBridge API listening on port ${env.port}`));
  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Unable to start SkillBridge API:", error);
  process.exitCode = 1;
});
