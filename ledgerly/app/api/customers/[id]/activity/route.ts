import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/data";
import { listAccountActivity } from "@/lib/payment-promise";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const activities = await listAccountActivity(id);
  return NextResponse.json({ customerId: id, activities });
}
