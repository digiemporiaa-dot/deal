import Link from "next/link";
import { FileText, Plus } from "lucide-react";
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
import { BlogRowActions } from "@/components/admin/BlogRowActions";
import { humanStatus } from "@/lib/admin-status";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBlogsPage({ searchParams }: { searchParams: SearchParams }) {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("blogs:view");

  const raw = await searchParams;
  const parsed = catalogueQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    sort: first(raw.sort) ?? "newest",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });
  const query = parsed.success ? parsed.data : catalogueQuerySchema.parse({ sort: "newest" });

  const where: Prisma.BlogPostWhereInput = {};
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { slug: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.status === "published") where.status = "PUBLISHED";
  if (query.status === "draft") where.status = { not: "PUBLISHED" };
  if (query.status === "featured") where.featured = true;

  const [posts, total, mayCreate] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: query.sort === "name" ? { title: "asc" } : query.sort === "updated" ? { updatedAt: "desc" } : { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        featured: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.blogPost.count({ where }),
    can("blogs:create"),
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
        title="Blog"
        description="Travel guides and articles — the top of the funnel for organic traffic."
        action={
          mayCreate && (
            <AdminButtonLink href="/admin/blogs/new">
              <Plus className="h-4 w-4" /> New post
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
            placeholder="Title or slug"
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
            <option value="newest">Newest</option>
            <option value="updated">Recently updated</option>
            <option value="name">Title</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtered && (
          <a href="/admin/blogs" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

      <Card className="overflow-hidden p-0">
        {posts.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={<FileText className="h-5 w-5" />}
            title={filtered ? "No posts match these filters" : "No posts yet"}
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : "Travel guides and tips are how most visitors find the site in the first place."
            }
            action={
              filtered ? (
                <Link href="/admin/blogs" className={buttonClasses("outline", "sm")}>
                  Clear filters
                </Link>
              ) : mayCreate ? (
                <AdminButtonLink href="/admin/blogs/new" size="sm">
                  <Plus className="h-3.5 w-3.5" /> New post
                </AdminButtonLink>
              ) : undefined
            }
          />
        ) : (
          <TableWrap minWidth={760}>
            <Thead>
              <tr>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Author</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th align="right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-admin-bg">
                  <Td>
                    <Link
                      href={`/admin/blogs/${post.id}/edit`}
                      className="block max-w-[320px] truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
                    >
                      {post.title}
                    </Link>
                    <span className="block max-w-[320px] truncate text-[11px] text-admin-text-subtle">
                      /blog/{post.slug}
                    </span>
                  </Td>
                  <Td className="text-[13px]">{post.category?.name || "—"}</Td>
                  <Td className="text-[13px]">{post.author?.name || "—"}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge tone={post.status === "PUBLISHED" ? "green" : "slate"} dot>
                        {humanStatus(post.status)}
                      </StatusBadge>
                      {post.featured && <StatusBadge tone="amber">Featured</StatusBadge>}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px]">{formatDate(post.createdAt)}</Td>
                  <Td align="right">
                    <BlogRowActions
                      id={post.id}
                      title={post.title}
                      slug={post.slug}
                      published={post.status === "PUBLISHED"}
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
        basePath="/admin/blogs"
        params={params}
        unit="post"
      />
    </div>
  );
}
