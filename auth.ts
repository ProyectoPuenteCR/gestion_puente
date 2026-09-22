import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { lookupPlatformAccess } from "@/lib/google-sheets";

const DEFAULT_ALLOWED_DOMAIN = "proyecto-puente.org";
const DEFAULT_ADMIN_EMAIL = "brechasdigitales@proyecto-puente.org";

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function allowedDomain() {
  return (process.env.AUTH_ALLOWED_DOMAIN ?? DEFAULT_ALLOWED_DOMAIN).trim().toLowerCase();
}

function adminEmails() {
  return new Set(
    (process.env.AUTH_ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAIL)
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

function emailBelongsToAllowedDomain(email?: string | null) {
  const normalized = normalizeEmail(email);
  const separator = normalized.lastIndexOf("@");
  return separator > 0 && normalized.slice(separator + 1) === allowedDomain();
}

export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    Google({
      authorization: {
        params: {
          hd: allowedDomain(),
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const googleProfile = profile as { email?: string | null; email_verified?: boolean } | undefined;
      if (googleProfile?.email_verified !== true || !emailBelongsToAllowedDomain(googleProfile.email)) return false;
      const access = await lookupPlatformAccess(googleProfile.email);
      return access?.active === true;
    },
    async jwt({ token, account }) {
      if (account || !token.role) {
        const access = await lookupPlatformAccess(token.email);
        token.role = access?.role ?? (adminEmails().has(normalizeEmail(token.email)) ? "admin" : "usuario");
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role === "admin" ? "admin" : token.role === "capacitador" ? "capacitador" : "usuario";
      }
      return session;
    },
  },
});
