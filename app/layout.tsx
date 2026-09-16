import type { Metadata, Viewport } from "next";
import "./globals.css";

const faviconSvg =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23080908'/%3E%3Cpath d='M18 16v21c0 12 6 18 14 18s14-6 14-18V16h-8v21c0 7-2 10-6 10s-6-3-6-10V16z' fill='none' stroke='%23d9aa63' stroke-width='5' stroke-linecap='round'/%3E%3Ccircle cx='22' cy='23' r='2.2' fill='%23d9aa63'/%3E%3Ccircle cx='42' cy='23' r='2.2' fill='%23d9aa63'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Nocturne Riding Academy",
  description: "Nocturne Riding Academy — progressive riding plans for every equestrian level.",
  icons: { icon: faviconSvg },
};

export const viewport: Viewport = {
  themeColor: "#080908",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Italiana&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
