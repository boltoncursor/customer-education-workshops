import { afterEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/invoices/[id]/route";
import { prisma } from "@/lib/prisma";

const INVOICE_ID = "inv_1048";
const CUSTOMER_ID = "cus_mapleember";
const SEEDED_EMAIL = "hello@mapleember.example";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params(id),
  );
}

afterEach(async () => {
  await prisma.customer.update({
    where: { id: CUSTOMER_ID },
    data: { email: SEEDED_EMAIL },
  });
});

describe("invoice customer email", () => {
  it("saves the contact email on the invoice customer", async () => {
    const next = "accounts@mapleember.example";
    const response = await patch(INVOICE_ID, { email: next });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.customer.email).toBe(next);
    expect(body.invoice.id).toBe(INVOICE_ID);

    const stored = await prisma.customer.findUniqueOrThrow({ where: { id: CUSTOMER_ID } });
    expect(stored.email).toBe(next);

    const loaded = await GET(new Request(`http://localhost/api/invoices/${INVOICE_ID}`), params(INVOICE_ID));
    await expect(loaded.json()).resolves.toMatchObject({
      invoice: { id: INVOICE_ID, customer: { email: next } },
    });
  });

  it("stores a value that is not an email address", async () => {
    const unformatted = await patch(INVOICE_ID, { email: "front desk" });
    expect(unformatted.status).toBe(200);
    await expect(unformatted.json()).resolves.toMatchObject({
      invoice: { customer: { email: "front desk" } },
    });

    const cleared = await patch(INVOICE_ID, { email: "" });
    expect(cleared.status).toBe(200);
    await expect(cleared.json()).resolves.toMatchObject({
      invoice: { customer: { email: "" } },
    });
  });

  it("returns 404 when the invoice does not exist", async () => {
    const response = await patch("inv_missing", { email: "accounts@mapleember.example" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Invoice not found" });
  });

  it("rejects a body whose email is not a string", async () => {
    const invalidJson = await PATCH(
      new Request(`http://localhost/api/invoices/${INVOICE_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
      params(INVOICE_ID),
    );
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toEqual({ error: "Expected a JSON body" });

    for (const body of [{}, { email: 12 }, { email: null }]) {
      const response = await patch(INVOICE_ID, body);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "email must be a string" });
    }

    const stored = await prisma.customer.findUniqueOrThrow({ where: { id: CUSTOMER_ID } });
    expect(stored.email).toBe(SEEDED_EMAIL);
  });
});
