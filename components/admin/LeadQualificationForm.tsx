"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateLeadQualification } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { TagInput } from "@/components/admin/TagInput";
import { Input, Select, Label } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";

export const TRIP_TYPES = [
  "Honeymoon",
  "Family",
  "Group",
  "Corporate",
  "Solo",
  "Pilgrimage",
  "Adventure",
  "Weekend",
] as const;

export type QualificationValues = {
  destination: string;
  destinationId: string;
  packageId: string;
  travelDate: string;
  returnDate: string;
  adults: string;
  children: string;
  rooms: string;
  budget: string;
  tripType: string;
  tags: string[];
};

/**
 * What the trip actually is.
 *
 * The enquiry form captures whatever the customer chose to type; this is
 * where the desk records what they found out on the call. Every field is
 * optional — a lead qualified halfway is the normal case, and a form that
 * refuses to save until it is complete is a form people work around.
 */
export function LeadQualificationForm({
  leadId,
  initial,
  packages,
  destinations,
  tagSuggestions,
  readOnly,
}: {
  leadId: string;
  initial: QualificationValues;
  packages: { id: string; name: string; destinationId: string }[];
  destinations: { id: string; name: string }[];
  tagSuggestions: string[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  // Re-sync when the server sends a newer version of the lead.
  React.useEffect(() => setValues(initial), [initial]);

  const set = <K extends keyof QualificationValues>(key: K, value: QualificationValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Picking a destination narrows the package list; a package already chosen
  // from a different destination is cleared rather than left contradicting it.
  const visiblePackages = values.destinationId
    ? packages.filter((pkg) => pkg.destinationId === values.destinationId)
    : packages;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || readOnly) return;
    setSaving(true);
    try {
      const result = await updateLeadQualification(leadId, {
        ...values,
        adults: values.adults === "" ? undefined : values.adults,
        children: values.children === "" ? undefined : values.children,
        rooms: values.rooms === "" ? undefined : values.rooms,
      });
      if (result.ok) {
        toast.success("Trip details saved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not save the trip details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="q-destination">Destination</Label>
          <Select
            id="q-destination"
            inputSize="sm"
            disabled={readOnly}
            value={values.destinationId}
            onChange={(event) => {
              const next = event.target.value;
              const chosen = destinations.find((d) => d.id === next);
              setValues((current) => ({
                ...current,
                destinationId: next,
                // Keep the free-text field readable for anyone without a
                // destination record picked.
                destination: chosen?.name ?? current.destination,
                packageId:
                  next && packages.find((p) => p.id === current.packageId)?.destinationId !== next
                    ? ""
                    : current.packageId,
              }));
            }}
          >
            <option value="">Not set</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="q-destination-text">Or type it</Label>
          <Input
            id="q-destination-text"
            inputSize="sm"
            maxLength={120}
            disabled={readOnly}
            placeholder="Kashmir"
            value={values.destination}
            onChange={(event) => set("destination", event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="q-package">Package of interest</Label>
          <Select
            id="q-package"
            inputSize="sm"
            disabled={readOnly}
            value={values.packageId}
            onChange={(event) => set("packageId", event.target.value)}
          >
            <option value="">Not set</option>
            {visiblePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="q-travel">Travel date</Label>
          <Input
            id="q-travel"
            inputSize="sm"
            type="date"
            disabled={readOnly}
            value={values.travelDate}
            onChange={(event) => set("travelDate", event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="q-return">Return date</Label>
          <Input
            id="q-return"
            inputSize="sm"
            type="date"
            disabled={readOnly}
            value={values.returnDate}
            onChange={(event) => set("returnDate", event.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <div>
            <Label htmlFor="q-adults">Adults</Label>
            <Input
              id="q-adults"
              inputSize="sm"
              type="number"
              min={0}
              max={50}
              disabled={readOnly}
              value={values.adults}
              onChange={(event) => set("adults", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="q-children">Children</Label>
            <Input
              id="q-children"
              inputSize="sm"
              type="number"
              min={0}
              max={50}
              disabled={readOnly}
              value={values.children}
              onChange={(event) => set("children", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="q-rooms">Rooms</Label>
            <Input
              id="q-rooms"
              inputSize="sm"
              type="number"
              min={0}
              max={50}
              disabled={readOnly}
              value={values.rooms}
              onChange={(event) => set("rooms", event.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="q-budget">Budget</Label>
          <Input
            id="q-budget"
            inputSize="sm"
            maxLength={60}
            disabled={readOnly}
            placeholder="1.5 lakh"
            value={values.budget}
            onChange={(event) => set("budget", event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="q-triptype">Trip type</Label>
          <Select
            id="q-triptype"
            inputSize="sm"
            disabled={readOnly}
            value={values.tripType}
            onChange={(event) => set("tripType", event.target.value)}
          >
            <option value="">Not set</option>
            {TRIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Tags</Label>
        <TagInput
          value={values.tags}
          disabled={readOnly}
          suggestions={tagSuggestions}
          onChange={(tags) => set("tags", tags)}
        />
      </div>

      {!readOnly && (
        <button type="submit" disabled={saving} className={buttonClasses("primary", "sm")}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save trip details
        </button>
      )}
    </form>
  );
}
