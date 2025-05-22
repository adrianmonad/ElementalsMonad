import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transaction Demos | Elementals",
  description: "Demos for various transaction methods",
};

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 