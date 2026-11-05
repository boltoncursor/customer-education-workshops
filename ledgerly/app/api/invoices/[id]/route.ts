import { NextResponse } from "next/server";
import { getInvoice, updateInvoiceCustomerEmail } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

function emailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  const email = (body as { email: unknown }).email;
  if (typeof email !== "string") return null;
  return email;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const email = emailFromBody(body);
  if (email === null) {
    return NextResponse.json({ error: "email must be a string" }, { status: 400 });
  }

  const invoice = await updateInvoiceCustomerEmail(id, email);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}
