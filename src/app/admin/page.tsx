"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Plus,
  Loader2,
  AlertCircle,
  Factory,
  X,
  Trash2,
  Activity,
  User as UserIcon,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MANUFACTURER_COLORS, DEFAULT_MANUFACTURER_COLOR } from "@/lib/manufacturerColors";
import { SystemBackup } from "@/components/SystemBackup";

interface Manufacturer {
  id: number;
  name: string;
}

interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  role: string;
  color: string;
  manufacturerId: number | null;
  createdAt: string;
}

interface CreateForm {
  username: string;
  password: string;
  fullName: string;
  color: string;
  role: "admin" | "user";
  manufacturerMode: "none" | "existing" | "new";
  manufacturerId: string;
  manufacturerName: string;
}

const EMPTY_FORM: CreateForm = {
  username: "",
  password: "",
  fullName: "",
  color: DEFAULT_MANUFACTURER_COLOR.key,
  role: "user",
  manufacturerMode: "none",
  manufacturerId: "",
  manufacturerName: "",
};

export default function AdminPage() {
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    color: DEFAULT_MANUFACTURER_COLOR.key,
    role: "user" as "admin" | "user",
    manufacturerId: "" as string,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usrRes, mfgRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/manufacturers"),
      ]);
      if (usrRes.ok) setUserList(await usrRes.json());
      if (mfgRes.ok) setManufacturers(await mfgRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openBlankForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        username: form.username,
        password: form.password,
        fullName: form.fullName,
        color: form.color,
        role: form.role,
      };

      if (form.manufacturerMode === "existing" && form.manufacturerId) {
        body.manufacturerId = parseInt(form.manufacturerId);
      } else if (
        form.manufacturerMode === "new" &&
        form.manufacturerName.trim()
      ) {
        body.manufacturerName = form.manufacturerName.trim();
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create account.");
        return;
      }
      setFormSuccess(`Account created: ${form.username}`);
      setShowForm(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (u.username === "admin") return;
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete user.");
    }
  };

  const openEdit = (u: UserRecord) => {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      color: u.color || DEFAULT_MANUFACTURER_COLOR.key,
      role: u.role === "admin" ? "admin" : "user",
      manufacturerId: u.manufacturerId ? String(u.manufacturerId) : "",
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    if (!editForm.fullName.trim()) {
      setEditError("Full name cannot be empty.");
      return;
    }
    setEditSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fullName: editForm.fullName.trim(),
        color: editForm.color,
        role: editForm.role,
      };
      body.manufacturerId = editForm.manufacturerId
        ? parseInt(editForm.manufacturerId)
        : null;

      const res = await fetch(
        `/api/admin/users?id=${editingUser.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to update user.");
        return;
      }
      setFormSuccess(`User updated: ${editingUser.username}`);
      setEditingUser(null);
      await loadData();
    } finally {
      setEditSubmitting(false);
    }
  };

  const openReset = (u: UserRecord) => {
    setResetTarget(u);
    setResetPassword("");
    setShowResetPassword(false);
    setResetError(null);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    if (resetPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetTarget.id,
          newPassword: resetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error ?? "Failed to reset password.");
        return;
      }
      setFormSuccess(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
    } finally {
      setResetSubmitting(false);
    }
  };

  const mfgNameById = Object.fromEntries(
    manufacturers.map((m) => [m.id, m.name])
  );

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Panel
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/logs"
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Activity className="h-4 w-4" />
              Activity Logs
            </Link>
            <Link
              href="/trash"
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Trash Bin
            </Link>
            <button
              onClick={openBlankForm}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create User
            </button>
          </div>
        </div>
      </div>

      {/* Full-system backup/restore — use this before changing DATABASE_URL. */}
      <SystemBackup />

      {/* Success banner */}
      {formSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-700">{formSuccess}</p>
          <button
            onClick={() => setFormSuccess(null)}
            className="ml-auto text-emerald-400 hover:text-emerald-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {userList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No users yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Username
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Manufacturer
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {u.fullName}
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                      @{u.username}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          u.role === "admin"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-cyan-50 text-cyan-700"
                        )}
                      >
                        {u.role === "admin" ? (
                          <ShieldCheck className="mr-1 h-3 w-3" />
                        ) : (
                          <UserIcon className="mr-1 h-3 w-3" />
                        )}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {u.manufacturerId ? (
                        <span className="flex items-center gap-1.5">
                          <Factory className="h-3.5 w-3.5 text-gray-400" />
                          {mfgNameById[u.manufacturerId] ?? `#${u.manufacturerId}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                          title="Edit user"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openReset(u)}
                          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          title="Reset password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {u.username !== "admin" && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create User</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Username */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      username: e.target.value.toLowerCase(),
                    }))
                  }
                  placeholder="raghad"
                  autoComplete="off"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 font-mono focus:border-cyan-400 focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  3–32 chars. Letters, digits, dot, underscore, or dash.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-800 font-mono focus:border-cyan-400 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCreatePassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Accent Color{" "}
                  <span className="font-normal text-gray-400">
                    — applied to all their manufacturer cards
                  </span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  {MANUFACTURER_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c.key}
                      title={c.label}
                      onClick={() => setForm((f) => ({ ...f, color: c.key }))}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-transform",
                        c.dot,
                        form.color === c.key
                          ? "border-gray-900 scale-110"
                          : "border-white hover:scale-110"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["user", "admin"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        form.role === r
                          ? r === "admin"
                            ? "border-purple-300 bg-purple-50 text-purple-700"
                            : "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      {r === "admin" ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <UserIcon className="h-3.5 w-3.5" />
                      )}
                      {r === "admin" ? "Admin" : "User"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Admins can manage users, view audit logs, and see every
                  project. Regular users only see their own work.
                </p>
              </div>

              {/* Manufacturer (optional) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Default Manufacturer{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <div className="mb-2 flex flex-wrap gap-3">
                  {(["none", "existing", "new"] as const).map((mode) => (
                    <label
                      key={mode}
                      className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="mfgMode"
                        value={mode}
                        checked={form.manufacturerMode === mode}
                        onChange={() =>
                          setForm((f) => ({ ...f, manufacturerMode: mode }))
                        }
                        className="accent-cyan-500"
                      />
                      {mode === "none"
                        ? "None"
                        : mode === "new"
                        ? "Create new"
                        : "Use existing"}
                    </label>
                  ))}
                </div>

                {form.manufacturerMode === "new" ? (
                  <input
                    type="text"
                    placeholder="Manufacturer name"
                    value={form.manufacturerName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        manufacturerName: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                  />
                ) : form.manufacturerMode === "existing" ? (
                  <select
                    value={form.manufacturerId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, manufacturerId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                  >
                    <option value="">— select manufacturer —</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Create User"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Edit User
                <span className="ml-2 font-mono text-xs text-gray-400">
                  @{editingUser.username}
                </span>
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, fullName: e.target.value }))
                  }
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
                      onClick={() =>
                        setEditForm((f) => ({ ...f, color: c.key }))
                      }
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-transform",
                        c.dot,
                        editForm.color === c.key
                          ? "border-gray-900 scale-110"
                          : "border-white hover:scale-110"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["user", "admin"] as const).map((r) => {
                    const locked =
                      editingUser.username === "admin" ||
                      // We rely on the server to reject self-demotion, but
                      // we also prevent toggling here for a clearer UX when
                      // an admin opens their own row.
                      false;
                    return (
                      <button
                        type="button"
                        key={r}
                        disabled={locked}
                        onClick={() =>
                          setEditForm((f) => ({ ...f, role: r }))
                        }
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          editForm.role === r
                            ? r === "admin"
                              ? "border-purple-300 bg-purple-50 text-purple-700"
                              : "border-cyan-300 bg-cyan-50 text-cyan-700"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        {r === "admin" ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <UserIcon className="h-3.5 w-3.5" />
                        )}
                        {r === "admin" ? "Admin" : "User"}
                      </button>
                    );
                  })}
                </div>
                {editingUser.username === "admin" && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    The built-in admin account cannot be demoted.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Default Manufacturer{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  value={editForm.manufacturerId}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      manufacturerId: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                >
                  <option value="">— none —</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {editError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{editError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-60"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <KeyRound className="h-4 w-4" />
                Reset Password
              </h2>
              <button
                onClick={() => setResetTarget(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-500">
              Set a new password for{" "}
              <span className="font-semibold text-gray-800">
                {resetTarget.fullName}
              </span>{" "}
              <span className="font-mono text-xs text-gray-400">
                (@{resetTarget.username})
              </span>
              . They will need to use this new password to sign in.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-800 font-mono focus:border-cyan-400 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showResetPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {resetError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{resetError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-60"
                >
                  {resetSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Resetting…
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
