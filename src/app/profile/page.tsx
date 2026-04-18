"use client";

import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  MANUFACTURER_COLORS,
  DEFAULT_MANUFACTURER_COLOR,
} from "@/lib/manufacturerColors";

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();

  // Profile info form
  const [fullName, setFullName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_MANUFACTURER_COLOR.key);
  const [infoSubmitting, setInfoSubmitting] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSuccess, setInfoSuccess] = useState<string | null>(null);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setColor(user.color || DEFAULT_MANUFACTURER_COLOR.key);
    }
  }, [user]);

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoError(null);
    setInfoSuccess(null);
    if (!fullName.trim()) {
      setInfoError("Full name cannot be empty.");
      return;
    }
    setInfoSubmitting(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), color }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInfoError(data.error ?? "Failed to update profile.");
        return;
      }
      setInfoSuccess("Profile updated successfully.");
      await refresh();
    } catch {
      setInfoError("Network error. Please try again.");
    } finally {
      setInfoSubmitting(false);
    }
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (!currentPassword || !newPassword) {
      setPwError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "Failed to change password.");
        return;
      }
      setPwSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
          <UserIcon className="h-3.5 w-3.5" />
          My Account
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update your personal information and password.
        </p>
      </div>

      {/* Account summary */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-lg font-bold text-cyan-700">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {user.fullName}
          </p>
          <p className="truncate font-mono text-xs text-gray-400">
            @{user.username}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            user.role === "admin"
              ? "bg-purple-50 text-purple-700"
              : "bg-cyan-50 text-cyan-700"
          )}
        >
          {user.role === "admin" ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <UserIcon className="h-3 w-3" />
          )}
          {user.role}
        </span>
      </div>

      {/* Personal info card */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-gray-900">
          Personal Information
        </h2>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Username
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-mono text-gray-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Username cannot be changed.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Accent Color
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              {MANUFACTURER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  title={c.label}
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    c.dot,
                    color === c.key
                      ? "border-gray-900 scale-110"
                      : "border-white hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>

          {infoError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
              <p className="text-sm text-rose-600">{infoError}</p>
            </div>
          )}
          {infoSuccess && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
              <p className="text-sm text-emerald-700">{infoSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={infoSubmitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-60"
          >
            {infoSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Changes
              </>
            )}
          </button>
        </form>
      </div>

      {/* Change password card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-gray-900">
          <KeyRound className="h-4 w-4" />
          Change Password
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Your current password is required to choose a new one.
        </p>

        <form onSubmit={handlePwSubmit} className="space-y-4">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            setShow={setShowCurrent}
            autoComplete="current-password"
          />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            setShow={setShowNew}
            autoComplete="new-password"
            hint="Min 6 characters"
          />
          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            setShow={setShowConfirm}
            autoComplete="new-password"
          />

          {pwError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
              <p className="text-sm text-rose-600">{pwError}</p>
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
              <p className="text-sm text-emerald-700">{pwSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={pwSubmitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {pwSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Update Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  setShow,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (fn: (v: boolean) => boolean) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
