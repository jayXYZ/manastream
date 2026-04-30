import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { Resend as ResendAPI } from "resend";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { initializeNewUserOverlays } from "./lib/overlays";

// Configure Resend provider for email verification with magic links
const ResendMagicLink = Resend({
  id: "resend-magic-link",
  apiKey: process.env.AUTH_RESEND_KEY,
  async sendVerificationRequest({ identifier: email, provider, token, url }) {
    const resend = new ResendAPI(provider.apiKey);
    // Construct our own URL pointing to the verification page
    // The 'url' param contains the origin, but we want to use our custom page
    const origin = new URL(url).origin;
    const magicLink = `${origin}/login/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const { error } = await resend.emails.send({
      from: "Duress Crew <email@verification.manastream.app>",
      to: [email],
      subject: `Sign in to Manastream`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Manastream</h2>
          <p>Click the button below to verify your email and complete your sign-in:</p>
          <a href="${magicLink}" 
             style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br/>
            <a href="${magicLink}" style="color: #0070f3; word-break: break-all;">${magicLink}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
      `,
      text: `Welcome to Manastream!\n\nClick this link to verify your email and complete your sign-in:\n\n${magicLink}\n\nIf you didn't request this email, you can safely ignore it.`,
    });

    if (error) {
      throw new Error(
        "Could not send verification email: " + JSON.stringify(error),
      );
    }
  },
});

// Configure Resend provider for password reset with magic links
const ResendPasswordReset = Resend({
  id: "resend-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  async sendVerificationRequest({ identifier: email, provider, token, url }) {
    const resend = new ResendAPI(provider.apiKey);
    // Construct our own URL pointing to the password reset confirmation page
    const origin = new URL(url).origin;
    const resetLink = `${origin}/login/reset-password/confirm?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const { error } = await resend.emails.send({
      from: "Duress Crew <email@verification.manastream.app>",
      to: [email],
      subject: `Reset your password - Manastream`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password for Manastream.</p>
          <p>Click the button below to set a new password:</p>
          <a href="${resetLink}" 
             style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #0070f3; word-break: break-all;">${resetLink}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Reset Your Password\n\nWe received a request to reset your password for Manastream.\n\nClick this link to set a new password:\n\n${resetLink}\n\nIf you didn't request a password reset, you can safely ignore this email.`,
    });

    if (error) {
      throw new Error(
        "Could not send password reset email: " + JSON.stringify(error),
      );
    }
  },
});

/**
 * Initialize a new user with default tournament and overlays.
 * This is called after user creation/update, but only initializes on first verification.
 */
async function initializeNewUser(ctx: MutationCtx, userId: Id<"users">) {
  // Check if user already has a tournament (already initialized)
  const existingTournament = await ctx.db
    .query("tournaments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existingTournament) {
    // User already initialized, skip
    return;
  }

  // Create default tournament for the new user
  const tournamentId = await ctx.db.insert("tournaments", {
    userId,
    mode: "manual",
    manualTimerRunning: false,
    manualTimerCountDirection: "down",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Initialize all default overlays and settings in a single transaction
  await initializeNewUserOverlays(ctx, tournamentId, userId);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      verify: ResendMagicLink,
      reset: ResendPasswordReset,
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx: MutationCtx, { userId, type }) {
      // For password auth flow, only initialize after email verification
      // The "verification" type indicates the user has verified their email
      // For OAuth (like Google), the type is "oauth" and we can initialize immediately
      if (type === "credentials") {
        // This is the initial password sign-up, but email not yet verified
        // Skip initialization until verification
        return;
      }

      // Initialize user on:
      // - "verification" type (email verified after password sign-up)
      // - "oauth" type (OAuth sign-in like Google)
      if (type === "verification" || type === "oauth") {
        await initializeNewUser(ctx, userId);
      }
    },
  },
});

export const getUserAvatar = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx: QueryCtx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // This should never happen?
      throw new Error("User not authenticated");
    }
    const user = await ctx.db.get(userId);
    return user?.image;
  },
});

export const getUserEmail = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx: QueryCtx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // This should never happen?
      throw new Error("User not authenticated");
    }
    const user = await ctx.db.get(userId);
    return user?.email;
  },
});
