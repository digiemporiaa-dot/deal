import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
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
import { DestinationRowActions } from "@/components/admin/DestinationRowActions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* eslint-disable-next-line @next/next/no-img-element -- a destination's cover
   is whatever URL an admin pasted or picked from the library; next/image
   throws at request time for a host that is not in remotePatterns, which
   would take the whole list down over one bad row. */
function Cover({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-control bg-admin-muted text-admin-text-subtle">
        <MapPin className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="h-9 w-12 shrink-0 rounded-control object-cover"
    />
  );
}

export default async function AdminDestinationsPage({ searchParams }: { searchParams: SearchParams }) {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("destinations:view");

  const raw = await searchParams;
  const parsed = catalogueQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    sort: first(raw.sort) ?? "name",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : catalogueQuerySchema.parse({ sort: "name" });

  const where: Prisma.DestinationWhereInput = {};
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { country: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.status === "published") where.isPublished = true;
  if (query.status === "draft") where.isPublished = false;
  if (query.status === "featured") where.isFeatured = true;

  const [destinations, total, mayCreate] = await Promise.all([
    prisma.destination.findMany({
      where,
      orderBy: query.sort === "newest" ? { createdAt: "desc" } : query.sort === "updated" ? { updatedAt: "desc" } : { name: "asc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: {
        id: true,
        name: true,
        country: true,
        state: true,
        coverImage: true,
        isPublished: true,
        isFeatured: true,
        updatedAt: true,
        _count: { select: { packages: true } },
      },
    }),
    prisma.destination.count({ where }),
    can("destinations:create"),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / query.perPage));
  const filtered = Boolean(query.q || query.status);

  const params: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  return (
    <div>
      <PageHeader
        title="Destinations"
        description="The places you sell, and the packages grouped under them."
        action={
          mayCreate && (
            <AdminButtonLink href="/admin/destinations/new">
              <Plus className="h-4 w-4" /> New destination
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
            placeholder="Destination or country"
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
          <FilterLabel htmlFor="sort">Sort</FilterLabel>
          <Select inputSize="sm" id="sort" name="sort" defaultValue={query.sort}>
            <option value="name">Name</option>
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtered && (
          <a href="/admin/destinations" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        {destinations.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={<MapPin className="h-5 w-5" />}
            title={filtered ? "No destinations match these filters" : "No destinations yet"}
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : "Add a destination first — packages are grouped under one."
            }
            action={
              filtered ? (
                <Link href="/admin/destinations" className={buttonClasses("outline", "sm")}>
                  Clear filters
                </Link>
              ) : mayCreate ? (
                <AdminButtonLink href="/admin/destinations/new" size="sm">
                  <Plus className="h-3.5 w-3.5" /> New destination
                </AdminButtonLink>
              ) : undefined
            }
          />
        ) : (
          <TableWrap minWidth={720}>
            <Thead>
              <tr>
                <Th>Destination</Th>
                <Th>Country</Th>
                <Th align="right">Packages</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {destinations.map((destination) => (
                <tr key={destination.id} className="hover:bg-admin-bg">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Cover src={destination.coverImage} alt="" />
                      <span className="min-w-0">
                        <Link
                          href={`/admin/destinations/${destination.id}/edit`}
                          className="block max-w-[220px] truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
                        >
                          {destination.name}
                        </Link>
                        {destination.state && (
                          <span className="block text-[11px] text-admin-text-subtle">
                            {destination.state}
                          </span>
                        )}
                      </span>
                    </span>
                  </Td>
                  <Td className="text-[13px]">{destination.country}</Td>
                  <Td align="right" className="tabular-nums">
                    {destination._count.packages}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge tone={destination.isPublished ? "green" : "slate"} dot>
                        {destination.isPublished ? "Published" : "Draft"}
                      </StatusBadge>
                      {destination.isFeatured && <StatusBadge tone="amber">Featured</StatusBadge>}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px]">
                    {formatDate(destination.updatedAt)}
                  </Td>
                  <Td align="right">
                    <DestinationRowActions
                      id={destination.id}
                      name={destination.name}
                      published={destination.isPublished}
                      featured={destination.isFeatured}
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
        basePath="/admin/destinations"
        params={params}
        unit="destination"
      />
    </div>
  );
}
