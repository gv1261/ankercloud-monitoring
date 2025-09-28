"use client";

import { useEffect } from "react";

export default function ClientBody({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  }, []);

  return <>{children}</>;
}
