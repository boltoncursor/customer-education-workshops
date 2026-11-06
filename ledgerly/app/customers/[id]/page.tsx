import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentPromiseForm } from "@/components/payment-promise-form";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_OPERATOR } from "@/lib/demo-session";
import { getCustomer } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { listAccountActivity, promiseStatusLabel } from "@/lib/payment-promise";
import { isPlanId, planLabel } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  return { title: customer ? customer.name : "Account" };
}

export default async function CustomerAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const invoices = [...customer.invoices].sort((left, right) => {
    if (left.status === "OVERDUE" && right.status !== "OVERDUE") return -1;
    if (right.status === "OVERDUE" && left.status !== "OVERDUE") return 1;
    return left.dueOn.getTime() - right.dueOn.getTime();
  });
  const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE" && isPlanId(invoice.plan));
  const activities = await listAccountActivity(customer.id);
  const planName = isPlanId(customer.plan) ? planLabel(customer.plan) : customer.plan;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        eyebrow="Account"
        title={customer.name}
        description={`${customer.contactName} · ${customer.email} · ${planName}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            A promise does not change what is owed. Overdue invoices stay overdue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices on this account.</p>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="space-y-1">
                  <Link href={`/invoices/${invoice.id}`} className="font-mono text-xs hover:underline">
                    {invoice.number}
                  </Link>
                  <p className="text-muted-foreground">Due {formatDate(invoice.dueOn)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-medium">{formatUsd(invoice.totalCents)}</p>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment promise</CardTitle>
          <CardDescription>
            {overdue.length > 0
              ? `The date the customer said they will pay. Taken by ${DEMO_OPERATOR.name}.`
              : "No overdue invoice on this account."}
          </CardDescription>
        </CardHeader>
        {overdue.length > 0 ? (
          <CardContent>
            <PaymentPromiseForm
              takenBy={DEMO_OPERATOR.name}
              invoices={overdue.map((invoice) => ({
                id: invoice.id,
                number: invoice.number,
                planLabel: planLabel(invoice.plan),
                totalCents: invoice.totalCents,
              }))}
            />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Newest first. A replaced promise stays in the history.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity on this account yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {activities.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.promiseStatus === "open" ? "warning" : "muted"}>
                      {promiseStatusLabel(item.promiseStatus)}
                    </Badge>
                    <InvoiceStatusBadge status={item.invoiceStatus} />
                    <span className="font-mono text-xs text-muted-foreground">{item.invoiceNumber}</span>
                    <span className="text-sm font-medium">{formatUsd(item.invoiceTotalCents)}</span>
                  </div>
                  <p className="mt-2 text-sm">Promised {formatDate(item.promisedOn)}</p>
                  <p className="mt-1 text-sm">{item.note}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.actorName}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
