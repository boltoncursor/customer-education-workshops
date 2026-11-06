import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerEmailField } from "@/components/customer-email-field";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge, DisputeStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftCollectionNote } from "@/lib/collection-note";
import { DEMO_AS_OF } from "@/lib/clock";
import { getInvoice } from "@/lib/data";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { isPlanId, planLabel } from "@/lib/plans";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice ? invoice.number : "Invoice" };
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  if (!isPlanId(invoice.plan)) notFound();

  const daysPastDue =
    invoice.status === "OVERDUE" ? Math.max(0, daysBetween(DEMO_AS_OF, invoice.dueOn)) : 0;
  const noteDraft = draftCollectionNote({
    customerName: invoice.customer.name,
    daysPastDue,
    plan: invoice.plan,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        eyebrow={invoice.number}
        title={invoice.customer.name}
        description={`${planLabel(invoice.plan)} · issued ${formatDate(invoice.issuedOn)} · due ${formatDate(invoice.dueOn)}`}
        actions={<InvoiceStatusBadge status={invoice.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
        <Card className="overflow-hidden py-0">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Line items</CardTitle>
            <CardDescription>
              One catalog line. Tax is $0.00 in this workspace — do not invent a rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-4">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-2 font-medium">Description</th>
                  <th className="px-5 py-2 font-medium">Qty</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border">
                    <td className="px-5 py-3">{line.description}</td>
                    <td className="px-5 py-3">{line.quantity}</td>
                    <td className="px-5 py-3 text-right">{formatUsd(line.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 space-y-2 px-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatUsd(invoice.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatUsd(invoice.taxCents)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Total</dt>
                <dd>{formatUsd(invoice.totalCents)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{invoice.customer.contactName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <CustomerEmailField
                key={invoice.id}
                invoiceId={invoice.id}
                email={invoice.customer.email}
              />
              <p className="text-muted-foreground">Plan on file: {planLabel(invoice.plan)}</p>
            </CardContent>
          </Card>

          {invoice.disputes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.disputes.map((dispute) => (
                  <Link key={dispute.id} href={`/disputes/${dispute.id}`} className="block text-sm hover:underline">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{dispute.id}</span>
                      <DisputeStatusBadge status={dispute.status} />
                    </div>
                    <p className="mt-1 text-muted-foreground">{dispute.reason}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collection note</CardTitle>
          <CardDescription>
            {/* TODO(cmd-k): rewrite this helper in the operator's voice. Keep the plan name. Do not add a dollar amount. */}
            Draft sits unfinished on purpose — inline-edit this copy, then finish the sentence in{" "}
            <span className="font-mono text-foreground">lib/collection-note.ts</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="collection-note">Note to {invoice.customer.contactName}</Label>
          <Textarea
            id="collection-note"
            defaultValue={invoice.collectionNote || noteDraft}
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled>
              Save note
            </Button>
            <Button asChild variant="outline">
              <Link href="/invoices">Back to list</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
