"use client";

import type { CouponDTO, DiscountType } from "@hoodie/types";
import { Button, Dialog, Field, Input } from "@hoodie/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { AffixInput, Select, Switch } from "@/admin/components/ui/controls";
import { EmptyState, ErrorState, PageHeader } from "@/admin/components/ui/page";
import { CouponStateBadge } from "@/admin/components/ui/status";
import { LoadingRows, Table, Td, Th, Tr } from "@/admin/components/ui/table";
import { useCrud } from "@/admin/hooks/use-crud";
import { errorMessage } from "@/admin/lib/api";
import { formatDateTime, formatMoney } from "@/admin/lib/format";
import { applyApiError, fromLocalInput, fromMinor, toLocalInput, toMinor } from "@/admin/lib/forms";

export function describeDiscount(c: Pick<CouponDTO, "type" | "value">) {
  if (c.type === "PERCENTAGE") return `${c.value}% off`;
  if (c.type === "FIXED") return `${formatMoney(c.value)} off`;
  return "Free delivery";
}

interface Values {
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minOrderAmount: string;
  maxUses: string;
  maxUsesPerUser: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const toValues = (c: CouponDTO | null): Values => ({
  code: c?.code ?? "",
  description: c?.description ?? "",
  type: c?.type ?? "PERCENTAGE",
  value: c ? (c.type === "FIXED" ? fromMinor(c.value) : String(c.value)) : "",
  minOrderAmount: fromMinor(c?.minOrderAmount),
  maxUses: c?.maxUses ? String(c.maxUses) : "",
  maxUsesPerUser: c?.maxUsesPerUser ? String(c.maxUsesPerUser) : "",
  startsAt: toLocalInput(c?.startsAt),
  endsAt: toLocalInput(c?.endsAt),
  isActive: c?.isActive ?? true,
});

const intOrNull = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null);

function CouponDialog({
  coupon,
  open,
  onClose,
  save,
}: {
  coupon: CouponDTO | null;
  open: boolean;
  onClose: () => void;
  save: ReturnType<typeof useCrud<CouponDTO>>["save"];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, watch, setError, formState } = useForm<Values>({
    defaultValues: toValues(coupon),
  });
  const { errors } = formState;
  useEffect(() => {
    if (open) {
      reset(toValues(coupon));
      setFormError(null);
    }
  }, [open, coupon, reset]);
  const type = watch("type");

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const value =
      v.type === "FIXED" ? toMinor(v.value) : v.type === "PERCENTAGE" ? intOrNull(v.value) : 0;
    const body = {
      code: v.code.trim(),
      description: v.description.trim() || null,
      type: v.type,
      value: value ?? 0,
      minOrderAmount: toMinor(v.minOrderAmount),
      maxUses: intOrNull(v.maxUses),
      maxUsesPerUser: intOrNull(v.maxUsesPerUser),
      startsAt: fromLocalInput(v.startsAt),
      endsAt: fromLocalInput(v.endsAt),
      isActive: v.isActive,
    };
    save.mutate(
      { id: coupon?.id, body },
      {
        onSuccess: (c) => {
          toast.success(coupon ? `Saved ${c.code}` : `Created ${c.code}`);
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
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
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
        <Field
          label="Code"
          htmlFor="code"
          error={errors.code?.message}
          hint="What shoppers type at checkout. Letters, numbers and hyphens."
        >
          <Input
            id="code"
            className="font-mono uppercase"
            invalid={!!errors.code}
            {...register("code", { required: "Enter a code" })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discount" htmlFor="type">
            <Select id="type" {...register("type")}>
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
              <option value="FREE_SHIPPING">Free delivery</option>
            </Select>
          </Field>
          {type !== "FREE_SHIPPING" && (
            <Field label="Value" htmlFor="value" error={errors.value?.message}>
              <AffixInput
                id="value"
                inputMode="decimal"
                prefix={type === "FIXED" ? "Rs" : undefined}
                suffix={type === "PERCENTAGE" ? "%" : undefined}
                invalid={!!errors.value}
                {...register("value", { required: "Enter a value" })}
              />
            </Field>
          )}
        </div>
        <Field
          label="Minimum order (optional)"
          htmlFor="minOrderAmount"
          error={errors.minOrderAmount?.message}
        >
          <AffixInput
            id="minOrderAmount"
            prefix="Rs"
            inputMode="decimal"
            {...register("minOrderAmount")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Total uses (optional)"
            htmlFor="maxUses"
            error={errors.maxUses?.message}
            hint="Empty = unlimited"
          >
            <Input id="maxUses" type="number" min={1} {...register("maxUses")} />
          </Field>
          <Field
            label="Uses per customer (optional)"
            htmlFor="maxUsesPerUser"
            error={errors.maxUsesPerUser?.message}
            hint="Counts signed-in customers"
          >
            <Input id="maxUsesPerUser" type="number" min={1} {...register("maxUsesPerUser")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (optional)" htmlFor="startsAt" error={errors.startsAt?.message}>
            <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
          </Field>
          <Field label="Ends (optional)" htmlFor="endsAt" error={errors.endsAt?.message}>
            <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
          </Field>
        </div>
        <Field label="Internal description (optional)" htmlFor="description">
          <Input id="description" maxLength={200} {...register("description")} />
        </Field>
        <Switch
          label="Active"
          hint="Turn off to pause the code without deleting it."
          {...register("isActive")}
        />
      </form>
    </Dialog>
  );
}

export function Coupons() {
  const { list, save, remove } = useCrud<CouponDTO>("/admin/coupons");
  const [editing, setEditing] = useState<CouponDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CouponDTO | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Coupons"
        description="Discount codes for checkout. Percentage discounts round down to whole rupees."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New coupon
          </Button>
        }
      />
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data?.length === 0 ? (
        <EmptyState title="No coupons yet">
          Create a code like WELCOME10 to reward new customers.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Discount</Th>
              <Th>Minimum</Th>
              <Th>Used</Th>
              <Th>Valid</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {list.isPending ? (
              <LoadingRows cols={7} />
            ) : (
              list.data?.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <span className="font-mono font-semibold">{c.code}</span>
                    {c.description && (
                      <span className="text-muted block text-xs">{c.description}</span>
                    )}
                  </Td>
                  <Td>{describeDiscount(c)}</Td>
                  <Td className="tabular-nums">
                    {c.minOrderAmount ? formatMoney(c.minOrderAmount) : "—"}
                  </Td>
                  <Td className="tabular-nums">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ""}
                  </Td>
                  <Td className="text-muted text-xs">
                    {c.startsAt || c.endsAt ? (
                      <>
                        {c.startsAt ? `From ${formatDateTime(c.startsAt)}` : "Now"}
                        <br />
                        {c.endsAt ? `Until ${formatDateTime(c.endsAt)}` : "No end date"}
                      </>
                    ) : (
                      "Always"
                    )}
                  </Td>
                  <Td>
                    <CouponStateBadge state={c.state} />
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(c);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(c)}>
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      )}
      <CouponDialog coupon={editing} open={open} onClose={() => setOpen(false)} save={save} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.code}?`}
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      >
        Coupons that were used on orders can&apos;t be deleted (the orders refer to them). Switch
        those off instead.
      </ConfirmDialog>
    </div>
  );
}
