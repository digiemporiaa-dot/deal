"use client";

import * as React from "react";
import { EnquiryModal } from "./EnquiryModal";

type OpenOptions = { title?: string; destination?: string; source?: string };

type EnquiryContextValue = {
  open: (opts?: OpenOptions) => void;
  close: () => void;
};

const EnquiryContext = React.createContext<EnquiryContextValue | null>(null);

export function useEnquiry() {
  const ctx = React.useContext(EnquiryContext);
  if (!ctx) throw new Error("useEnquiry must be used inside <EnquiryProvider>");
  return ctx;
}

export function EnquiryProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<OpenOptions>({});

  const open = React.useCallback((o?: OpenOptions) => {
    setOpts(o ?? {});
    setIsOpen(true);
  }, []);
  const close = React.useCallback(() => setIsOpen(false), []);

  return (
    <EnquiryContext.Provider value={{ open, close }}>
      {children}
      <EnquiryModal
        isOpen={isOpen}
        onClose={close}
        title={opts.title}
        defaultDestination={opts.destination}
        source={opts.source}
      />
    </EnquiryContext.Provider>
  );
}
