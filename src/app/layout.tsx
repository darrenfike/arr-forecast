import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { Navigation } from "@/components/ui/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARR Forecast | Revenue Forecasting Tool",
  description: "Forecast annual recurring revenue per merchant from payment processing and SaaS subscriptions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProvider>
          <div className="min-h-screen">
            <header className="bg-white border-b border-gray-200">
              <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">ARR Forecast</h1>
                  <p className="text-xs text-gray-500">Revenue forecasting for merchant deals</p>
                </div>
                <Navigation />
              </div>
            </header>
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
