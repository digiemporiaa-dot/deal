import { getSettings } from "@/lib/settings";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { EnquiryProvider } from "@/components/enquiry/EnquiryProvider";
import { AnalyticsScripts } from "@/components/site/AnalyticsScripts";
import { MotionProvider } from "@/components/motion/MotionProvider";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <MotionProvider>
      {/*
        Animated elements are rendered at opacity 0 and faded in by the motion
        runtime. Without JavaScript that runtime never arrives, so this resets
        them to their finished state — the content is the default and the
        animation is the enhancement, not the other way round.
      */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: "[data-motion]{opacity:1!important;transform:none!important;filter:none!important}",
          }}
        />
      </noscript>

      <EnquiryProvider whatsappNumber={settings.whatsapp}>
        <div className="flex min-h-screen flex-col">
          <Header siteName={settings.siteName} links={settings.navigation.headerLinks} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
        </div>
        <WhatsAppFloat number={settings.whatsapp} />
        <AnalyticsScripts settings={settings} />
      </EnquiryProvider>
    </MotionProvider>
  );
}
