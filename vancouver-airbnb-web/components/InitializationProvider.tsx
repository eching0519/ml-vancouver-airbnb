"use client";

import { inferenceEngine } from "@/lib/inference";
import { useEffect, useState } from "react";
import Preloader from "./Preloader";

export default function InitializationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted (client-side only) to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const initializeEngine = async () => {
      try {
        // Directly await the initialization promise
        // This is more reliable than intercepting console.log
        await inferenceEngine.init();
        setIsInitialized(true);
        setIsInitializing(false);
      } catch (error) {
        console.error("Failed to initialize inference engine:", error);
        setIsInitializing(false);
        // Still show the app even if initialization fails
        setIsInitialized(true);
      }
    };

    // Only initialize on client-side after mount
    if (mounted) {
      initializeEngine();
    }
  }, [mounted]);

  // Show preloader while initializing or not yet mounted
  if (!mounted || isInitializing || !isInitialized) {
    return <Preloader />;
  }

  return <>{children}</>;
}

