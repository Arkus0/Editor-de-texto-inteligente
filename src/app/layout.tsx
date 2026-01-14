import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-serif",
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SocioFlow",
  description: "Editor Asistido para Sociólogos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable,
          merriweather.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}
