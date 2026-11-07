"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AddressDTO } from "@hoodie/types";
import { addressSchema } from "@hoodie/validation";
import { Badge, Button, Card, Dialog, Field, Input, Skeleton } from "@hoodie/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAddresses, useDeleteAddress, useSaveAddress } from "@/hooks/use-addresses";
import { applyApiError } from "@/lib/forms";
import { FormMessage } from "../auth/auth-card";

function AddressForm({ address, onDone }: { address: AddressDTO | null; onDone: () => void }) {
  const save = useSaveAddress();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? { ...address, line2: address.line2 ?? undefined, state: address.state ?? undefined }
      : { country: "PK", isDefault: false },
  });

  const field = (name: keyof typeof errors) => ({
    invalid: !!errors[name],
    "aria-describedby": errors[name] ? `addr-${name}-error` : undefined,
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        save.mutate(
          { ...values, id: address?.id },
          {
            onSuccess: () => {
              toast.success(address ? "Address updated" : "Address added");
              onDone();
            },
            onError: (err) => setFormError(applyApiError(err, setError)),
          },
        );
      })}
    >
      {formError && <FormMessage>{formError}</FormMessage>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="addr-fullName" error={errors.fullName?.message}>
          <Input
            id="addr-fullName"
            autoComplete="name"
            {...field("fullName")}
            {...register("fullName")}
          />
        </Field>
        <Field label="Phone" htmlFor="addr-phone" error={errors.phone?.message}>
          <Input
            id="addr-phone"
            type="tel"
            autoComplete="tel"
            {...field("phone")}
            {...register("phone")}
          />
        </Field>
      </div>
      <Field label="Address" htmlFor="addr-line1" error={errors.line1?.message}>
        <Input
          id="addr-line1"
          autoComplete="address-line1"
          placeholder="House, street, area"
          {...field("line1")}
          {...register("line1")}
        />
      </Field>
      <Field
        label="Apartment, landmark (optional)"
        htmlFor="addr-line2"
        error={errors.line2?.message}
      >
        <Input
          id="addr-line2"
          autoComplete="address-line2"
          {...field("line2")}
          {...register("line2", { setValueAs: (v: string) => v || undefined })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="addr-city" error={errors.city?.message}>
          <Input
            id="addr-city"
            autoComplete="address-level2"
            {...field("city")}
            {...register("city")}
          />
        </Field>
        <Field label="Province (optional)" htmlFor="addr-state" error={errors.state?.message}>
          <Input
            id="addr-state"
            autoComplete="address-level1"
            {...field("state")}
            {...register("state", { setValueAs: (v: string) => v || undefined })}
          />
        </Field>
        <Field label="Postal code" htmlFor="addr-postalCode" error={errors.postalCode?.message}>
          <Input
            id="addr-postalCode"
            autoComplete="postal-code"
            {...field("postalCode")}
            {...register("postalCode")}
          />
        </Field>
      </div>
      <input type="hidden" {...register("country")} />
      {!address?.isDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-ink size-4" {...register("isDefault")} />
          Make this my default address
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save address
        </Button>
      </div>
    </form>
  );
}

export function AddressBook() {
  const { data: addresses, isLoading } = useAddresses();
  const remove = useDeleteAddress();
  const [editing, setEditing] = useState<AddressDTO | "new" | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Saved addresses</h2>
        <Button onClick={() => setEditing("new")}>Add address</Button>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : !addresses?.length ? (
        <p className="text-muted mt-6">You haven’t saved any addresses yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{a.fullName}</p>
                  {a.isDefault && <Badge tone="brand">Default</Badge>}
                </div>
                <address className="text-muted mt-2 flex-1 text-sm not-italic">
                  {a.line1}
                  {a.line2 && <>, {a.line2}</>}
                  <br />
                  {a.city}
                  {a.state && `, ${a.state}`} {a.postalCode}
                  <br />
                  {a.phone}
                </address>
                <div className="mt-4 flex gap-4 text-sm font-medium">
                  <button type="button" className="underline" onClick={() => setEditing(a)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-danger underline"
                    onClick={() => {
                      if (confirm("Delete this address?"))
                        remove.mutate(a.id, { onSuccess: () => toast.success("Address deleted") });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add address" : "Edit address"}
      >
        {editing !== null && (
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            address={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
