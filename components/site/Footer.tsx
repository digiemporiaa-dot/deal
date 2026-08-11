import Link from "next/link";
import { Plane, Mail, Phone, MapPin, Instagram, Facebook, Youtube, Linkedin } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50">
      <div className="container-page grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-bold text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
              <Plane className="h-5 w-5" />
            </span>
            {settings.siteName}
          </div>
          <p className="mt-4 max-w-xs text-sm text-slate-600">{settings.tagline}</p>
          <div className="mt-4 flex gap-3">
            {settings.social.instagram && <SocialLink href={settings.social.instagram} icon={<Instagram className="h-4 w-4" />} />}
            {settings.social.facebook && <SocialLink href={settings.social.facebook} icon={<Facebook className="h-4 w-4" />} />}
            {settings.social.youtube && <SocialLink href={settings.social.youtube} icon={<Youtube className="h-4 w-4" />} />}
            {settings.social.linkedin && <SocialLink href={settings.social.linkedin} icon={<Linkedin className="h-4 w-4" />} />}
          </div>
        </div>

        <FooterCol title={settings.navigation.footerExploreTitle} links={settings.navigation.footerExploreLinks} />

        <FooterCol title={settings.navigation.footerSupportTitle} links={settings.navigation.footerSupportLinks} />

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Get in touch</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-brand-600" />{settings.phone}</li>
            <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-brand-600" />{settings.email}</li>
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-brand-600" />{settings.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-5">
        <p className="container-page text-center text-sm text-slate-500">
          © {year} {settings.siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-slate-600 hover:text-brand-600">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:border-brand-500 hover:text-brand-600"
    >
      {icon}
    </a>
  );
}
