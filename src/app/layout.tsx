import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "eSpark · Global Pricing Module",
  description:
    "Precision-driven pricing for multi-manufacturer product catalogs — JOD conversion, shipping, customs, and profit modelling.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <Navigation />
          <main className="min-h-[calc(100vh-72px)]">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
