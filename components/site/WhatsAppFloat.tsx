import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink, GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";

/**
 * Floating WhatsApp button. Number comes from site settings (never hard-coded).
 */
export function WhatsAppFloat({ number }: { number: string }) {
  if (!number) return null;
  const href = buildWhatsAppLink(number, GENERAL_ENQUIRY_MESSAGE);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
