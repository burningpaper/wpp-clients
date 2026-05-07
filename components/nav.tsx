"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2, Upload, Search, LogOut, CalendarDays, ShieldCheck, Database } from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/organisations", label: "Organisations", icon: Building2 },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/import", label: "Import", icon: Upload },
];

type NavProps = {
  userName?: string | null;
  agencyName?: string | null;
  role: string;
};

export function Nav({ userName, agencyName, role }: NavProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-gray-950 border-r border-gray-800 flex flex-col z-10">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">
            WPP Intelligence
          </span>
        </div>
      </div>

      {/* Search shortcut */}
      <div className="px-3 py-3 border-b border-gray-800">
        <Link
          href="/contacts"
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors group"
        >
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400 text-xs">Search contacts…</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {role === "system_admin" && (
          <>
            <div className="h-px bg-gray-800 my-1.5" />
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                pathname === "/admin/users"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Users
            </Link>
            <Link
              href="/admin/organisations"
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                pathname === "/admin/organisations"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <Database className="w-4 h-4 shrink-0" />
              Org data
            </Link>
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-gray-800">
        <div className="px-2.5 py-2">
          <p className="text-white text-xs font-medium truncate">{userName}</p>
          <p className="text-gray-500 text-xs truncate">
            {agencyName ?? "No agency"} · {role.replace("_", " ")}
          </p>
        </div>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors rounded-md hover:bg-gray-800 mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
