import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { Mail, Send } from "lucide-react";
import emailjs from "@emailjs/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const EMAILJS_SERVICE_ID = import.meta.env.PUBLIC_EMAILJS_SERVICE_ID as string;
const EMAILJS_TEMPLATE_ID = import.meta.env
  .PUBLIC_EMAILJS_TEMPLATE_ID as string;
const EMAILJS_PUBLIC_KEY = import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY as string;

const COOLDOWN_SECONDS = 60;
const LAST_SUBMIT_KEY = "contact_last_submit";

function getRemainingCooldown(): number {
  try {
    const raw = localStorage.getItem(LAST_SUBMIT_KEY);
    if (!raw) return 0;
    const lastSubmit = parseInt(raw, 10);
    if (isNaN(lastSubmit)) return 0;
    const elapsed = Math.floor((Date.now() - lastSubmit) / 1000);
    return Math.max(0, COOLDOWN_SECONDS - elapsed);
  } catch {
    return 0;
  }
}

function markSubmitted() {
  try {
    localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
  } catch {}
}

const Contact = () => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, { message: t("contact.validation.nameRequired") })
      .max(100, { message: t("contact.validation.nameMax") }),
    email: z
      .email({ message: t("contact.validation.emailInvalid") })
      .trim()
      .min(1, { message: t("contact.validation.emailRequired") }),
    subject: z
      .string()
      .trim()
      .min(1, { message: t("contact.validation.subjectRequired") })
      .max(150, { message: t("contact.validation.subjectMax") }),
    message: z
      .string()
      .trim()
      .min(1, { message: t("contact.validation.messageRequired") })
      .max(1000, { message: t("contact.validation.messageMax") }),
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const remaining = getRemainingCooldown();
    if (remaining > 0) {
      toast({
        title: t("contact.cooldown").replace("{n}", String(remaining)),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    let validatedData: z.infer<typeof contactSchema>;
    try {
      validatedData = contactSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
      }
      return;
    }

    setIsSubmitting(true);

    void (async () => {
      try {
        await supabase.from("contacts").insert([
          {
            name: validatedData.name,
            email: validatedData.email,
            subject: validatedData.subject,
            message: validatedData.message,
          },
        ]);
      } catch {}
    })();

    const emailConfigured =
      EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY;

    if (!emailConfigured) {
      console.warn("EmailJS env vars not configured (PUBLIC_EMAILJS_*)");
      toast({ title: t("contact.success"), duration: 5000 });
      setFormData({ name: "", email: "", subject: "", message: "" });
      markSubmitted();
      setIsSubmitting(false);
      return;
    }

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: validatedData.name,
          from_email: validatedData.email,
          subject: validatedData.subject,
          message: validatedData.message,
        },
        EMAILJS_PUBLIC_KEY,
      );

      toast({ title: t("contact.success"), duration: 5000 });
      setFormData({ name: "", email: "", subject: "", message: "" });
      markSubmitted();
    } catch {
      toast({
        title: t("contact.error"),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t("contact.title")}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t("contact.subtitle")}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="animate-slide-up">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("contact.name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t("contact.namePlaceholder")}
                    className={errors.name ? "border-destructive" : ""}
                    autoComplete="name"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("contact.email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("contact.emailPlaceholder")}
                    className={errors.email ? "border-destructive" : ""}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">{t("contact.subject")}</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder={t("contact.subjectPlaceholder")}
                    className={errors.subject ? "border-destructive" : ""}
                  />
                  {errors.subject && (
                    <p className="text-sm text-destructive">{errors.subject}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t("contact.message")}</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t("contact.messagePlaceholder")}
                    rows={6}
                    className={errors.message ? "border-destructive" : ""}
                  />
                  {errors.message && (
                    <p className="text-sm text-destructive">{errors.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    t("contact.sending")
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      {t("contact.send")}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Contact;
