import { randomUUID } from "node:crypto";
import { DEMO_AS_OF, demoDay } from "@/lib/clock";
import { DEMO_OPERATOR } from "@/lib/demo-session";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { invoiceStatusLabel } from "@/lib/status";

export const PROMISE_STATUSES = ["open", "replaced"] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const ACTIVITY_PROMISE = "PAYMENT_PROMISE";
const NOTE_MAX = 280;

export type AccountActivityItem = {
  id: string;
  type: typeof ACTIVITY_PROMISE;
  actorName: string;
  note: string;
  promisedOn: string;
  amountCents: number;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceTotalCents: number;
  promiseStatus: PromiseStatus;
  createdAt: string;
};

export type SavedPromise = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  promisedOn: string;
  takenBy: string;
  note: string;
  amountCents: number;
  status: "open";
  replacedPromiseId: string | null;
};

type SaveFailure = { ok: false; status: 400 | 404; error: string };
type SaveSuccess = {
  ok: true;
  promise: SavedPromise;
  invoice: { id: string; status: string; totalCents: number; subtotalCents: number };
};

export function promiseStatusLabel(status: PromiseStatus): string {
  switch (status) {
    case "open":
      return "Open promise";
    case "replaced":
      return "Replaced";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function calendarDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseCalendarDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function asPromiseStatus(value: string): PromiseStatus {
  if (value === "open" || value === "replaced") return value;
  throw new Error(`Unknown promise status "${value}".`);
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export async function listAccountActivity(customerId: string): Promise<AccountActivityItem[]> {
  const rows = await prisma.accountActivity.findMany({
    where: { customerId, type: ACTIVITY_PROMISE },
    include: { promise: true, invoice: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: ACTIVITY_PROMISE,
    actorName: row.actorName,
    note: row.note,
    promisedOn: calendarDay(row.promisedOn),
    amountCents: row.amountCents,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice.number,
    invoiceStatus: row.invoice.status,
    invoiceTotalCents: row.invoice.totalCents,
    promiseStatus: asPromiseStatus(row.promise.status),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function savePaymentPromise(
  invoiceId: string,
  body: unknown,
): Promise<SaveSuccess | SaveFailure> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return { ok: false, status: 404, error: "Invoice not found" };
  }

  if (body === null || typeof body !== "object") {
    return { ok: false, status: 400, error: "Send a promised date and a short note." };
  }

  const record = body as { promisedOn?: unknown; note?: unknown };
  const promisedOn = parseCalendarDay(record.promisedOn);
  if (!promisedOn) {
    return {
      ok: false,
      status: 400,
      error: "Enter the date the customer said they will pay, as YYYY-MM-DD.",
    };
  }
  if (promisedOn < calendarDay(DEMO_AS_OF)) {
    return {
      ok: false,
      status: 400,
      error: `Promised date ${formatDate(demoDay(promisedOn))} is in the past. The demo clock is ${formatDate(DEMO_AS_OF)}.`,
    };
  }

  const note = typeof record.note === "string" ? record.note.trim() : "";
  if (!note) {
    return { ok: false, status: 400, error: "Add a short note for the promise." };
  }
  if (note.length > NOTE_MAX) {
    return { ok: false, status: 400, error: "Keep the note to 280 characters or fewer." };
  }

  if (invoice.status !== "OVERDUE") {
    if (invoice.status === "PAID") {
      return {
        ok: false,
        status: 400,
        error: `Invoice ${invoice.number} is already paid. A promise is not a payment.`,
      };
    }
    const label = invoiceStatusLabel(invoice.status).toLowerCase();
    return {
      ok: false,
      status: 400,
      error: `Invoice ${invoice.number} is ${label}, not overdue. A promise can only be saved on an overdue invoice.`,
    };
  }

  // A promise records what the customer said. It must not settle the invoice or change the catalog total.
  const saved = await prisma.$transaction(async (tx) => {
    const open = await tx.paymentPromise.findFirst({
      where: { invoiceId: invoice.id, status: "open" },
    });
    if (open) {
      await tx.paymentPromise.update({
        where: { id: open.id },
        data: { status: "replaced", replacedAt: new Date() },
      });
    }

    const promise = await tx.paymentPromise.create({
      data: {
        id: newId("prm"),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        promisedOn: demoDay(promisedOn),
        takenBy: DEMO_OPERATOR.name,
        note,
        amountCents: invoice.totalCents,
        status: "open",
      },
    });

    await tx.accountActivity.create({
      data: {
        id: newId("act"),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        promiseId: promise.id,
        type: ACTIVITY_PROMISE,
        actorName: DEMO_OPERATOR.name,
        note,
        promisedOn: demoDay(promisedOn),
        amountCents: invoice.totalCents,
      },
    });

    return { promise, replacedPromiseId: open?.id ?? null };
  });

  const current = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });

  return {
    ok: true,
    promise: {
      id: saved.promise.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerId: invoice.customerId,
      promisedOn,
      takenBy: DEMO_OPERATOR.name,
      note,
      amountCents: invoice.totalCents,
      status: "open",
      replacedPromiseId: saved.replacedPromiseId,
    },
    invoice: {
      id: current.id,
      status: current.status,
      totalCents: current.totalCents,
      subtotalCents: current.subtotalCents,
    },
  };
}
