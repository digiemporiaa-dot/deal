"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type Option = { slug: string; name: string };

export function PackageFiltersBar({
  categories,
  destinations,
  initial,
}: {
  categories: Option[];
  destinations: Option[];
  initial: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [state, setState] = React.useState({
    q: initial.q ?? "",
    destination: initial.destination ?? "",
    category: initial.category ?? "",
    duration: initial.duration ?? "",
    sort: initial.sort ?? "",
  });

  const apply = (next = state) => {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    router.push(`/packages?${params.toString()}`);
  };

  const update = (key: keyof typeof state, value: string) => {
    const next = { ...state, [key]: value };
    setState(next);
    if (key !== "q") apply(next);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <form
          className="relative md:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search packages..."
            value={state.q}
            onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
          />
        </form>

        <Select value={state.destination} onChange={(e) => update("destination", e.target.value)}>
          <option value="">All destinations</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </Select>

        <Select value={state.category} onChange={(e) => update("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={state.duration} onChange={(e) => update("duration", e.target.value)}>
          <option value="">Any duration</option>
          <option value="short">Up to 4 days</option>
          <option value="medium">5–7 days</option>
          <option value="long">8+ days</option>
        </Select>

        <Select value={state.sort} onChange={(e) => update("sort", e.target.value)}>
          <option value="">Featured</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="newest">Newest</option>
        </Select>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setState({ q: "", destination: "", category: "", duration: "", sort: "" }); router.push("/packages"); }}>
          Clear
        </Button>
        <Button size="sm" onClick={() => apply()}>
          Apply
        </Button>
      </div>
    </div>
  );
}
