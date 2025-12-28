import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-8 right-6 z-[1000] h-12 w-12 rounded-full border border-white/40 dark:border-white/20 bg-white/60 dark:bg-white/10 text-gray-900 dark:text-white backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-white/70 dark:hover:bg-white/15 opacity-90 hover:opacity-100 transition-all duration-300"
      size="icon"
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-6 w-6" />
    </Button>
  );
}
