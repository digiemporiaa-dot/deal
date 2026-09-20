import { Plane, RefreshCcw, UserPlus, Users } from "lucide-react";
import { requirePermission } from "@/lib/guard";
import { listCustomers, customerSummary } from "@/lib/services/sales";
import { customerQuerySchema } from "@/lib/validation";
import {
  PageHeader,
  Card,
  FilterBar,
  Pagination,
  StatCard,
  buttonClasses,
} from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { CustomerTable } from "@/components/admin/CustomerTable";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The customer book.
 *
 * A customer record is created by the checkout, so this list is people who
 * have actually booked — enquiries live under Leads until they convert. Spend
 * and trip counts are aggregated in the database per page of customers, not
 * by loading their bookings.
 */
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("customers:view");

  const raw = await searchParams;
  const parsed = customerQuerySchema.safeParse({
    q: first(raw.q),
    sort: first(raw.sort) ?? "newest",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : customerQuerySchema.parse({});

  const [{ rows, total, page, pageCount }, summary] = await Promise.all([
    listCustomers(query),
    customerSummary(),
  ]);

  const params: Record<string, string | undefined> = {
    q: query.q,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has booked a trip, with their history and lifetime value."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={summary.total}
          icon={<Users className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="New this month"
          value={summary.added}
          icon={<UserPlus className="h-4 w-4" />}
          tone="purple"
          hint="Added in the last 30 days"
        />
        <StatCard
          label="Repeat travellers"
          value={summary.repeat}
          icon={<RefreshCcw className="h-4 w-4" />}
          tone="green"
          hint={
            summary.withBookings > 0
              ? `of ${summary.withBookings} who have booked`
              : "Nobody has booked twice yet"
          }
        />
        <StatCard
          label="Travelling soon"
          value={summary.travelling}
          icon={<Plane className="h-4 w-4" />}
          tone="amber"
          hint="Have a trip yet to depart"
        />
      </div>

      <FilterBar>
        <div className="min-w-[220px] flex-1">
          <FilterLabel htmlFor="q">Search</FilterLabel>
          <Input
            inputSize="sm"
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Name, email or phone"
          />
        </div>

        <div>
          <FilterLabel htmlFor="sort">Sort</FilterLabel>
          <Select inputSize="sm" id="sort" name="sort" defaultValue={query.sort}>
            <option value="newest">Newest first</option>
            <option value="name">Name</option>
            <option value="spend">Highest spend</option>
            <option value="bookings">Most trips</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {query.q && (
          <a href="/admin/customers" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        <CustomerTable
          filtered={Boolean(query.q)}
          customers={rows.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            location: customer.location,
            bookings: customer.bookings,
            totalSpend: customer.totalSpend,
            currency: customer.currency,
            lastTripAt: customer.lastTripAt?.toISOString() ?? null,
            createdAt: customer.createdAt.toISOString(),
            status: customer.status,
          }))}
        />
      </Card>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/customers"
        params={params}
        unit="customer"
      />
    </div>
  );
}
