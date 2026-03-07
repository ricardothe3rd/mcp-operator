import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyUser } from "@/lib/users";
import { authConfig } from "./auth.config";

// Full config — runs only in Node.js runtime (API routes, server components)
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await verifyUser(
          credentials.email as string,
          credentials.password as string
        );
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
});
