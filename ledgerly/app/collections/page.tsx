import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_AS_OF } from "@/lib/clock";
import { getInvoices } from "@/lib/data";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { isPlanId, planLabel } from "@/lib/plans";

export const metadata = {
  title: "Collections",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const overdue = (await getInvoices({ status: "OVERDUE" })).filter((invoice) =>
    isPlanId(invoice.plan),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow="Dunning"
        title="Collections"
        description="Overdue folios against the frozen 23 Aug 2026 clock. Amounts stay on the catalog — Starter $49, Growth $99, Scale $249."
      />

      {overdue.length === 0 ? (
        <EmptyState
          title="No overdue invoices"
          body="Nothing is past due in this book. Open invoices still sit on the invoice list."
          imageSrc="/images/empty-invoices.svg"
          imageAlt="Empty invoice folder illustration"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/invoices">Invoice list</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {overdue.map((invoice) => {
            const daysPastDue = Math.max(0, daysBetween(DEMO_AS_OF, invoice.dueOn));
            return (
              <Card key={invoice.id} className="transition-colors hover:bg-accent/40">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      <Link href={`/customers/${invoice.customer.id}`} className="hover:underline">
                        {invoice.customer.name}
                      </Link>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.number}
                      </Link>
                      {" · "}
                      {planLabel(invoice.plan)} · due {formatDate(invoice.dueOn)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {daysPastDue} {daysPastDue === 1 ? "day" : "days"} past due
                      {invoice.disputes.some(
                        (dispute) => dispute.status === "OPEN" || dispute.status === "NEEDS_REVIEW",
                      )
                        ? " · open dispute on file"
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-lg font-semibold tracking-tight">{formatUsd(invoice.totalCents)}</p>
                    <InvoiceStatusBadge status="OVERDUE" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
