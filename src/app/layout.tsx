import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Smart Pricing Sheet",
  description:
    "Multi-manufacturer pricing calculator with JOD conversion, shipping, customs, and profit calculations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-100 antialiased">
        <AuthProvider>
          <Navigation />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
