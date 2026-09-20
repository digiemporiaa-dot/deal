import Link from "next/link";
import { AlertCircle, CheckCircle2, Undo2, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/guard";
import { listPayments, paymentSummary, paymentMethodOptions } from "@/lib/services/sales";
import { paymentQuerySchema } from "@/lib/validation";
import {
  PageHeader,
  Card,
  FilterBar,
  Pagination,
  StatCard,
  StatusBadge,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  EmptyState,
  buttonClasses,
} from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { paymentStatusTone, humanStatus } from "@/lib/admin-status";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const PAYMENT_STATUSES = ["CREATED", "PENDING", "PAID", "FAILED", "REFUNDED"];

/**
 * The payments ledger.
 *
 * Read-only by design: payments are created and settled by the Razorpay flow
 * and its webhook, and an admin screen that could edit a payment row would
 * let the ledger drift from the payment provider's own record. Refunds and
 * retries belong in the gateway, not here.
 *
 * "Outstanding" is read from the bookings rather than from this table — a
 * booking nobody has paid for has no payment row to count.
 */
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("bookings:view");

  const raw = await searchParams;
  const parsed = paymentQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    method: first(raw.method),
    from: first(raw.from),
    to: first(raw.to),
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : paymentQuerySchema.parse({});

  const [{ rows, total, page, pageCount }, summary, methods] = await Promise.all([
    listPayments(query),
    paymentSummary(query),
    paymentMethodOptions(),
  ]);

  const currency = rows[0]?.currency ?? "INR";
  const money = (amount: number) => formatCurrency(amount, currency);

  const params: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    method: query.method,
    from: query.from || undefined,
    to: query.to || undefined,
    perPage: String(query.perPage),
  };

  const filtered = Object.entries(params).some(([key, value]) => value && key !== "perPage");

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment attempt against a booking, as recorded by the gateway."
        meta="Read-only — refunds and retries are handled in the payment gateway."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={money(summary.collected)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
          hint={`${summary.collectedCount} settled payment${summary.collectedCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Outstanding"
          value={money(summary.outstanding)}
          icon={<Wallet className="h-4 w-4" />}
          tone="amber"
          hint={`${summary.outstandingCount} booking${summary.outstandingCount === 1 ? "" : "s"} awaiting payment`}
        />
        <StatCard
          label="Refunded"
          value={money(summary.refunded)}
          icon={<Undo2 className="h-4 w-4" />}
          tone="purple"
          hint={`${summary.refundedCount} refund${summary.refundedCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Failed attempts"
          value={summary.failed}
          icon={<AlertCircle className="h-4 w-4" />}
          tone={summary.failed > 0 ? "red" : "slate"}
          href={summary.failed > 0 ? "/admin/payments?status=FAILED" : undefined}
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
            placeholder="Payment id, booking number or customer"
          />
        </div>

        <div>
          <FilterLabel htmlFor="status">Status</FilterLabel>
          <Select inputSize="sm" id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanStatus(status)}
              </option>
            ))}
          </Select>
        </div>

        {methods.length > 0 && (
          <div>
            <FilterLabel htmlFor="method">Method</FilterLabel>
            <Select inputSize="sm" id="method" name="method" defaultValue={query.method ?? ""}>
              <option value="">All</option>
              {methods.map((method) => (
                <option key={method} value={method}>
                  {humanStatus(method)}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <FilterLabel htmlFor="from">From</FilterLabel>
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

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtered && (
          <a href="/admin/payments" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={<Wallet className="h-5 w-5" />}
            title={filtered ? "No payments match these filters" : "No payments yet"}
            description={
              filtered
                ? "Try widening the date range or clearing a filter."
                : "Payments appear here as soon as the first booking is paid for."
            }
            action={
              filtered ? (
                <Link href="/admin/payments" className={buttonClasses("outline", "sm")}>
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TableWrap minWidth={880}>
            <Thead>
              <tr>
                <Th>Payment</Th>
                <Th>Booking</Th>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th align="right">Date</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((payment) => (
                <tr key={payment.id} className="hover:bg-admin-bg">
                  <Td>
                    <span className="block max-w-[170px] truncate font-mono text-[11px] text-admin-text">
                      {payment.razorpayPaymentId ?? payment.razorpayOrderId ?? "—"}
                    </span>
                  </Td>

                  <Td>
                    <Link
                      href={`/admin/bookings?booking=${payment.booking.id}`}
                      className="block font-mono text-[12px] font-medium text-admin-text hover:text-brand-700"
                    >
                      {payment.booking.bookingNumber}
                    </Link>
                    <span className="block max-w-[180px] truncate text-[11px] text-admin-text-subtle">
                      {payment.booking.package.name}
                    </span>
                  </Td>

                  <Td className="text-[13px]">{payment.booking.customer.name}</Td>

                  <Td className="text-[12px]">
                    {payment.paymentMethod ? humanStatus(payment.paymentMethod) : "—"}
                  </Td>

                  <Td align="right" className="font-semibold tabular-nums text-admin-text">
                    {formatCurrency(toNumber(payment.amount), payment.currency)}
                  </Td>

                  <Td>
                    <StatusBadge tone={paymentStatusTone(payment.status)} dot>
                      {humanStatus(payment.status)}
                    </StatusBadge>
                  </Td>

                  <Td align="right" className="whitespace-nowrap text-[12px]">
                    {formatDate(payment.createdAt)}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </TableWrap>
        )}
      </Card>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/payments"
        params={params}
        unit="payment"
      />
    </div>
  );
}
