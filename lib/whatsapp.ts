/**
 * WhatsApp helpers. The number always comes from site settings (never
 * hard-coded in components). Use `buildWhatsAppLink` on the server or pass a
 * settings-provided number to the client.
 */
export function sanitizeWhatsAppNumber(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

export function buildWhatsAppLink(number: string, message: string): string {
  const num = sanitizeWhatsAppNumber(number);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function packageEnquiryMessage(packageName: string): string {
  return `Hi, I am interested in the ${packageName}. Please share the details.`;
}

export function destinationEnquiryMessage(destinationName: string): string {
  return `Hi, I would like to plan a trip to ${destinationName}. Please share package options.`;
}

export const GENERAL_ENQUIRY_MESSAGE =
  "Hi, I would like to plan a holiday. Please help me with the details.";
