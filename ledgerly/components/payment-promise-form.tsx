"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/money";

export type PromiseInvoiceOption = {
  id: string;
  number: string;
  planLabel: string;
  totalCents: number;
};

export function PaymentPromiseForm({
  takenBy,
  invoices,
}: {
  takenBy: string;
  invoices: PromiseInvoiceOption[];
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const [promisedOn, setPromisedOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const selected = invoices.find((invoice) => invoice.id === invoiceId) ?? invoices[0];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError(null);
    setSaved(false);

    const response = await fetch(`/api/invoices/${selected.id}/payment-promises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promisedOn, note }),
    });
    const body = (await response.json()) as { error?: string };
    setPending(false);

    if (!response.ok) {
      setError(body.error ?? "Could not save the promise.");
      return;
    }

    setNote("");
    setSaved(true);
    router.refresh();
  }

  if (!selected) return null;

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {invoices.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="promise-invoice">Invoice</Label>
          <select
            id="promise-invoice"
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            value={invoiceId}
            onChange={(event) => {
              setInvoiceId(event.target.value);
              setSaved(false);
            }}
          >
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} · {invoice.planLabel} · {formatUsd(invoice.totalCents)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm">
          {selected.number} · {selected.planLabel} · {formatUsd(selected.totalCents)}
        </p>
      )}

      <p className="text-sm">
        <span className="text-muted-foreground">Taken by </span>
        {takenBy}
      </p>

      <div className="space-y-2">
        <Label htmlFor="promise-date">Date they will pay</Label>
        <Input
          id="promise-date"
          type="date"
          value={promisedOn}
          onChange={(event) => {
            setPromisedOn(event.target.value);
            setSaved(false);
          }}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="promise-note">Note</Label>
        <Textarea
          id="promise-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
          }}
          rows={3}
          maxLength={280}
          required
        />
      </div>

      {error ? (
        <p id="promise-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground" role="status">
          Promise saved. The invoice is still overdue.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save promise"}
      </Button>
    </form>
  );
}
