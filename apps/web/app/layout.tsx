import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { CLERK_ENABLED } from "@/lib/clerk-flag";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayende Autos — Canadian cars, landed in Lagos",
  description:
    "Browse used vehicles sourced and inspected in Canada, each with the full landed cost — purchase, shipping, Lagos clearing and 12% handling — in CAD and NGN, repriced live as the rate moves.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B1413",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Merriweather:opsz,wght@18..144,300..900&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{CLERK_ENABLED ? <ClerkProvider>{children}</ClerkProvider> : children}</body>
    </html>
  );
}
