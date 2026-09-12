import {
  useState,
  type ChangeEvent,
  type FocusEvent,
  type SubmitEvent,
} from "react";
import { Loader2, Mail, Send } from "lucide-react";
import emailjs from "@emailjs/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { z } from "zod";

const EMAILJS_SERVICE_ID = import.meta.env.PUBLIC_EMAILJS_SERVICE_ID as string;
const EMAILJS_TEMPLATE_ID = import.meta.env
  .PUBLIC_EMAILJS_TEMPLATE_ID as string;
const EMAILJS_PUBLIC_KEY = import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY as string;

const COOLDOWN_SECONDS = 60;
const LAST_SUBMIT_KEY = "contact_last_submit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const initialFormData = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

const Contact = () => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactSchema = z.object({
    name: z
      .string()
      .trim()
      .max(100, { message: t("contact.validation.nameMax") })
      .superRefine((val, ctx) => {
        if (val.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.nameRequired"),
          });
        } else if (val.length < 2) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.nameMin"),
          });
        }
      }),
    email: z
      .string()
      .trim()
      .superRefine((val, ctx) => {
        if (val.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.emailRequired"),
          });
        } else if (!EMAIL_REGEX.test(val)) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.emailInvalid"),
          });
        }
      }),
    subject: z
      .string()
      .trim()
      .max(150, { message: t("contact.validation.subjectMax") })
      .superRefine((val, ctx) => {
        if (val.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.subjectRequired"),
          });
        } else if (val.length < 3) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.subjectMin"),
          });
        }
      }),
    message: z
      .string()
      .trim()
      .max(1000, { message: t("contact.validation.messageMax") })
      .superRefine((val, ctx) => {
        if (val.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.messageRequired"),
          });
        } else if (val.length < 10) {
          ctx.addIssue({
            code: "custom",
            message: t("contact.validation.messageMin"),
          });
        }
      }),
  });

  const getFieldError = (name: string, value: string): string | undefined => {
    const fieldSchema = contactSchema.shape[
      name as keyof typeof contactSchema.shape
    ];
    const result = fieldSchema.safeParse(value);
    if (result.success) return undefined;
    return result.error.issues[0]?.message;
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: getFieldError(name, value) ?? "" }));
    }
  };

  const handleBlur = (
    e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: getFieldError(name, value) ?? "" }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setTouched({});
    setErrors({});
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot anti-spam: bots fill this hidden field; reject silently.
    if (formData.website) {
      return;
    }

    const remaining = getRemainingCooldown();
    if (remaining > 0) {
      toast({
        title: t("contact.cooldown").replace("{n}", String(remaining)),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    setTouched({ name: true, email: true, subject: true, message: true });

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

    // Persist the message in Supabase (contacts table).
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
      // Configure PUBLIC_EMAILJS_SERVICE_ID, PUBLIC_EMAILJS_TEMPLATE_ID and
      // PUBLIC_EMAILJS_PUBLIC_KEY in your .env to enable email delivery.
      console.warn("EmailJS env vars not configured (PUBLIC_EMAILJS_*)");
      toast({ title: t("contact.success"), duration: 5000 });
      resetForm();
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
      resetForm();
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

  const fieldStyle = (name: string) =>
    cn(
      errors[name] && touched[name] && "border-destructive focus-visible:ring-destructive",
      !errors[name] && touched[name] && "border-green-500 dark:border-green-400",
    );

  const showError = (name: string) => Boolean(errors[name] && touched[name]);

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
                    onBlur={handleBlur}
                    placeholder={t("contact.namePlaceholder")}
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={showError("name") || undefined}
                    aria-describedby={
                      showError("name") ? "name-error" : undefined
                    }
                    className={fieldStyle("name")}
                  />
                  {showError("name") && (
                    <p id="name-error" className="text-sm text-destructive">
                      {errors.name}
                    </p>
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
                    onBlur={handleBlur}
                    placeholder={t("contact.emailPlaceholder")}
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={showError("email") || undefined}
                    aria-describedby={
                      showError("email") ? "email-error" : undefined
                    }
                    className={fieldStyle("email")}
                  />
                  {showError("email") && (
                    <p id="email-error" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">{t("contact.subject")}</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t("contact.subjectPlaceholder")}
                    aria-required="true"
                    aria-invalid={showError("subject") || undefined}
                    aria-describedby={
                      showError("subject") ? "subject-error" : undefined
                    }
                    className={fieldStyle("subject")}
                  />
                  {showError("subject") && (
                    <p id="subject-error" className="text-sm text-destructive">
                      {errors.subject}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t("contact.message")}</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t("contact.messagePlaceholder")}
                    rows={6}
                    aria-required="true"
                    aria-invalid={showError("message") || undefined}
                    aria-describedby={
                      showError("message") ? "message-error" : undefined
                    }
                    className={fieldStyle("message")}
                  />
                  {showError("message") && (
                    <p id="message-error" className="text-sm text-destructive">
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Honeypot anti-spam: invisible to humans, bots tend to fill it in */}
                <div aria-hidden="true" className="sr-only">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="text"
                    value={formData.website}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("contact.sending")}
                    </>
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