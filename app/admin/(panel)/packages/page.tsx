import Link from "next/link";
import { Package as PackageIcon, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission, can } from "@/lib/guard";
import { catalogueQuerySchema } from "@/lib/validation";
import {
  PageHeader,
  Card,
  FilterBar,
  Pagination,
  StatusBadge,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  EmptyState,
  AdminButtonLink,
  buttonClasses,
} from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { PackageRowActions } from "@/components/admin/PackageRowActions";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ORDER: Record<string, Prisma.TravelPackageOrderByWithRelationInput> = {
  updated: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  name: { name: "asc" },
  price: { startingPrice: "desc" },
  bookings: { bookings: { _count: "desc" } },
};

export default async function AdminPackagesPage({ searchParams }: { searchParams: SearchParams }) {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("packages:view");

  const raw = await searchParams;
  const parsed = catalogueQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    destination: first(raw.destination),
    sort: first(raw.sort) ?? "updated",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : catalogueQuerySchema.parse({});

  const where: Prisma.TravelPackageWhereInput = {};
  if (query.q) where.name = { contains: query.q, mode: "insensitive" };
  if (query.status === "published") where.published = true;
  if (query.status === "draft") where.published = false;
  if (query.status === "featured") where.featured = true;
  if (query.destination) where.destination = { slug: query.destination };

  const [packages, total, destinations, mayCreate] = await Promise.all([
    prisma.travelPackage.findMany({
      where,
      orderBy: ORDER[query.sort] ?? ORDER.updated,
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        startingPrice: true,
        discountPrice: true,
        durationDays: true,
        durationNights: true,
        published: true,
        featured: true,
        updatedAt: true,
        destination: { select: { name: true } },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.travelPackage.count({ where }),
    prisma.destination.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    can("packages:create"),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / query.perPage));

  const params: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    destination: query.destination,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  const filtered = Boolean(query.q || query.status || query.destination);

  return (
    <div>
      <PageHeader
        title="Packages"
        description="The itineraries customers can book."
        action={
          mayCreate && (
            <AdminButtonLink href="/admin/packages/new">
              <Plus className="h-4 w-4" /> New package
            </AdminButtonLink>
          )
        }
      />

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <FilterLabel htmlFor="q">Search</FilterLabel>
          <Input
            inputSize="sm"
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Package name"
          />
        </div>

        <div>
          <FilterLabel htmlFor="status">Status</FilterLabel>
          <Select inputSize="sm" id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="featured">Featured</option>
          </Select>
        </div>

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

        <div>
          <FilterLabel htmlFor="sort">Sort</FilterLabel>
          <Select inputSize="sm" id="sort" name="sort" defaultValue={query.sort}>
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="price">Highest price</option>
            <option value="bookings">Most booked</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtered && (
          <a href="/admin/packages" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        {packages.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={<PackageIcon className="h-5 w-5" />}
            title={filtered ? "No packages match these filters" : "No packages yet"}
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : "Create your first package to start taking bookings."
            }
            action={
              filtered ? (
                <Link href="/admin/packages" className={buttonClasses("outline", "sm")}>
                  Clear filters
                </Link>
              ) : mayCreate ? (
                <AdminButtonLink href="/admin/packages/new" size="sm">
                  <Plus className="h-3.5 w-3.5" /> New package
                </AdminButtonLink>
              ) : undefined
            }
          />
        ) : (
          <TableWrap minWidth={860}>
            <Thead>
              <tr>
                <Th>Package</Th>
                <Th>Destination</Th>
                <Th>Duration</Th>
                <Th align="right">From</Th>
                <Th align="right">Bookings</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {packages.map((item) => (
                <tr key={item.id} className="hover:bg-admin-bg">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-admin-muted text-admin-text-subtle">
                        <PackageIcon className="h-4 w-4" />
                      </span>
                      <Link
                        href={`/admin/packages/${item.id}/edit`}
                        className="max-w-[240px] truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
                      >
                        {item.name}
                      </Link>
                    </span>
                  </Td>
                  <Td className="text-[13px]">{item.destination.name}</Td>
                  <Td className="whitespace-nowrap text-[12px]">
                    {item.durationDays}D / {item.durationNights}N
                  </Td>
                  <Td align="right" className="font-semibold tabular-nums text-admin-text">
                    {formatCurrency(
                      toNumber(item.discountPrice ?? item.startingPrice),
                      item.currency,
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {item._count.bookings}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge tone={item.published ? "green" : "slate"} dot>
                        {item.published ? "Published" : "Draft"}
                      </StatusBadge>
                      {item.featured && <StatusBadge tone="amber">Featured</StatusBadge>}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px]">{formatDate(item.updatedAt)}</Td>
                  <Td align="right">
                    <PackageRowActions
                      id={item.id}
                      name={item.name}
                      slug={item.slug}
                      published={item.published}
                      featured={item.featured}
                    />
                  </Td>
                </tr>
              ))}
            </Tbody>
          </TableWrap>
        )}
      </Card>

      <Pagination
        page={query.page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/packages"
        params={params}
        unit="package"
      />
    </div>
  );
}
