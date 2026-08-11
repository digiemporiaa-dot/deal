import { getSettings } from "@/lib/settings";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { EnquiryProvider } from "@/components/enquiry/EnquiryProvider";
import { AnalyticsScripts } from "@/components/site/AnalyticsScripts";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <EnquiryProvider>
      <div className="flex min-h-screen flex-col">
        <Header siteName={settings.siteName} links={settings.navigation.headerLinks} />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} />
      </div>
      <WhatsAppFloat number={settings.whatsapp} />
      <AnalyticsScripts settings={settings} />
    </EnquiryProvider>
  );
}
