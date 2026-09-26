"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button type="button" variant="outline" size="icon" className={`theme-toggle ${className}`} aria-label="Cambiar tema" disabled><Sun /></Button>;
  }

  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`theme-toggle ${className}`}
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
