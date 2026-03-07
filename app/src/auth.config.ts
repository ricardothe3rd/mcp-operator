import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-compatible config — no Node.js modules (fs, path, crypto)
// Used by middleware to check sessions without touching the DB
export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: {
    signIn: "/auth/signin",
  },
};
