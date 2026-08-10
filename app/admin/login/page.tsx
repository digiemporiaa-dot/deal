"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plane, Loader2 } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Input, Label } from "@/components/ui/Field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
    </button>
  );
}

export default function AdminLoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
            <Plane className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your travel business</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="admin@vacationdeal.test" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          </div>
          {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
