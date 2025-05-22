import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  className?: string;
}

export function Button({ children, className = '', ...props }: ButtonProps) {
  return (
    <button 
      className={`px-4 py-2 rounded bg-[#ffc107] text-black font-medium hover:bg-opacity-90 ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
} 