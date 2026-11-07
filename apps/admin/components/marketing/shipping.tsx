"use client";

import type { ShippingZoneDTO } from "@hoodie/types";
import { Badge, Button, Dialog, Field, Input } from "@hoodie/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm";
import { AffixInput, Switch, Textarea } from "@/components/ui/controls";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/page";
import { useCrud } from "@/hooks/use-crud";
import { errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { applyApiError, fromMinor, toMinor } from "@/lib/forms";

interface Values {
  name: string;
  regions: string;
  standardRate: string;
  expressRate: string;
  freeOverAmount: string;
  codEnabled: boolean;
  codFee: string;
  estimatedDays: string;
  position: string;
  isActive: boolean;
}

const toValues = (z: ShippingZoneDTO | null): Values => ({
  name: z?.name ?? "",
  regions: z?.regions.join(", ") ?? "",
  standardRate: fromMinor(z?.standardRate),
  expressRate: fromMinor(z?.expressRate),
  freeOverAmount: fromMinor(z?.freeOverAmount),
  codEnabled: z?.codEnabled ?? true,
  codFee: fromMinor(z?.codFee ?? 0),
  estimatedDays: z?.estimatedDays ?? "",
  position: String(z?.position ?? 0),
  isActive: z?.isActive ?? true,
});

const regionLabel = (r: string) =>
  r === "*" ? "Everywhere else" : r.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function ZoneDialog({
  zone,
  open,
  onClose,
  save,
}: {
  zone: ShippingZoneDTO | null;
  open: boolean;
  onClose: () => void;
  save: ReturnType<typeof useCrud<ShippingZoneDTO>>["save"];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, watch, setError, formState } = useForm<Values>({
    defaultValues: toValues(zone),
  });
  const { errors } = formState;
  useEffect(() => {
    if (open) {
      reset(toValues(zone));
      setFormError(null);
    }
  }, [open, zone, reset]);
  const codEnabled = watch("codEnabled");

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const standard = toMinor(v.standardRate);
    if (standard === null || Number.isNaN(standard)) {
      setError("standardRate", { message: "Enter the standard delivery price (0 for free)" });
      return;
    }
    const body = {
      name: v.name.trim(),
      regions: v.regions
        .split(/[,\n]/)
        .map((r) => r.trim())
        .filter(Boolean),
      standardRate: standard,
      expressRate: toMinor(v.expressRate),
      freeOverAmount: toMinor(v.freeOverAmount),
      codEnabled: v.codEnabled,
      codFee: toMinor(v.codFee) ?? 0,
      estimatedDays: v.estimatedDays.trim(),
      position: Number.parseInt(v.position, 10) || 0,
      isActive: v.isActive,
    };
    save.mutate(
      { id: zone?.id, body },
      {
        onSuccess: () => {
          toast.success(zone ? "Zone saved" : "Zone created");
          onClose();
        },
        onError: (err) => setFormError(applyApiError(err, setError)),
      },
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={zone ? `Edit ${zone.name}` : "New delivery zone"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} loading={save.isPending}>
            Save
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
            {formError}
          </p>
        )}
        <Field label="Name" htmlFor="zone-name" error={errors.name?.message}>
          <Input
            id="zone-name"
            placeholder="e.g. Major cities"
            {...register("name", { required: "Enter a name" })}
          />
        </Field>
        <Field
          label="Cities"
          htmlFor="zone-regions"
          error={errors.regions?.message}
          hint="Separate with commas. Use * for everywhere not covered by another zone."
        >
          <Textarea
            id="zone-regions"
            className="min-h-16"
            {...register("regions", { required: "Add at least one city" })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Standard delivery"
            htmlFor="zone-standard"
            error={errors.standardRate?.message}
          >
            <AffixInput
              id="zone-standard"
              prefix="Rs"
              inputMode="decimal"
              {...register("standardRate")}
            />
          </Field>
          <Field
            label="Delivery time"
            htmlFor="zone-days"
            error={errors.estimatedDays?.message}
            hint="Days, e.g. 2-3"
          >
            <Input
              id="zone-days"
              {...register("estimatedDays", { required: "Enter the delivery time" })}
            />
          </Field>
          <Field
            label="Express delivery (optional)"
            htmlFor="zone-express"
            error={errors.expressRate?.message}
            hint="Empty = no express option"
          >
            <AffixInput
              id="zone-express"
              prefix="Rs"
              inputMode="decimal"
              {...register("expressRate")}
            />
          </Field>
          <Field
            label="Free standard delivery over (optional)"
            htmlFor="zone-free"
            error={errors.freeOverAmount?.message}
          >
            <AffixInput
              id="zone-free"
              prefix="Rs"
              inputMode="decimal"
              {...register("freeOverAmount")}
            />
          </Field>
        </div>
        <Switch label="Cash on Delivery available" {...register("codEnabled")} />
        {codEnabled && (
          <Field label="Cash on Delivery fee" htmlFor="zone-cod" error={errors.codFee?.message}>
            <AffixInput
              id="zone-cod"
              prefix="Rs"
              inputMode="decimal"
              className="max-w-48"
              {...register("codFee")}
            />
          </Field>
        )}
        <Field label="Position" htmlFor="zone-position" hint="Lower numbers are listed first.">
          <Input
            id="zone-position"
            type="number"
            min={0}
            className="w-28"
            {...register("position")}
          />
        </Field>
        <Switch label="Active" {...register("isActive")} />
      </form>
    </Dialog>
  );
}

export function Shipping() {
  const { list, save, remove } = useCrud<ShippingZoneDTO>("/admin/shipping-zones");
  const [editing, setEditing] = useState<ShippingZoneDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ShippingZoneDTO | null>(null);
  const hasFallback = list.data?.some((z) => z.isActive && z.regions.includes("*"));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shipping"
        description="Delivery prices by city. Checkout picks the zone that lists the shopper's city, or the * zone for everywhere else."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New zone
          </Button>
        }
      />
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data && !hasFallback && (
        <p className="bg-warning/15 rounded-lg px-4 py-3 text-sm">
          No active zone covers &quot;everywhere else&quot; (*). Shoppers in cities you haven&apos;t
          listed can&apos;t check out.
        </p>
      )}
      {list.data?.length === 0 ? (
        <EmptyState title="No delivery zones" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.data?.map((z) => (
            <li
              key={z.id}
              className="border-line bg-canvas rounded-(--radius-card) space-y-3 border p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {z.name} {!z.isActive && <Badge>Off</Badge>}
                  </h2>
                  <p className="text-muted text-sm">{z.regions.map(regionLabel).join(", ")}</p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(z);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(z)}>
                    Delete
                  </Button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Standard</dt>
                <dd className="tabular-nums">
                  {z.standardRate ? formatMoney(z.standardRate) : "Free"} · {z.estimatedDays} days
                </dd>
                <dt className="text-muted">Express</dt>
                <dd className="tabular-nums">
                  {z.expressRate !== null ? formatMoney(z.expressRate) : "Not offered"}
                </dd>
                <dt className="text-muted">Free over</dt>
                <dd className="tabular-nums">
                  {z.freeOverAmount !== null ? formatMoney(z.freeOverAmount) : "—"}
                </dd>
                <dt className="text-muted">Cash on Delivery</dt>
                <dd className="tabular-nums">
                  {z.codEnabled
                    ? z.codFee
                      ? `+${formatMoney(z.codFee)}`
                      : "No fee"
                    : "Not offered"}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <ZoneDialog zone={editing} open={open} onClose={() => setOpen(false)} save={save} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      >
        Its cities fall back to the * zone. To pause a zone without losing it, switch it off
        instead.
      </ConfirmDialog>
    </div>
  );
}
