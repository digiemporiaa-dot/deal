import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Contextual WhatsApp CTA. The number always comes from settings; the message
 * is generated per package/destination.
 */
export function WhatsAppLink({
  number,
  message,
  label = "Chat on WhatsApp",
  className,
}: {
  number: string;
  message: string;
  label?: string;
  className?: string;
}) {
  if (!number) return null;
  return (
    <a
      href={buildWhatsAppLink(number, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1fb959]",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" /> {label}
    </a>
  );
}
