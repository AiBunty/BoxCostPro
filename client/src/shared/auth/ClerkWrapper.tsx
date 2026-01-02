import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";

interface ClerkWrapperProps {
  children: ReactNode;
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.error(
    "❌ [Clerk Init Error] Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables"
  );
  throw new Error(
    "Missing Publishable Key. Please set VITE_CLERK_PUBLISHABLE_KEY in your .env file."
  );
}

export function ClerkWrapper({ children }: ClerkWrapperProps) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}
