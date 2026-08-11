"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ROLES = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "BOOKING_MANAGER"] as const;

const createUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional().or(z.literal("")),
});

/** Only SUPER_ADMIN and ADMIN may manage users. */
async function requireUserManager() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") return null;
  return session;
}

async function countOtherActiveSuperAdmins(excludeId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, NOT: { id: excludeId } },
  });
}

export async function createUser(input: z.infer<typeof createUserSchema>): Promise<ActionResult> {
  const session = await requireUserManager();
  if (!session) return { ok: false, error: "You are not allowed to manage users." };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check the form." };
  }
  const d = parsed.data;

  const email = d.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with this email already exists." };

  try {
    const passwordHash = await bcrypt.hash(d.password, 10);
    await prisma.user.create({
      data: { name: d.name.trim(), email, passwordHash, role: d.role, isActive: true },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    console.error("[createUser]", err);
    return { ok: false, error: "Something went wrong while creating the user." };
  }
}

export async function updateUser(id: string, input: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  const session = await requireUserManager();
  if (!session) return { ok: false, error: "You are not allowed to manage users." };

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check the form." };
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "User not found." };

  const isSelf = session.user.id === id;

  // Safety rails so the admin panel can never be locked out.
  if (isSelf && d.isActive === false) {
    return { ok: false, error: "You cannot disable your own account." };
  }
  if (isSelf && d.role && d.role !== target.role) {
    return { ok: false, error: "You cannot change your own role." };
  }
  if (target.role === "SUPER_ADMIN" && target.isActive) {
    const losingSuperAdmin =
      (d.role && d.role !== "SUPER_ADMIN") || d.isActive === false;
    if (losingSuperAdmin && (await countOtherActiveSuperAdmins(id)) === 0) {
      return { ok: false, error: "There must always be at least one active Super Admin." };
    }
  }

  try {
    const data: {
      name?: string;
      role?: string;
      isActive?: boolean;
      passwordHash?: string;
    } = {};
    if (d.name) data.name = d.name.trim();
    if (d.role) data.role = d.role;
    if (typeof d.isActive === "boolean") data.isActive = d.isActive;
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);

    await prisma.user.update({ where: { id }, data });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    console.error("[updateUser]", err);
    return { ok: false, error: "Something went wrong while updating the user." };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await requireUserManager();
  if (!session) return { ok: false, error: "You are not allowed to manage users." };

  if (session.user.id === id) return { ok: false, error: "You cannot delete your own account." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === "SUPER_ADMIN" && target.isActive && (await countOtherActiveSuperAdmins(id)) === 0) {
    return { ok: false, error: "There must always be at least one active Super Admin." };
  }

  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    console.error("[deleteUser]", err);
    return { ok: false, error: "Could not delete this user. If they have written blog posts or lead notes, disable the account instead." };
  }
}
