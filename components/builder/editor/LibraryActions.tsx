"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  deleteReusableSection,
  deleteTemplate,
} from "@/app/admin/(panel)/pages/builder-actions";

const buttonClass =
  "rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600";

export function DeleteReusableButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmButton
      onConfirm={() => deleteReusableSection(id)}
      title={`Delete "${name}"?`}
      description="Any page embedding this section will lose it. Pages that copied it as a template are unaffected."
      confirmLabel="Delete section"
      successMessage="Reusable section deleted."
      className={buttonClass}
    >
      <Trash2 className="h-4 w-4" />
    </ConfirmButton>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmButton
      onConfirm={() => deleteTemplate(id)}
      title={`Delete the "${name}" template?`}
      description="Pages already built from it keep their content — a template is copied when used, not linked."
      confirmLabel="Delete template"
      successMessage="Template deleted."
      className={buttonClass}
    >
      <Trash2 className="h-4 w-4" />
    </ConfirmButton>
  );
}
