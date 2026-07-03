// lib/reps.ts
import { prisma } from "@/lib/prisma";

export type Rep = { id: string; name: string };

export function normRepName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

/** List all reps (sorted) */
export async function getAllReps(companyId: string): Promise<Rep[]> {
  const reps = await prisma.salesRep.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return reps;
}

/** Find (case-insensitive) or create and return the rep id for a name */
export async function getOrCreateRepIdByName(companyId: string, nameRaw: string): Promise<string | null> {
  const name = normRepName(nameRaw);
  if (!name) return null;

  // try exact first
  const exact = await prisma.salesRep.findFirst({ where: { companyId,  name } , select: { id: true }});
  if (exact) return exact.id;

  // try case-insensitive match
  const ci = await prisma.salesRep.findFirst({ where: { companyId,  name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (ci) return ci.id;

  const created = await prisma.salesRep.create({ data: { companyId, name }, select: { id: true } });
  return created.id;
}
