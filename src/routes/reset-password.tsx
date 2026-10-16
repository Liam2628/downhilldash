import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Reset password · Downhill Dash" },
      { name: "description", content: "Choose a new password for your Downhill Dash account." },
      { property: "og:title", content: "Reset password · Downhill Dash" },
      { property: "og:description", content: "Choose a new password for your Downhill Dash account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg("Password must be at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setMsg("This link has expired. Ask for a new one in the game.");
    navigate({ to: "/", replace: true });
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">New password</h1>
        <input type="password" className="w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <button className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">Save password</button>
      </form>
    </div>
  );
}
