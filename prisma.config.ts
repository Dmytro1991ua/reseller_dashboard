import * as dotenv from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Use an explicit absolute path so dotenv finds .env regardless of
// how Prisma's TypeScript loader sets the working directory on each platform.
dotenv.config({ path: resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
