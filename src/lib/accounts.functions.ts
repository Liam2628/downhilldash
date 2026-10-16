import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Players sign in with a username. Accounts without a real email get a private
// placeholder address that never receives mail.
const PLACEHOLDER_DOMAIN = "players.downhilldash.app";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3–20 letters, numbers or _");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function emailForUsername(username: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (!data) return null;
  const { data: u } = await db.auth.admin.getUserById(data.id);
  return u.user?.email ?? null;
}

async function passwordLogin(email: string, password: string) {
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return { error: "Wrong username or password" as string };
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export const signUpPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: usernameSchema, password: passwordSchema, email: z.string().trim().email().max(255).optional().or(z.literal("")) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: taken } = await db.from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (taken) return { error: "That username is taken" };
    const email = data.email ? data.email.toLowerCase() : `${data.username}@${PLACEHOLDER_DOMAIN}`;
    const { error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error) return { error: /already/i.test(error.message) ? "That email is already used by another account" : "Couldn't create the account" };
    return passwordLogin(email, data.password);
  });

export const signInPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ username: z.string().trim().toLowerCase().min(1).max(255), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.username.includes("@") ? data.username : await emailForUsername(data.username);
    if (!email) return { error: "Wrong username or password" };
    return passwordLogin(email, data.password);
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ username: z.string().trim().toLowerCase().min(1).max(255), origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.username.includes("@") ? data.username : await emailForUsername(data.username);
    // Same answer whether or not the account exists, so usernames can't be probed.
    const ok = { message: "If that account has an email, a reset link is on its way." };
    if (!email || email.endsWith(`@${PLACEHOLDER_DOMAIN}`)) return ok;
    const origin = new URL(data.origin).origin;
    await publicClient().auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` });
    return ok;
  });
