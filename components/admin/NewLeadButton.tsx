"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Modal } from "@/components/admin/overlay";
import { buttonClasses } from "@/components/admin/ui";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/admin/Toast";
import { createLead } from "@/app/admin/(panel)/leads/actions";
import { LEAD_PRIORITIES } from "@/lib/crm";
import { humanStatus } from "@/lib/admin-status";

/**
 * Add a lead by hand — the walk-in and phone-call path.
 *
 * A modal rather than a page because it is six fields and the agent is
 * usually mid-conversation (§44). Only name and phone are required; anything
 * else can be filled in later from the drawer.
 *
 * Opens on `?new=1` as well as its own button, so the topbar's Create menu
 * can link straight here.
 */
export function NewLeadButton({
  members,
  canAssign,
}: {
  members: { id: string; name: string }[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The Create menu links to ?new=1; consume it so refreshing does not reopen.
  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      const travellersValue = String(form.get("travellers") ?? "").trim();
      const result = await createLead({
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        destination: String(form.get("destination") ?? ""),
        travelDate: String(form.get("travelDate") ?? ""),
        travellers: travellersValue ? Number(travellersValue) : undefined,
        budget: String(form.get("budget") ?? ""),
        message: String(form.get("message") ?? ""),
        priority: (String(form.get("priority") ?? "NORMAL") as (typeof LEAD_PRIORITIES)[number]) ?? "NORMAL",
        assignedToId: String(form.get("assignedToId") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Lead added.");
      setOpen(false);
      // Land straight in the new lead's drawer, ready to log the call.
      // No refresh after this: a push already fetches the page from the
      // server, and a refresh on top of it cancels the navigation.
      router.push(`/admin/leads?lead=${result.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses("primary")}>
        <Plus className="h-4 w-4" />
        Add lead
      </button>

      <Modal
        open={open}
        onClose={close}
        busy={pending}
        size="lg"
        title="Add a lead"
        description="For enquiries that arrive by phone or in person. Name and number are enough to start."
      >
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <p className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <Input inputSize="sm" name="name" required autoFocus placeholder="Customer name" />
            </Field>
            <Field label="Phone" required>
              <Input inputSize="sm" name="phone" required placeholder="+91…" inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input inputSize="sm" name="email" type="email" placeholder="Optional" />
            </Field>
            <Field label="Destination">
              <Input inputSize="sm" name="destination" placeholder="e.g. Kashmir" />
            </Field>
            <Field label="Travel date">
              <Input inputSize="sm" name="travelDate" type="date" />
            </Field>
            <Field label="Travellers">
              <Input inputSize="sm" name="travellers" type="number" min={1} max={99} placeholder="2" />
            </Field>
            <Field label="Budget">
              <Input inputSize="sm" name="budget" placeholder="e.g. ₹50,000–80,000" />
            </Field>
            <Field label="Priority">
              <Select inputSize="sm" name="priority" defaultValue="NORMAL">
                {LEAD_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {humanStatus(priority)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {canAssign && (
            <Field label="Assign to">
              <Select inputSize="sm" name="assignedToId" defaultValue="">
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="What are they after?">
            <Textarea
              name="message"
              rows={3}
              className="min-h-[72px] text-[13px]"
              placeholder="Anything they mentioned on the call."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} disabled={pending} className={buttonClasses("outline")}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={buttonClasses("primary")}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add lead
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-admin-text-muted">
        {label}
        {required && <span className="ml-0.5 text-admin-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
