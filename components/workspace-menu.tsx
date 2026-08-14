"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  ["Workspace", "/workspace"],
  ["Work", "/workspace/work"],
  ["Projects", "/workspace/projects"],
  ["Knowledge review", "/workspace/knowledge"],
  ["Documents", "/workspace/documents"],
  ["Upload", "/workspace/upload"],
  ["Companies", "/workspace#organization"],
  ["Relationships", "/workspace#relationships"],
  ["Assets", "/workspace/assets"],
  ["Goals & intentions", "/workspace/goals"],
  ["Accounts & apps", "/workspace/integrations"],
  ["Automations", "/workspace/automations"],
];

export function WorkspaceMenu() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`workspace-menu ${open ? "open" : ""}`}>
      <button className="workspace-menu-trigger" type="button" aria-expanded={open} aria-controls="workspace-global-menu" aria-label={open ? "Close PBS Central menu" : "Open PBS Central menu"} onClick={() => setOpen((current) => !current)}>
        <span /><span /><span />
      </button>
      {open && <button className="workspace-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside id="workspace-global-menu" aria-hidden={!open}>
        <div className="brand-lockup"><span>PBS</span><strong>CENTRAL</strong></div>
        <p className="eyebrow">Navigate</p>
        <nav>
          {links.map(([name, href]) => (
            <Link key={href} href={href} className={path === href.split("#")[0] ? "active" : ""} onClick={() => setOpen(false)} tabIndex={open ? undefined : -1}>
              {name}<span>→</span>
            </Link>
          ))}
        </nav>
        <Link className={`settings-gear ${path === "/workspace/settings" ? "active" : ""}`} href="/workspace/settings" aria-label="Open settings" onClick={() => setOpen(false)} tabIndex={open ? undefined : -1}>
          <span aria-hidden>⚙</span><strong>Settings</strong>
        </Link>
      </aside>
    </div>
  );
}
