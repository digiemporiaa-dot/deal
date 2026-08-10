"use client";

import * as React from "react";
import { useEnquiry } from "./EnquiryProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  title?: string;
  destination?: string;
  source?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

/**
 * Reusable trigger for the global enquiry popup. Powers every
 * "Enquire Now / Get Free Quote / Plan My Trip / Request Callback" CTA.
 */
export function EnquiryButton({
  label = "Enquire Now",
  title,
  destination,
  source,
  variant = "primary",
  size = "md",
  className,
}: Props) {
  const { open } = useEnquiry();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => open({ title: title || label, destination, source })}
    >
      {label}
    </Button>
  );
}
