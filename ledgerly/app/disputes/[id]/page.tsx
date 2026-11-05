import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SuggestedCredit } from "@/components/disputes/suggested-credit";
import { DisputeStatusBadge, InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDispute } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { isPlanId, planLabel, planPriceCents } from "@/lib/plans";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dispute = await getDispute(id);
  return { title: dispute ? `Dispute ${dispute.id}` : "Dispute" };
}

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dispute = await getDispute(id);
  if (!dispute) notFound();
  if (!isPlanId(dispute.invoice.plan)) notFound();

  const catalogPrice = planPriceCents(dispute.invoice.plan);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        eyebrow="Dispute"
        title={dispute.invoice.customer.name}
        description={`${dispute.invoice.number} · opened ${formatDate(dispute.openedOn)}`}
        actions={<DisputeStatusBadge status={dispute.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Why it was opened</CardTitle>
            <CardDescription>Seeded language. Do not replace this with a real customer story.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>{dispute.reason}</p>
            <p className="text-muted-foreground">
              Disputed {formatUsd(dispute.disputedAmountCents)} against a {planLabel(dispute.invoice.plan)}{" "}
              invoice priced at {formatUsd(catalogPrice)}.
            </p>
            {dispute.reviewerNote ? (
              <p className="rounded-md bg-indigo-soft px-3 py-2 text-foreground">{dispute.reviewerNote}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked invoice</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <InvoiceStatusBadge status={dispute.invoice.status} />
              <span>{formatUsd(dispute.invoice.totalCents)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{dispute.invoice.memo}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/invoices/${dispute.invoice.id}`}>Open {dispute.invoice.number}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/*
        MULTI-FILE AGENT STUB
        Complete together:
          1. lib/disputes/resolve.ts
          2. app/api/disputes/[id]/resolve/route.ts
          3. this panel — enable Accept / Decline and persist a reviewer note
        The suggested-credit client calls v2, which caps the credit at the catalog price.
      */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Resolution</CardTitle>
          <CardDescription>
            This panel is unfinished. Accept and Decline should call{" "}
            <span className="font-mono text-foreground">POST /api/disputes/{dispute.id}/resolve</span>{" "}
            once the helper exists. Do not invent a credit above {formatUsd(catalogPrice)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SuggestedCredit
            disputeId={dispute.id}
            catalogPriceCents={catalogPrice}
            planName={planLabel(dispute.invoice.plan)}
          />

          <Label htmlFor="reviewer-note">Reviewer note</Label>
          <Textarea
            id="reviewer-note"
            placeholder="TODO(agent): bind this to resolveDispute and refuse credits above the plan price."
            defaultValue={dispute.reviewerNote ?? ""}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled title="Not wired — Agent demo target">
              Accept credit
            </Button>
            <Button type="button" variant="outline" disabled title="Not wired — Agent demo target">
              Decline
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Recorded when this dispute was opened: {formatUsd(dispute.suggestedCreditCents)}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
