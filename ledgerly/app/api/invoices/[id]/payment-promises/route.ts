import { NextResponse } from "next/server";
import { savePaymentPromise } from "@/lib/payment-promise";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const result = await savePaymentPromise(id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ promise: result.promise, invoice: result.invoice }, { status: 201 });
}
