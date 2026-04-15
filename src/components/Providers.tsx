"use client";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity, // Never automatically refetch
            gcTime: 60 * 60 * 1000, // Cache stays in memory for 1 Hour
            refetchOnWindowFocus: false, // Don't refetch when switching tabs
            refetchOnReconnect: false, // Don't refetch on connection restore
            retry: 1, // Retry failed requests once
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
