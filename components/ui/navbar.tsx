"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { login, logout, authenticated } = usePrivy();

  // Navigation links
  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Game Demo", path: "/debug/game" },
    { name: "Transactions", path: "/debug/transactions" },
    { name: "Battle Arena", path: "/battle-area" },
    { name: "Inventory", path: "/inventory" },
    { name: "Marketplace", path: "/marketplace" },
  ];

  return (
    <nav className="bg-[#1a1a1a] border-b border-[#333] py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Desktop Navigation */}
        <div className="hidden md:flex space-x-6">
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              href={link.path}
              className={`text-sm font-pixel transition-colors ${
                pathname === link.path 
                  ? "text-[var(--ro-gold)]" 
                  : "text-gray-300 hover:text-[var(--ro-gold)]"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Auth Button */}
        <div className="hidden md:block">
          {authenticated ? (
            <button 
              onClick={() => logout()}
              className="bg-[#333] text-white px-4 py-1 rounded font-pixel text-sm hover:bg-[#444]"
            >
              Log Out
            </button>
          ) : (
            <button 
              onClick={() => login()}
              className="bg-[var(--ro-gold)] text-black px-4 py-1 rounded font-pixel text-sm hover:bg-[#d4af37]"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-gray-300 focus:outline-none"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden mt-4 py-2 bg-[#222] rounded-lg shadow-xl absolute left-4 right-4 z-50">
          <div className="flex flex-col px-4 py-2 space-y-3">
            {navLinks.map((link) => (
              <Link 
                key={link.path} 
                href={link.path}
                className={`text-sm font-pixel py-2 ${
                  pathname === link.path 
                    ? "text-[var(--ro-gold)]" 
                    : "text-gray-300"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="border-t border-[#333] pt-2 mt-2">
              {authenticated ? (
                <button 
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left text-sm font-pixel py-2 text-gray-300"
                >
                  Log Out
                </button>
              ) : (
                <button 
                  onClick={() => {
                    login();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left text-sm font-pixel py-2 text-[var(--ro-gold)]"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 