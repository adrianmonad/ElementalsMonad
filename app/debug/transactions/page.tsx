"use client";

import TransactionDemo from "@/components/Debug/TransactionDemo";
import GameTransactionsDemo from "@/components/Debug/GameTransactionsDemo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TransactionsDebugPage() {
  return (
    <div className="container px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Transaction Demos</h1>
      
      <div className="mb-8">
        <p className="text-center text-gray-400 max-w-2xl mx-auto mb-8">
          This page demonstrates different approaches to handling transactions in a blockchain game.
          The goal is to provide a seamless experience without constant wallet approval popups.
        </p>
      </div>
      
      <Tabs defaultValue="queued" className="w-full">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="standard">Standard Transactions</TabsTrigger>
          <TabsTrigger value="optimistic">Optimistic UI</TabsTrigger>
          <TabsTrigger value="queued">Transaction Queue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="standard">
          <div>
            <h2 className="text-xl font-bold mb-4 text-center">Standard Transactions</h2>
            <p className="text-gray-400 mb-8 text-center text-sm">
              Regular transaction flow with approval for each transaction
            </p>
            <TransactionDemo />
          </div>
        </TabsContent>
        
        <TabsContent value="optimistic">
          <div>
            <h2 className="text-xl font-bold mb-4 text-center">Optimistic UI with Transaction Approval</h2>
            <p className="text-gray-400 mb-8 text-center text-sm">
              Updates UI immediately but still requires transaction approval for each action
            </p>
            <TransactionDemo optimistic={true} />
          </div>
        </TabsContent>
        
        <TabsContent value="queued">
          <div>
            <h2 className="text-xl font-bold mb-4 text-center">Transaction Queue System</h2>
            <p className="text-gray-400 mb-8 text-center text-sm">
              Pre-approved transaction queue that processes transactions in the background with no popups
            </p>
            <GameTransactionsDemo />
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-12 p-4 border border-gray-800 rounded-lg bg-gray-900/50">
        <h3 className="text-lg font-bold mb-4">About the Transaction Queue System</h3>
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">How it works:</strong> Based on the approach used by Monad 2048 game, this system:
          </p>
          <ol className="list-decimal pl-8 text-sm text-gray-400 space-y-2">
            <li>Requires a one-time signature approval that authorizes background transactions for 24 hours</li>
            <li>Queues transactions when user interacts with the game</li>
            <li>Processes transactions in the background without interrupting gameplay</li>
            <li>Provides immediate feedback through optimistic UI updates</li>
            <li>Maintains a transaction queue that persists across page reloads using localStorage</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 