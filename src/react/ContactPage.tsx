import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import Contact from "@/react/pages/Contact";

export default function ContactPage() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Contact />
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
