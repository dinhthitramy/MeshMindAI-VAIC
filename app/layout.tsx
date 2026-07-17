import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { themeInitializationScript } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MeshMind",
    template: "%s | MeshMind",
  },
  description: "MeshMind",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        inter.variable,
        geistMono.variable,
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
