import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    id: "elementals-monad", // required for identification
    name: "Elementals",
    description: "A Farcaster-powered NFT battle game built to break Monad.",
    icon: `${APP_URL}/images/icon.png`,
    url: `${APP_URL}`,
    requestedPermissions: [],
    redirect: false,
    frame: {
      version: "1.0",
      name: "Elementals",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [`${APP_URL}/images/feed.png`],
      tags: ["monad", "farcaster", "miniapp", "template", "game", "nft"],
      primaryCategory: "developer-tools",
      buttonTitle: "Enter Elementals",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
