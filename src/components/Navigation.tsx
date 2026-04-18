"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  GitCompare,
  Home,
  ShieldCheck,
  LogOut,
  User,
  ChevronDown,
  Activity,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home, authed: true },
    { href: "/compare", label: "Compare", icon: GitCompare, adminOnly: true },
    { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
    { href: "/admin/logs", label: "Logs", icon: Activity, adminOnly: true },
  ] as const;

  const visibleLinks = navLinks.filter((link) => {
    if ("adminOnly" in link && link.adminOnly) return user?.role === "admin";
    if ("authed" in link && link.authed) return !!user;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href={user ? "/" : "/login"} className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 ring-1 ring-cyan-200 group-hover:bg-cyan-100 transition-colors">
            <Calculator className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">
            Smart Pricing Sheet
          </span>
        </Link>

        {/* Nav links + user */}
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          {user && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">
                  {user.fullName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                    <div className="border-b border-gray-100 px-4 py-2.5">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                      <span
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                          user.role === "admin"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-cyan-50 text-cyan-700"
                        )}
                      >
                        {user.role === "admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {user.role}
                      </span>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-cyan-600 transition-colors"
                    >
                      <UserCog className="h-4 w-4" />
                      Profile settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-rose-600 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sign in link when not logged in */}
          {!user && pathname !== "/login" && (
            <Link
              href="/login"
              className="ml-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
