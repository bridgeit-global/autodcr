import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./contexts/UserContext";
import { DashboardAlertModalProvider } from "./dashboard/context/DashboardAlertModalContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Draft Desk — Document Smarter. Work Faster.",
  description: "Building plan approval and compliance platform for architects, consultants, and owners.",
  icons: {
    icon: "/draft-desk-logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-sm text-gray-900`}
      >
        <UserProvider>
          <DashboardAlertModalProvider>{children}</DashboardAlertModalProvider>
        </UserProvider>
      </body>
    </html>
  );
}
