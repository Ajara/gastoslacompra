import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "La compra",
  description: "Hucha de casa: escanea tickets y mira el gasto con el tiempo.",
  applicationName: "La compra",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "La compra",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f3d2e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
