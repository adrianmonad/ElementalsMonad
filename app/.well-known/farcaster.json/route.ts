import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    id: "elementals-monad",
    name: "Elementals",
    description: "A Farcaster-powered NFT battle game built to break Monad.",
    icon: `${APP_URL}/images/icon.png`,
    url: `${APP_URL}`,
    requestedPermissions: [],
    redirect: false,
    accountAssociation: {
      header: "eyJmaWQiOjEwNjE3MDUsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg0ZjM4NjI2Mjk0NWZCODA1M0M3RUY1MzFlMjhlNDYwOTdlNDA0QzBmIn0",
      payload: "eyJkb21haW4iOiJlbGVtZW50YWxzLW1vbmFkLnZlcmNlbC5hcHAifQ",
      signature: "MHgzYmI4NWYxOTY3MjcxMjJhNTYxN2E2ZWM4MjI5NmYxNTA5ODUzMzA5Y2YxMGU2YWRhOWM4N2UzZjg0NDg5MzBkMzgyYjQ2NTBiMWU5ZTg5OGViNTJkOTY5NzVhODNmZDcwNGJmMjZmMjA0OGZkZjVhYzFhM2M4NDdlODZmYjljMzFi"
    },
    frame: {
      version: "1",
      name: "Elementals",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [`${APP_URL}/images/feed.png`],
      tags: ["monad", "farcaster", "game", "nft", "miniapp"],
      primaryCategory: "developer-tools",
      buttonTitle: "Enter Elementals",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
