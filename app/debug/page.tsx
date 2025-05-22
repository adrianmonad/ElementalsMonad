export default function DebugPage() {
  return (
    <div className="container px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Debug Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <a
          href="/debug/transactions"
          className="block p-6 bg-[var(--ro-panel-bg)] hover:bg-[var(--ro-panel-bg-hover)] rounded-lg border border-[var(--ro-border)] transition-all"
        >
          <h2 className="text-xl font-pixel mb-2 text-[var(--ro-gold)]">Transaction Demos</h2>
          <p className="text-[var(--ro-text)] mb-4">Compare standard transactions vs game transactions with no popups</p>
          <div className="flex justify-end">
            <span className="px-4 py-1 bg-[#333] rounded text-sm">View Demo</span>
          </div>
        </a>
        
        <a
          href="/debug/game"
          className="block p-6 bg-[var(--ro-panel-bg)] hover:bg-[var(--ro-panel-bg-hover)] rounded-lg border border-[var(--ro-border)] transition-all"
        >
          <h2 className="text-xl font-pixel mb-2 text-[var(--ro-gold)]">Game Demo</h2>
          <p className="text-[var(--ro-text)] mb-4">Try our Tap-To-Earn Game with background transactions</p>
          <div className="flex justify-end">
            <span className="px-4 py-1 bg-[#333] rounded text-sm">Play Game</span>
          </div>
        </a>
      </div>
      
      <div className="p-6 border border-dashed border-[#444] rounded-lg mt-8 text-center">
        <h2 className="text-xl font-medium mb-4">Implementation Notes</h2>
        <p className="text-gray-400 mb-2">
          These demos showcase different approaches to handling transactions with Privy:
        </p>
        <ul className="text-left list-disc pl-8 text-sm text-gray-400 space-y-2">
          <li>Standard approach: each transaction requires approval</li>
          <li>Game approach: one-time approval for 24 hours of background transactions</li>
          <li>The game demo implements the 2048.monad.xyz style of transaction handling</li>
        </ul>
      </div>
    </div>
  );
} 