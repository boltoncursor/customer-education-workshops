import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getActivity } from "@/app/api/customers/[id]/activity/route";
import { POST as postPromise } from "@/app/api/invoices/[id]/payment-promises/route";
import { DEMO_OPERATOR } from "@/lib/demo-session";
import { PLAN_PRICE_CENTS } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const OVERDUE_INVOICE = "inv_1043";
const PAID_INVOICE = "inv_1042";
const ACCOUNT = "cus_quarrypine";

function post(id: string, body: unknown) {
  return postPromise(
    new Request(`http://localhost/api/invoices/${id}/payment-promises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function activity(customerId: string) {
  return getActivity(new Request(`http://localhost/api/customers/${customerId}/activity`), {
    params: Promise.resolve({ id: customerId }),
  });
}

async function cleanup() {
  await prisma.accountActivity.deleteMany({
    where: { invoiceId: { in: [OVERDUE_INVOICE, PAID_INVOICE] } },
  });
  await prisma.paymentPromise.deleteMany({
    where: { invoiceId: { in: [OVERDUE_INVOICE, PAID_INVOICE] } },
  });
}

beforeEach(cleanup);
afterEach(cleanup);

describe("payment promise API", () => {
  it("saves a promise on an overdue invoice and shows it on the account timeline", async () => {
    const note = "Cobalt will wire the balance on the 4th.";
    const response = await post(OVERDUE_INVOICE, {
      promisedOn: "2026-09-04",
      note,
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.promise).toMatchObject({
      invoiceId: OVERDUE_INVOICE,
      invoiceNumber: "INV-1043",
      customerId: ACCOUNT,
      promisedOn: "2026-09-04",
      takenBy: DEMO_OPERATOR.name,
      note,
      amountCents: PLAN_PRICE_CENTS.SCALE,
      status: "open",
      replacedPromiseId: null,
    });
    expect(body.invoice).toEqual({
      id: OVERDUE_INVOICE,
      status: "OVERDUE",
      totalCents: PLAN_PRICE_CENTS.SCALE,
      subtotalCents: PLAN_PRICE_CENTS.SCALE,
    });

    const feedResponse = await activity(ACCOUNT);
    const feed = await feedResponse.json();
    expect(feedResponse.status).toBe(200);
    expect(feed.activities).toHaveLength(1);
    expect(feed.activities[0]).toMatchObject({
      actorName: DEMO_OPERATOR.name,
      note,
      promisedOn: "2026-09-04",
      amountCents: PLAN_PRICE_CENTS.SCALE,
      invoiceId: OVERDUE_INVOICE,
      invoiceNumber: "INV-1043",
      invoiceStatus: "OVERDUE",
      invoiceTotalCents: PLAN_PRICE_CENTS.SCALE,
      promiseStatus: "open",
    });

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: OVERDUE_INVOICE } });
    expect(stored.status).toBe("OVERDUE");
    expect(stored.totalCents).toBe(PLAN_PRICE_CENTS.SCALE);
    expect(stored.paidOn).toBeNull();
  });

  it("replaces the open promise and keeps the earlier one in the timeline", async () => {
    const firstNote = "Cobalt will wire the balance on the 4th.";
    const secondNote = "Moved to the 15th after a second call.";
    const first = await post(OVERDUE_INVOICE, { promisedOn: "2026-09-04", note: firstNote });
    expect(first.status).toBe(201);
    const second = await post(OVERDUE_INVOICE, { promisedOn: "2026-09-15", note: secondNote });
    const secondBody = await second.json();

    expect(second.status).toBe(201);
    expect(secondBody.promise).toMatchObject({
      status: "open",
      note: secondNote,
      promisedOn: "2026-09-15",
      takenBy: DEMO_OPERATOR.name,
      amountCents: PLAN_PRICE_CENTS.SCALE,
    });
    expect(secondBody.promise.replacedPromiseId).toEqual(expect.any(String));
    expect(secondBody.invoice).toMatchObject({
      status: "OVERDUE",
      totalCents: PLAN_PRICE_CENTS.SCALE,
    });

    const feed = await (await activity(ACCOUNT)).json();
    expect(feed.activities).toHaveLength(2);
    expect(feed.activities[0]).toMatchObject({
      actorName: "Avery Quinn",
      note: secondNote,
      promisedOn: "2026-09-15",
      promiseStatus: "open",
      invoiceStatus: "OVERDUE",
      invoiceTotalCents: PLAN_PRICE_CENTS.SCALE,
    });
    expect(feed.activities[1]).toMatchObject({
      actorName: "Avery Quinn",
      note: firstNote,
      promisedOn: "2026-09-04",
      promiseStatus: "replaced",
      invoiceStatus: "OVERDUE",
      invoiceTotalCents: PLAN_PRICE_CENTS.SCALE,
    });

    const openCount = await prisma.paymentPromise.count({
      where: { invoiceId: OVERDUE_INVOICE, status: "open" },
    });
    expect(openCount).toBe(1);

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: OVERDUE_INVOICE } });
    expect(stored.status).toBe("OVERDUE");
    expect(stored.totalCents).toBe(PLAN_PRICE_CENTS.SCALE);
  });

  it("rejects a promise on a paid invoice", async () => {
    const response = await post(PAID_INVOICE, {
      promisedOn: "2026-09-04",
      note: "They said the July invoice was still open.",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invoice INV-1042 is already paid. A promise is not a payment.");
    expect(await prisma.paymentPromise.count({ where: { invoiceId: PAID_INVOICE } })).toBe(0);

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: PAID_INVOICE } });
    expect(stored.status).toBe("PAID");
    expect(stored.totalCents).toBe(PLAN_PRICE_CENTS.STARTER);
  });

  it("rejects a promised date in the past", async () => {
    const response = await post(OVERDUE_INVOICE, {
      promisedOn: "2026-08-01",
      note: "They said they would pay last week.",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/in the past/);
    expect(body.error).toContain("Aug 1, 2026");
    expect(await prisma.paymentPromise.count({ where: { invoiceId: OVERDUE_INVOICE } })).toBe(0);

    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: OVERDUE_INVOICE } });
    expect(stored.status).toBe("OVERDUE");
    expect(stored.totalCents).toBe(PLAN_PRICE_CENTS.SCALE);
  });
});
