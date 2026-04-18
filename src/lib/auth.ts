import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const COOKIE_NAME = "ps_auth";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? "fallback-dev-secret-please-change-in-production"
  );

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "user";
  color: string;
  manufacturerId: number | null;
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    color: user.color,
    manufacturerId: user.manufacturerId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Older tokens stored the handle under "email" — fall back so
    // existing sessions keep working after the rename.
    const username =
      (payload.username as string | undefined) ??
      (payload.email as string | undefined) ??
      "";
    return {
      id: payload.id as number,
      username,
      fullName: payload.fullName as string,
      role: payload.role as "admin" | "user",
      color: (payload.color as string | undefined) ?? "cyan",
      manufacturerId: (payload.manufacturerId as number) ?? null,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
