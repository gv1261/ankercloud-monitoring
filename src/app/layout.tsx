import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnkerCloud Monitoring - Light Dashboard",
  description: "Enterprise monitoring platform with light theme",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className={inter.className}>
        <ClientBody>
          <AuthProvider>{children}</AuthProvider>
        </ClientBody>
      </body>
    </html>
  );
}
