"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <header
      className={cn(
        "sticky top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-screen-2xl px-0 transition-all duration-300"
      )}
    >
      <div
        className={cn(
          "glass-pill flex h-14 items-center justify-between rounded-full pl-4 pr-2",
          scrolled && "shadow-[0_16px_44px_rgba(6,182,212,0.12)]"
        )}
      >
        {/* Brand wordmark */}
        <Link
          href={user ? "/" : "/login"}
          className="group flex items-center gap-2.5"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            e<span className="gradient-text">Spark</span>
            <span className="ml-1.5 hidden text-xs font-medium text-gray-500 sm:inline">
              Pricing
            </span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={cn(
                  "group relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                  isActive
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                {isActive && (
                  <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500/90 to-cyan-500/90 shadow-[0_0_24px_rgba(99,102,241,0.4)]" />
                )}
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-3 text-sm font-medium text-gray-700 transition-all hover:border-indigo-500/60 hover:text-gray-900"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[110px] truncate sm:block">
                  {user.fullName}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-gray-400 transition-transform",
                    showUserMenu && "rotate-180"
                  )}
                />
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 py-1.5 shadow-2xl shadow-black/40">
                    <div className="border-b border-gray-200 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400 truncate">
                        @{user.username}
                      </p>
                      <span
                        className={cn(
                          "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-500"
                            : "bg-cyan-100 text-cyan-400"
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
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-cyan-400"
                    >
                      <UserCog className="h-4 w-4" />
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-rose-500"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : pathname !== "/login" ? (
            <Link
              href="/login"
              className="btn-gradient px-5 py-2 text-sm"
            >
              Sign In
            </Link>
          ) : null}
        </div>
      </div>

      {/* Mobile nav row */}
      {user && (
        <div className="mt-2 flex items-center gap-1 overflow-x-auto px-1 md:hidden">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                    : "border border-gray-200 bg-gray-50 text-gray-600"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
