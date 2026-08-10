import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { SectionHeading } from "@/components/site/Section";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { WhatsAppLink } from "@/components/site/WhatsAppLink";
import { GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Vacationdeal team to plan your next holiday.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <div className="container-page py-14">
      <SectionHeading eyebrow="We're here to help" title="Contact Us" subtitle="Reach out and our travel experts will get back to you within a few hours." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <ContactRow icon={<Phone className="h-5 w-5" />} label="Phone" value={settings.phone} />
          <ContactRow icon={<Mail className="h-5 w-5" />} label="Email" value={settings.email} />
          <ContactRow icon={<MapPin className="h-5 w-5" />} label="Address" value={settings.address} />
          <ContactRow icon={<Clock className="h-5 w-5" />} label="Business hours" value={settings.businessHours} />
          <div className="flex flex-wrap gap-3 pt-2">
            <EnquiryButton label="Send an Enquiry" title="Contact Us" source="contact-page" />
            <WhatsAppLink number={settings.whatsapp} message={GENERAL_ENQUIRY_MESSAGE} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <h3 className="text-lg font-semibold text-slate-900">Request a callback</h3>
          <p className="mt-2 text-sm text-slate-600">
            Prefer we call you? Share your details and a travel expert will ring you back.
          </p>
          <EnquiryButton label="Request Callback" title="Request a Callback" source="contact-callback" className="mt-4 w-full" />
        </div>
      </div>
    </div>
  );
}

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
