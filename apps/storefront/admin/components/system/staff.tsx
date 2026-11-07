"use client";

import type { AdminRole, ApiResponse, StaffMemberDTO } from "@hoodie/types";
import { Badge, Button, Dialog, Field, Input } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { Select } from "@/admin/components/ui/controls";
import { ErrorState, PageHeader, Section } from "@/admin/components/ui/page";
import { LoadingRows, Table, Td, Th, Tr } from "@/admin/components/ui/table";
import { useStaff } from "@/admin/hooks/use-session";
import { api, errorMessage } from "@/admin/lib/api";
import { formatDate, timeAgo } from "@/admin/lib/format";
import { applyApiError } from "@/admin/lib/forms";

const ROLES: { value: AdminRole; label: string; does: string }[] = [
  { value: "SUPPORT", label: "Support", does: "Orders, customers and messages" },
  {
    value: "MANAGER",
    label: "Manager",
    does: "Plus products, stock, coupons, content, reports and refunds",
  },
  {
    value: "SUPER_ADMIN",
    label: "Super Admin",
    does: "Everything, including staff, settings and the activity log",
  },
];
const roleLabel = (r: AdminRole) => ROLES.find((x) => x.value === r)?.label ?? r;

export function Staff() {
  const me = useStaff();
  const qc = useQueryClient();
  const key = ["admin", "staff"];
  const list = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ApiResponse<StaffMemberDTO[]>>("/admin/staff")).data,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    member: StaffMemberDTO;
    action: "block" | "unblock" | "remove";
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set-password link to pass on by hand while email isn't set up. */
  const [link, setLink] = useState<{ name: string; email: string; url: string } | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<{
    name: string;
    email: string;
    role: AdminRole;
  }>({
    defaultValues: { name: "", email: "", role: "SUPPORT" },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const invite = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ApiResponse<StaffMemberDTO>>("/admin/staff", { method: "POST", body }),
    onSuccess: (res) => {
      if (res.data.inviteLink) {
        setLink({ name: res.data.name, email: res.data.email, url: res.data.inviteLink });
      } else {
        toast.success(
          res.data.invitePending
            ? `Invitation sent to ${res.data.email}`
            : `${res.data.name} now has staff access`,
        );
      }
      setInviteOpen(false);
      refresh();
    },
    onError: (err) => setFormError(applyApiError(err, setError)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/admin/staff/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success("Saved");
      setConfirm(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/staff/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Staff access removed");
      setConfirm(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const resend = useMutation({
    mutationFn: (id: string) =>
      api<ApiResponse<StaffMemberDTO>>(`/admin/staff/${id}/resend-invite`, { method: "POST" }),
    onSuccess: (res) => {
      if (res.data.inviteLink) {
        setLink({ name: res.data.name, email: res.data.email, url: res.data.inviteLink });
      } else toast.success("A new invitation link was sent");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        description="People who can sign in to this admin panel. You can't change your own access."
        actions={
          <Button
            onClick={() => {
              reset({ name: "", email: "", role: "SUPPORT" });
              setFormError(null);
              setInviteOpen(true);
            }}
          >
            Invite staff
          </Button>
        }
      />
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Last sign-in</Th>
            <Th>Added</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {list.isPending ? (
            <LoadingRows cols={5} rows={3} />
          ) : (
            list.data?.map((m) => {
              const self = m.id === me.id;
              return (
                <Tr key={m.id} className={m.isBlocked ? "opacity-60" : undefined}>
                  <Td>
                    <span className="font-medium">{m.name}</span>
                    {self && <Badge className="ml-2">You</Badge>}
                    {m.isBlocked && (
                      <Badge tone="danger" className="ml-2">
                        Deactivated
                      </Badge>
                    )}
                    {m.invitePending && (
                      <Badge tone="warning" className="ml-2">
                        Invite pending
                      </Badge>
                    )}
                    <span className="text-muted block">{m.email}</span>
                  </Td>
                  <Td>
                    {self ? (
                      roleLabel(m.role)
                    ) : (
                      <Select
                        aria-label={`Role for ${m.name}`}
                        className="h-8 w-auto"
                        value={m.role}
                        disabled={update.isPending}
                        onChange={(e) =>
                          update.mutate({ id: m.id, body: { role: e.target.value } })
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Td>
                  <Td className="text-muted">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : "Never"}</Td>
                  <Td className="text-muted">{formatDate(m.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {!self && (
                      <>
                        {m.invitePending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={resend.isPending && resend.variables === m.id}
                            onClick={() => resend.mutate(m.id)}
                          >
                            Resend invite
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setConfirm({ member: m, action: m.isBlocked ? "unblock" : "block" })
                          }
                        >
                          {m.isBlocked ? "Reactivate" : "Deactivate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirm({ member: m, action: "remove" })}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>

      <Section title="What each role can do">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value}>
              <dt className="font-medium">{r.label}</dt>
              <dd className="text-muted">{r.does}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a staff member"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={invite.isPending}
              onClick={() =>
                void handleSubmit((v) => {
                  setFormError(null);
                  invite.mutate(v);
                })()
              }
            >
              Send invitation
            </Button>
          </div>
        }
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit((v) => {
            setFormError(null);
            invite.mutate(v);
          })}
        >
          <p className="text-muted text-sm">
            They get an email with a link to choose a password (valid for 72 hours); while email
            isn&apos;t set up, you get the link to send them yourself. If the email already has a
            customer account, that account gets staff access instead.
          </p>
          {formError && (
            <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
              {formError}
            </p>
          )}
          <Field label="Name" htmlFor="staff-name" error={formState.errors.name?.message}>
            <Input id="staff-name" {...register("name", { required: "Enter their name" })} />
          </Field>
          <Field label="Email" htmlFor="staff-email" error={formState.errors.email?.message}>
            <Input
              id="staff-email"
              type="email"
              {...register("email", { required: "Enter their email" })}
            />
          </Field>
          <Field label="Role" htmlFor="staff-role">
            <Select id="staff-role" {...register("role")}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}: {r.does}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={!!link}
        onClose={() => setLink(null)}
        title={`Send ${link?.name ?? "them"} this link`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(link?.url ?? "")
                  .then(() => toast.success("Link copied"));
              }}
            >
              Copy link
            </Button>
            <Button onClick={() => setLink(null)}>Done</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            Email isn&apos;t set up yet, so no invitation was emailed. Send this link to{" "}
            <strong>{link?.email}</strong> yourself (WhatsApp, SMS…). It lets them choose a password
            and works once, for 72 hours.
          </p>
          <Input readOnly value={link?.url ?? ""} onFocus={(e) => e.currentTarget.select()} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm?.action === "remove"
            ? `Remove ${confirm.member.name}'s staff access?`
            : confirm?.action === "block"
              ? `Deactivate ${confirm?.member.name}?`
              : `Reactivate ${confirm?.member.name}?`
        }
        tone={confirm?.action === "unblock" ? "primary" : "danger"}
        confirmLabel={
          confirm?.action === "remove"
            ? "Remove access"
            : confirm?.action === "block"
              ? "Deactivate"
              : "Reactivate"
        }
        loading={update.isPending || remove.isPending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "remove") remove.mutate(confirm.member.id);
          else
            update.mutate({
              id: confirm.member.id,
              body: { isBlocked: confirm.action === "block" },
            });
        }}
      >
        {confirm?.action === "remove"
          ? "Their account becomes a regular customer account and they are signed out of the admin panel."
          : confirm?.action === "block"
            ? "They are signed out everywhere and can't sign in until reactivated."
            : "They can sign in again with their existing password."}
      </ConfirmDialog>
    </div>
  );
}
