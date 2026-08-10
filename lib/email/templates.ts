import { formatCurrency, formatDate } from "@/lib/utils";

/** Reusable branded HTML shell for all transactional emails. */
function shell(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#1b70f1;border-radius:12px 12px 0 0;padding:20px 28px">
      <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.5px">Vacationdeal</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e5e7eb;border-top:none">
      <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
      ${body}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
      © ${new Date().getFullYear()} Vacationdeal · This is an automated message.
    </p>
  </div>
</body></html>`;
}

const p = (text: string) =>
  `<p style="margin:0 0 12px;line-height:1.6;font-size:14px">${text}</p>`;

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:13px">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px">${value}</td>
  </tr>`;
}

type BookingEmailData = {
  bookingNumber: string;
  customerName: string;
  packageName: string;
  travelDate: Date;
  travellers: number;
  totalAmount: number;
  advanceAmount: number;
  currency: string;
};

export function bookingConfirmationEmail(d: BookingEmailData): string {
  return shell(
    "Your booking is confirmed 🎉",
    `${p(`Hi ${d.customerName}, thank you for booking with Vacationdeal. Here are your details:`)}
     <table style="width:100%;border-collapse:collapse;margin:12px 0">
       ${row("Booking Number", d.bookingNumber)}
       ${row("Package", d.packageName)}
       ${row("Travel Date", formatDate(d.travelDate))}
       ${row("Travellers", String(d.travellers))}
       ${row("Total Amount", formatCurrency(d.totalAmount, d.currency))}
       ${row("Advance Paid", formatCurrency(d.advanceAmount, d.currency))}
     </table>
     ${p("Our travel expert will reach out shortly to finalise your itinerary.")}`,
  );
}

export function paymentReceiptEmail(d: BookingEmailData & { paymentId: string }): string {
  return shell(
    "Payment received ✅",
    `${p(`Hi ${d.customerName}, we have received your payment for booking <b>${d.bookingNumber}</b>.`)}
     <table style="width:100%;border-collapse:collapse;margin:12px 0">
       ${row("Payment ID", d.paymentId)}
       ${row("Amount Paid", formatCurrency(d.advanceAmount, d.currency))}
       ${row("Package", d.packageName)}
     </table>`,
  );
}

export function paymentFailedEmail(d: { customerName: string; bookingNumber: string }): string {
  return shell(
    "Payment could not be completed",
    `${p(`Hi ${d.customerName}, your payment for booking <b>${d.bookingNumber}</b> did not go through.`)}
     ${p("No amount has been charged. You can retry the payment from your booking summary, or contact us and we will help you complete it.")}`,
  );
}

export function newLeadAdminEmail(d: {
  name: string;
  phone: string;
  email?: string | null;
  destination?: string | null;
  message?: string | null;
}): string {
  return shell(
    "New enquiry received",
    `<table style="width:100%;border-collapse:collapse;margin:12px 0">
       ${row("Name", d.name)}
       ${row("Phone", d.phone)}
       ${row("Email", d.email || "—")}
       ${row("Destination", d.destination || "—")}
     </table>
     ${d.message ? p(`<b>Message:</b> ${d.message}`) : ""}`,
  );
}

export function newBookingAdminEmail(d: BookingEmailData): string {
  return shell(
    "New booking received",
    `<table style="width:100%;border-collapse:collapse;margin:12px 0">
       ${row("Booking Number", d.bookingNumber)}
       ${row("Customer", d.customerName)}
       ${row("Package", d.packageName)}
       ${row("Travel Date", formatDate(d.travelDate))}
       ${row("Total", formatCurrency(d.totalAmount, d.currency))}
     </table>`,
  );
}
