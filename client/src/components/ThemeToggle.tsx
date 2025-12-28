import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored as "light" | "dark";
  // Default to dark when no stored preference
  return "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      className="transition-colors"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
