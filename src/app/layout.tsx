import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnkerCloud Monitoring - Enterprise Infrastructure Monitoring",
  description: "Professional server, website, network, and database monitoring platform",
  keywords: "monitoring, server monitoring, website monitoring, uptime, infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <ClientBody className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ClientBody>
    </html>
  );
}
