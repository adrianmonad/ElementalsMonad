import { useMiniAppContext } from "@/hooks/use-miniapp-context";

export function User() {
  const { context } = useMiniAppContext();

  return (
    <div className="border-2 border-amber-700/50 rounded-lg p-4 bg-gradient-to-b from-gray-900/80 to-gray-800/80 shadow-lg relative overflow-hidden">
      {/* Texture overlay */}
      <div className="absolute inset-0 opacity-10 bg-[url('/images/texture.png')] bg-repeat pointer-events-none"></div>
      
      {/* Glowing border effect */}
      <div className="absolute inset-0 rounded-lg border-2 border-amber-500/20 animate-pulse pointer-events-none"></div>
      
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 shadow-inner pointer-events-none"></div>
      
      <div className="relative z-10">
        {context?.user ? (
          <div className="flex items-center space-x-3">
            {context?.user?.pfpUrl ? (
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-2 border-yellow-500/50 animate-pulse"></div>
                <img
                  src={context?.user?.pfpUrl}
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-600 shadow-md relative z-10"
                  alt="Player Avatar"
                  width={56}
                  height={56}
                />
                <div className="absolute -inset-1 bg-amber-500/10 rounded-full blur-sm"></div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-800/30 flex items-center justify-center border-2 border-amber-600 relative">
                <span className="text-2xl">🧙</span>
                <div className="absolute -inset-1 bg-amber-500/10 rounded-full blur-sm"></div>
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <span className="text-amber-400 mr-2">🧙</span>
                <h3 className="font-medieval text-lg font-bold text-amber-100 drop-shadow-[0_0_2px_rgba(255,180,0,0.3)]">
                  Player: <span className="text-amber-300">{context?.user?.displayName}</span>
                  {context?.user?.username && (
                    <span className="text-sm text-amber-400/80 ml-1">(@{context?.user?.username})</span>
                  )}
                </h3>
              </div>
              
              <div className="flex items-center">
                <span className="text-amber-400 mr-2">🎮</span>
                <p className="text-sm text-amber-200">
                  FID: <span className="font-semibold bg-amber-900/30 px-2 py-0.5 rounded">{context?.user?.fid}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-amber-300 font-medieval text-lg drop-shadow-[0_0_2px_rgba(255,180,0,0.3)]">~ Adventurer Unknown ~</p>
            <p className="text-sm text-amber-200/70 mt-1">Sign in to begin your quest</p>
          </div>
        )}
      </div>
    </div>
  );
}
