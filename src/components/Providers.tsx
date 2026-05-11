"use client";
import { SessionProvider } from "next-auth/react";
import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,            // Never automatically refetch
        gcTime: 60 * 60 * 1000,        // Cache stays in memory for 1 hour
        refetchOnWindowFocus: false,    // Don't refetch when switching tabs
        refetchOnReconnect: false,      // Don't refetch on connection restore
        retry: 1,                       // Retry failed requests once
      },
    },
  });
}

// Browser: reuse the same QueryClient across re-renders and Suspense retries.
// Server: always create a fresh one per request (never share between requests).
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState here — if React suspends before it initialises,
  // a second call would create a different QueryClient and lose context.
  const queryClient = getQueryClient();

  useEffect(() => {
    // Pre-initialize the worker as soon as the user hits the Dashboard
    const warmUpWorker = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        console.log("[Providers] PDF Worker pre-loaded and warmed up");
      } catch (e) {
        console.error("[Providers] PDF Worker warm-up failed", e);
      }
    };

    warmUpWorker();
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
