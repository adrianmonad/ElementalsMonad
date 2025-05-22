import type { Metadata } from "next";
import { FrameProvider } from "@/components/farcaster-provider";
import { PrivyProviderWrapper } from "@/components/privy-provider-wrapper";
import { DevModeToggle } from "@/components/ui/DevModeToggle";
import { Toaster } from "sonner";
import { InventoryProvider } from "@/lib/InventoryContext";

import "./globals.css";

export const metadata: Metadata = {
  title: "Elementals Adventure",
  description: "A pixel art NFT game on Monad blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link 
          rel="preload" 
          href="/fonts/Minecraft-1.ttf" 
          as="font" 
          type="font/ttf" 
          crossOrigin="anonymous" 
        />
        <link 
          rel="preload" 
          href="/fonts/Pixel Intv.otf" 
          as="font" 
          type="font/otf" 
          crossOrigin="anonymous" 
        />
        <link 
          rel="preload" 
          href="/fonts/Super Pixel Personal Use.ttf" 
          as="font" 
          type="font/ttf" 
          crossOrigin="anonymous" 
        />
        <link 
          rel="preload" 
          href="/fonts/pixelfont.ttf" 
          as="font" 
          type="font/ttf" 
          crossOrigin="anonymous" 
        />
      </head>
      <body className="bg-[#1a1a1a] min-h-screen overflow-x-hidden">
        <PrivyProviderWrapper>
          <FrameProvider>
            <InventoryProvider>
              <main>
                {children}
              </main>
              {/* Global toast container - only shows the most recent toast */}
              <Toaster 
                position="bottom-right" 
                toastOptions={{
                  visibleToasts: 1
                }}
              />
              <DevModeToggle />
            </InventoryProvider>
          </FrameProvider>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
