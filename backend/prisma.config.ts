// MockMail.dev - Prisma Configuration
// This file configures Prisma for PostgreSQL with env-based connection

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://mockmail:mockmail_dev_2026@localhost:5432/mockmail",
  },
});
