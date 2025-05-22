import { Metadata } from "next";
import GameTransactionsDemo from "@/components/Debug/GameTransactionsDemo";

export const metadata: Metadata = {
  title: "Game Transaction Demo | Elementals",
  description: "Demo of silent background transactions for in-game actions",
};

export default function GamePage() {
  return (
    <div className="container px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Game Transaction Demo</h1>
      <GameTransactionsDemo />
    </div>
  );
} 