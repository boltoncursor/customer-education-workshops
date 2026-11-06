"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerEmailField({ invoiceId, email }: { invoiceId: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(email);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!response.ok) {
        setMessage("error");
        return;
      }
      setMessage("saved");
      router.refresh();
    } catch {
      setMessage("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <Label htmlFor="customer-email">Email</Label>
      <Input
        id="customer-email"
        name="email"
        type="text"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setValue(event.target.value);
          setMessage(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving" : "Save email"}
        </Button>
        {message === "saved" ? <p className="text-xs text-muted-foreground">Saved</p> : null}
        {message === "error" ? (
          <p className="text-xs text-danger" role="alert">
            Could not save email.
          </p>
        ) : null}
      </div>
    </form>
  );
}
