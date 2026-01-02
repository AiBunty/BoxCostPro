import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ClerkWrapper } from "@/shared/auth/ClerkWrapper";
import { ClerkAuthInjector } from "@/shared/auth/ClerkAuthInjector";
import { queryClient } from "@/shared/lib/queryClient";
import { AppRouter } from "@/app/AppRouter";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkWrapper>
      <ClerkAuthInjector>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkAuthInjector>
    </ClerkWrapper>
  </StrictMode>
);
