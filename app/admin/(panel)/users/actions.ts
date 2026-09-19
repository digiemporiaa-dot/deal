"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { ROLES } from "@/lib/permissions";
import { strongPassword } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

const roleEnum = z.enum(ROLES as [string, ...string[]]);

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Valid email required").max(200),
  password: strongPassword,
  role: roleEnum,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: strongPassword.optional().or(z.literal("")),
});

/** Only roles carrying `users:manage` may touch accounts. */
function requireUserManager() {
  return guardAction("users:manage");
}

async function countOtherActiveSuperAdmins(excludeId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, NOT: { id: excludeId } },
  });
}

export async function createUser(input: z.infer<typeof createUserSchema>): Promise<ActionResult> {
  const guard = await requireUserManager();
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check the form." };
  }
  const d = parsed.data;

  // Only a Super Admin can mint another Super Admin — an ADMIN must not be
  // able to promote itself sideways into the unrestricted role.
  if (d.role === "SUPER_ADMIN" && guard.actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a Super Admin can create another Super Admin." };
  }

  const email = d.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with this email already exists." };

  try {
    const passwordHash = await hashPassword(d.password);
    const created = await prisma.user.create({
      data: { name: d.name, email, passwordHash, role: d.role, isActive: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "User",
      entityId: created.id,
      description: `Created user ${created.name} (${d.role})`,
      metadata: { email, role: d.role },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.createUser").message };
  }
}

export async function updateUser(id: string, input: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  const guard = await requireUserManager();
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check the form." };
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "User not found." };

  const isSelf = guard.actor.id === id;

  // Neither creating nor promoting into SUPER_ADMIN is open to an ADMIN, and
  // an ADMIN cannot edit a SUPER_ADMIN account at all.
  if (guard.actor.role !== "SUPER_ADMIN") {
    if (d.role === "SUPER_ADMIN") {
      return { ok: false, error: "Only a Super Admin can grant the Super Admin role." };
    }
    if (target.role === "SUPER_ADMIN") {
      return { ok: false, error: "Only a Super Admin can change a Super Admin account." };
    }
  }

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
    if (d.name) data.name = d.name;
    if (d.role) data.role = d.role;
    if (typeof d.isActive === "boolean") data.isActive = d.isActive;
    if (d.password) data.passwordHash = await hashPassword(d.password);

    await prisma.user.update({ where: { id }, data });

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      description: `Updated user ${target.name}`,
      // The password itself is never recorded — only that it was rotated.
      metadata: {
        ...(d.role && d.role !== target.role ? { role: { from: target.role, to: d.role } } : {}),
        ...(typeof d.isActive === "boolean" && d.isActive !== target.isActive
          ? { isActive: { from: target.isActive, to: d.isActive } }
          : {}),
        ...(d.password ? { passwordReset: true } : {}),
      },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.updateUser", { id }).message };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const guard = await requireUserManager();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (guard.actor.id === id) return { ok: false, error: "You cannot delete your own account." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === "SUPER_ADMIN" && guard.actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a Super Admin can delete a Super Admin account." };
  }

  if (target.role === "SUPER_ADMIN" && target.isActive && (await countOtherActiveSuperAdmins(id)) === 0) {
    return { ok: false, error: "There must always be at least one active Super Admin." };
  }

  try {
    await prisma.user.delete({ where: { id } });

    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "User",
      entityId: id,
      description: `Deleted user ${target.name}`,
      metadata: { email: target.email, role: target.role },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    toSafeError(err, "action.deleteUser", { id });
    return {
      ok: false,
      error:
        "Could not delete this user. If they have written blog posts or lead notes, disable the account instead.",
    };
  }
}
