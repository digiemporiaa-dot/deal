import { Skeleton, TableSkeleton, StatCardSkeleton } from "@/components/admin/ui";

/**
 * Page-shaped loading states.
 *
 * A skeleton is only worth having if it matches what arrives — a generic grey
 * block that gets replaced by a different layout reads as a flash, not as
 * progress. So each of these mirrors the page it stands in for: the same
 * number of KPI tiles, the same filter row, the same table.
 */

function Header({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28" />
        ))}
      </div>
    </div>
  );
}

function FilterRow({ fields = 5 }: { fields?: number }) {
  return (
    <div className="admin-card admin-card-shadow mb-4 flex flex-wrap items-end gap-3 p-3.5">
      <Skeleton className="h-9 min-w-[200px] flex-1" />
      {Array.from({ length: fields }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-28" />
      ))}
    </div>
  );
}

/** A list page: header, filters, table. */
export function ListPageSkeleton({
  tiles = 0,
  rows = 8,
  filters = 4,
}: {
  tiles?: number;
  rows?: number;
  filters?: number;
}) {
  return (
    <div>
      <Header />
      {tiles > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: tiles }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      )}
      <FilterRow fields={filters} />
      <TableSkeleton rows={rows} />
    </div>
  );
}

/** The dashboard: six KPI tiles, then the chart row, then the panels. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Header />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="admin-card admin-card-shadow p-5 xl:col-span-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-4 h-[230px]" />
        </div>
        <div className="admin-card admin-card-shadow p-5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-4 h-2.5 rounded-full" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-3" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="admin-card admin-card-shadow p-5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-4 h-[170px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A form page: header then a single tall card. */
export function FormPageSkeleton({ fields = 8 }: { fields?: number }) {
  return (
    <div>
      <Header />
      <div className="admin-card admin-card-shadow p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
