"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button className="quiet-action" type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      await getSupabaseBrowserClient().auth.signOut();
      window.location.assign("/");
    }}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
