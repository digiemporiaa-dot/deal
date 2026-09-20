import { CalendarCheck, CheckCircle2, IndianRupee, Plane } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { listBookings, bookingSummary } from "@/lib/services/sales";
import { bookingQuerySchema } from "@/lib/validation";
import {
  PageHeader,
  Card,
  FilterBar,
  Pagination,
  StatCard,
  buttonClasses,
} from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { BookingTable } from "@/components/admin/BookingTable";
import { humanStatus } from "@/lib/admin-status";
import { formatCurrency, toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const BOOKING_STATUSES = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

/**
 * The bookings list.
 *
 * Filtering, sorting and paging all happen in the database; the page never
 * holds more than one page of rows. The summary tiles reflect the *filtered*
 * set, so narrowing to a destination also narrows the totals above it —
 * headline figures that ignored the filter would be actively misleading.
 */
export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("bookings:view");

  const raw = await searchParams;
  const parsed = bookingQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    payment: first(raw.payment),
    destination: first(raw.destination),
    upcoming: first(raw.upcoming),
    from: first(raw.from),
    to: first(raw.to),
    sort: first(raw.sort) ?? "newest",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : bookingQuerySchema.parse({});

  const [{ rows, total, page, pageCount }, summary, destinations] = await Promise.all([
    listBookings(query),
    bookingSummary(query),
    prisma.destination.findMany({
      where: { packages: { some: { bookings: { some: {} } } } },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const currency = rows[0]?.currency ?? "INR";

  const params: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    payment: query.payment,
    destination: query.destination,
    upcoming: query.upcoming,
    from: query.from || undefined,
    to: query.to || undefined,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  const filtered = Object.entries(params).some(
    ([key, value]) => value && key !== "sort" && key !== "perPage",
  );

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Every trip sold, with its payment and operational status."
        meta={
          query.upcoming === "1"
            ? "Showing trips that have not departed yet"
            : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={filtered ? "Matching bookings" : "Total bookings"}
          value={summary.total}
          icon={<CalendarCheck className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="Confirmed"
          value={summary.confirmed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
        />
        <StatCard
          label="Yet to depart"
          value={summary.upcoming}
          icon={<Plane className="h-4 w-4" />}
          tone="purple"
          href="/admin/bookings?upcoming=1"
        />
        <StatCard
          label="Booked value"
          value={formatCurrency(summary.value, currency)}
          icon={<IndianRupee className="h-4 w-4" />}
          tone="green"
          hint="Excludes cancelled bookings"
        />
      </div>

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <FilterLabel htmlFor="q">Search</FilterLabel>
          <Input
            inputSize="sm"
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Booking number, customer or package"
          />
        </div>

        <div>
          <FilterLabel htmlFor="status">Status</FilterLabel>
          <Select inputSize="sm" id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanStatus(status)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="payment">Payment</FilterLabel>
          <Select inputSize="sm" id="payment" name="payment" defaultValue={query.payment ?? ""}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanStatus(status)}
              </option>
            ))}
          </Select>
        </div>

        {destinations.length > 0 && (
          <div>
            <FilterLabel htmlFor="destination">Destination</FilterLabel>
            <Select
              inputSize="sm"
              id="destination"
              name="destination"
              defaultValue={query.destination ?? ""}
            >
              <option value="">All</option>
              {destinations.map((destination) => (
                <option key={destination.slug} value={destination.slug}>
                  {destination.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <FilterLabel htmlFor="from">Booked from</FilterLabel>
          <Input
            inputSize="sm"
            id="from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="w-[140px]"
          />
        </div>

        <div>
          <FilterLabel htmlFor="to">To</FilterLabel>
          <Input
            inputSize="sm"
            id="to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="w-[140px]"
          />
        </div>

        <div>
          <FilterLabel htmlFor="sort">Sort</FilterLabel>
          <Select inputSize="sm" id="sort" name="sort" defaultValue={query.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="travel">Travel date</option>
            <option value="amount">Highest value</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtered && (
          <a href="/admin/bookings" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        <BookingTable
          filtered={filtered}
          bookings={rows.map((booking) => ({
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            createdAt: booking.createdAt.toISOString(),
            travelDate: booking.travelDate.toISOString(),
            travellers: `${booking.adults} adult${booking.adults === 1 ? "" : "s"}${
              booking.children > 0
                ? `, ${booking.children} child${booking.children === 1 ? "" : "ren"}`
                : ""
            }`,
            totalAmount: toNumber(booking.totalAmount),
            remainingAmount: toNumber(booking.remainingAmount),
            currency: booking.currency,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            customerName: booking.customer.name,
            customerEmail: booking.customer.email,
            packageName: booking.package.name,
            destination: booking.package.destination.name,
          }))}
        />
      </Card>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/bookings"
        params={params}
        unit="booking"
      />
    </div>
  );
}
