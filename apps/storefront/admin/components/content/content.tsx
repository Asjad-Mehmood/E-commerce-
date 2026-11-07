"use client";

import type {
  AdminBannerDTO,
  AdminFaqDTO,
  AdminPageDTO,
  AnnouncementDTO,
  ApiResponse,
} from "@hoodie/types";
import { Badge, Button, Dialog, Field, Input, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { Switch, Textarea } from "@/admin/components/ui/controls";
import { FilterTabs } from "@/admin/components/ui/filters";
import { ImagePicker } from "@/admin/components/ui/image-input";
import { EmptyState, ErrorState, PageHeader, Section } from "@/admin/components/ui/page";
import { useCrud } from "@/admin/hooks/use-crud";
import { useUrlState } from "@/admin/hooks/use-url-state";
import { api, errorMessage } from "@/admin/lib/api";
import { adminConfig } from "@/admin/lib/config";
import { formatDate, formatDateTime } from "@/admin/lib/format";
import { applyApiError, fromLocalInput, toLocalInput } from "@/admin/lib/forms";

/** Pages the storefront footer links to (the API refuses to delete them). */
const SYSTEM_PAGES = ["shipping", "returns", "privacy", "terms"];

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
      {message}
    </p>
  ) : null;
}

function DialogFooter({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSave} loading={saving}>
        Save
      </Button>
    </div>
  );
}

// ───────────── Announcement bar ─────────────

function Announcement() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "announcement"],
    queryFn: async () => (await api<ApiResponse<AnnouncementDTO>>("/admin/announcement")).data,
  });
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.enabled);
      setText(query.data.text);
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      api<ApiResponse<AnnouncementDTO>>("/admin/announcement", {
        method: "PUT",
        body: { enabled, text: text.trim() },
      }),
    onSuccess: (res) => {
      qc.setQueryData(["admin", "announcement"], res.data);
      toast.success("Announcement saved. The store shows it within a few minutes.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  if (!query.data) return <Skeleton className="h-40" />;
  const dirty = enabled !== query.data.enabled || text.trim() !== query.data.text;

  return (
    <Section
      title="Announcement bar"
      description="A one-line message above the storefront header, e.g. a sale or delivery notice."
    >
      <Switch
        label="Show the announcement bar"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
      />
      <Field label="Message" htmlFor="announcement" hint={`${text.length}/160`}>
        <Input
          id="announcement"
          value={text}
          maxLength={160}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      {text.trim() && (
        <div
          className="bg-ink rounded-lg px-4 py-2 text-center text-sm text-white"
          aria-label="Preview"
        >
          {text}
        </div>
      )}
      <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
        Save announcement
      </Button>
    </Section>
  );
}

// ───────────── Banners ─────────────

interface BannerValues {
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  ctaLabel: string;
  position: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const bannerValues = (b: AdminBannerDTO | null): BannerValues => ({
  title: b?.title ?? "",
  subtitle: b?.subtitle ?? "",
  imageUrl: b?.imageUrl ?? "",
  link: b?.link ?? "",
  ctaLabel: b?.ctaLabel ?? "",
  position: String(b?.position ?? 0),
  isActive: b?.isActive ?? true,
  startsAt: toLocalInput(b?.startsAt),
  endsAt: toLocalInput(b?.endsAt),
});

function bannerState(b: AdminBannerDTO, now = Date.now()) {
  if (!b.isActive) return <Badge>Off</Badge>;
  if (b.startsAt && new Date(b.startsAt).getTime() > now)
    return <Badge tone="brand">Scheduled</Badge>;
  if (b.endsAt && new Date(b.endsAt).getTime() <= now) return <Badge>Ended</Badge>;
  return <Badge tone="success">Live</Badge>;
}

function Banners() {
  const { list, save, remove } = useCrud<AdminBannerDTO>("/admin/banners");
  const [editing, setEditing] = useState<AdminBannerDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminBannerDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, watch, setError, formState } =
    useForm<BannerValues>({
      defaultValues: bannerValues(null),
    });
  const { errors } = formState;
  const imageUrl = watch("imageUrl");

  const edit = (b: AdminBannerDTO | null) => {
    setEditing(b);
    reset(bannerValues(b));
    setFormError(null);
    setOpen(true);
  };

  const onSubmit = handleSubmit((v) => {
    if (!v.imageUrl) {
      setError("imageUrl", { message: "Add an image" });
      return;
    }
    save.mutate(
      {
        id: editing?.id,
        body: {
          title: v.title.trim(),
          subtitle: v.subtitle.trim() || null,
          imageUrl: v.imageUrl,
          link: v.link.trim() || null,
          ctaLabel: v.ctaLabel.trim() || null,
          position: Number.parseInt(v.position, 10) || 0,
          isActive: v.isActive,
          startsAt: fromLocalInput(v.startsAt),
          endsAt: fromLocalInput(v.endsAt),
        },
      },
      {
        onSuccess: () => {
          toast.success("Banner saved");
          setOpen(false);
        },
        onError: (err) => setFormError(applyApiError(err, setError)),
      },
    );
  });

  return (
    <Section
      title="Homepage banners"
      description="Large images at the top of the homepage, shown in position order. Schedule them with start and end dates."
      actions={<Button onClick={() => edit(null)}>New banner</Button>}
    >
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data?.length === 0 && <EmptyState title="No banners yet" />}
      <ul className="grid gap-4 md:grid-cols-2">
        {list.data?.map((b) => (
          <li key={b.id} className="border-line overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element -- previews from any image host */}
            <img src={b.imageUrl} alt="" className="bg-surface aspect-[16/6] w-full object-cover" />
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  {b.title} {bannerState(b)}
                </p>
                {b.subtitle && <p className="text-muted truncate">{b.subtitle}</p>}
                <p className="text-muted text-xs">
                  Position {b.position}
                  {b.link ? ` · links to ${b.link}` : ""}
                  {b.endsAt ? ` · until ${formatDateTime(b.endsAt)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0">
                <Button size="sm" variant="ghost" onClick={() => edit(b)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(b)}>
                  Delete
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit banner" : "New banner"}
        footer={
          <DialogFooter
            onClose={() => setOpen(false)}
            onSave={() => void onSubmit()}
            saving={save.isPending}
          />
        }
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <Field label="Headline" htmlFor="b-title" error={errors.title?.message}>
            <Input
              id="b-title"
              maxLength={80}
              {...register("title", { required: "Enter a headline" })}
            />
          </Field>
          <Field label="Subtitle (optional)" htmlFor="b-subtitle">
            <Input id="b-subtitle" maxLength={160} {...register("subtitle")} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Image</p>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- preview from any image host
              <img
                src={imageUrl}
                alt=""
                className="bg-surface aspect-[16/6] w-full rounded-md object-cover"
              />
            )}
            <ImagePicker
              folder="banners"
              label={imageUrl ? "Replace image" : "Upload image"}
              onAdd={(url) => setValue("imageUrl", url, { shouldDirty: true })}
            />
            {errors.imageUrl && (
              <p role="alert" className="text-danger text-sm">
                {errors.imageUrl.message}
              </p>
            )}
            <p className="text-muted text-xs">Wide images work best (about 1600 × 600).</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Link (optional)"
              htmlFor="b-link"
              error={errors.link?.message}
              hint="e.g. /collections/winter-drop"
            >
              <Input id="b-link" {...register("link")} />
            </Field>
            <Field label="Button text (optional)" htmlFor="b-cta" error={errors.ctaLabel?.message}>
              <Input id="b-cta" maxLength={30} placeholder="Shop now" {...register("ctaLabel")} />
            </Field>
            <Field label="Starts (optional)" htmlFor="b-start">
              <Input id="b-start" type="datetime-local" {...register("startsAt")} />
            </Field>
            <Field label="Ends (optional)" htmlFor="b-end" error={errors.endsAt?.message}>
              <Input id="b-end" type="datetime-local" {...register("endsAt")} />
            </Field>
          </div>
          <Field label="Position" htmlFor="b-position" hint="Lower numbers show first.">
            <Input
              id="b-position"
              type="number"
              min={0}
              className="w-28"
              {...register("position")}
            />
          </Field>
          <Switch label="Active" {...register("isActive")} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.title}"?`}
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      >
        The banner is removed from the homepage. To hide it for now, switch it off instead.
      </ConfirmDialog>
    </Section>
  );
}

// ───────────── Pages ─────────────

interface PageValues {
  title: string;
  slug: string;
  content: string;
  seoDescription: string;
  isPublished: boolean;
}

function Pages() {
  const { list, save, remove } = useCrud<AdminPageDTO>("/admin/pages");
  const [editing, setEditing] = useState<AdminPageDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminPageDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<PageValues>();
  const { errors } = formState;

  const edit = (p: AdminPageDTO | null) => {
    setEditing(p);
    reset({
      title: p?.title ?? "",
      slug: p?.slug ?? "",
      content: p?.content ?? "",
      seoDescription: p?.seoDescription ?? "",
      isPublished: p?.isPublished ?? true,
    });
    setFormError(null);
    setOpen(true);
  };

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: editing?.id,
        body: {
          title: v.title.trim(),
          slug: v.slug.trim(),
          content: v.content,
          seoDescription: v.seoDescription.trim() || null,
          isPublished: v.isPublished,
        },
      },
      {
        onSuccess: () => {
          toast.success("Page saved. The store updates within a few minutes.");
          setOpen(false);
        },
        onError: (err) => setFormError(applyApiError(err, setError)),
      },
    ),
  );

  const system = !!editing && SYSTEM_PAGES.includes(editing.slug);

  return (
    <Section
      title="Pages"
      description="Policies and other text pages, shown at /policies/slug. Write plain text; blank lines start new paragraphs."
      actions={<Button onClick={() => edit(null)}>New page</Button>}
    >
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      <ul className="divide-line divide-y">
        {list.data?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>
              <span className="font-medium">{p.title}</span>{" "}
              {!p.isPublished && <Badge tone="warning">Unpublished</Badge>}
              <a
                href={`${adminConfig.storefrontUrl}/policies/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted block font-mono text-xs hover:underline"
              >
                /policies/{p.slug}
              </a>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-muted mr-2 text-xs">Updated {formatDate(p.updatedAt)}</span>
              <Button size="sm" variant="ghost" onClick={() => edit(p)}>
                Edit
              </Button>
              {!SYSTEM_PAGES.includes(p.slug) && (
                <Button size="sm" variant="ghost" onClick={() => setToDelete(p)}>
                  Delete
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.title}` : "New page"}
        className="max-w-2xl"
        footer={
          <DialogFooter
            onClose={() => setOpen(false)}
            onSave={() => void onSubmit()}
            saving={save.isPending}
          />
        }
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="p-title" error={errors.title?.message}>
              <Input id="p-title" {...register("title", { required: "Enter a title" })} />
            </Field>
            <Field
              label="Slug"
              htmlFor="p-slug"
              error={errors.slug?.message}
              hint={
                system
                  ? "The footer links here, so this can't change."
                  : "Lowercase, e.g. size-help"
              }
            >
              <Input
                id="p-slug"
                readOnly={system}
                {...register("slug", { required: "Enter a slug" })}
              />
            </Field>
          </div>
          <Field label="Content" htmlFor="p-content" error={errors.content?.message}>
            <Textarea
              id="p-content"
              rows={14}
              {...register("content", { required: "Write the page" })}
            />
          </Field>
          <Field
            label="Search engine description (optional)"
            htmlFor="p-seo"
            error={errors.seoDescription?.message}
          >
            <Input id="p-seo" maxLength={160} {...register("seoDescription")} />
          </Field>
          <Switch label="Published" {...register("isPublished")} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete "${toDelete?.title}"?`}
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      >
        Links to this page will show &quot;page not found&quot;.
      </ConfirmDialog>
    </Section>
  );
}

// ───────────── FAQ ─────────────

interface FaqValues {
  question: string;
  answer: string;
  category: string;
  position: string;
  isActive: boolean;
}

function Faq() {
  const { list, save, remove } = useCrud<AdminFaqDTO>("/admin/faq");
  const [editing, setEditing] = useState<AdminFaqDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminFaqDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<FaqValues>();
  const { errors } = formState;

  const edit = (f: AdminFaqDTO | null) => {
    setEditing(f);
    reset({
      question: f?.question ?? "",
      answer: f?.answer ?? "",
      category: f?.category ?? "",
      position: String(f?.position ?? list.data?.length ?? 0),
      isActive: f?.isActive ?? true,
    });
    setFormError(null);
    setOpen(true);
  };

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: editing?.id,
        body: {
          question: v.question.trim(),
          answer: v.answer.trim(),
          category: v.category.trim() || null,
          position: Number.parseInt(v.position, 10) || 0,
          isActive: v.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success("Saved");
          setOpen(false);
        },
        onError: (err) => setFormError(applyApiError(err, setError)),
      },
    ),
  );

  return (
    <Section
      title="FAQ"
      description="Questions on the storefront's FAQ page, in position order."
      actions={<Button onClick={() => edit(null)}>New question</Button>}
    >
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data?.length === 0 && <EmptyState title="No questions yet" />}
      <ul className="divide-line divide-y">
        {list.data?.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{f.question}</span>{" "}
              {!f.isActive && <Badge>Hidden</Badge>}
              <span className="text-muted line-clamp-2 block">{f.answer}</span>
              {f.category && <span className="text-muted text-xs">{f.category}</span>}
            </span>
            <span className="flex shrink-0">
              <Button size="sm" variant="ghost" onClick={() => edit(f)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(f)}>
                Delete
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit question" : "New question"}
        footer={
          <DialogFooter
            onClose={() => setOpen(false)}
            onSave={() => void onSubmit()}
            saving={save.isPending}
          />
        }
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <Field label="Question" htmlFor="f-q" error={errors.question?.message}>
            <Input id="f-q" {...register("question", { required: "Enter the question" })} />
          </Field>
          <Field label="Answer" htmlFor="f-a" error={errors.answer?.message}>
            <Textarea id="f-a" rows={5} {...register("answer", { required: "Enter the answer" })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Group (optional)" htmlFor="f-c" hint="e.g. Orders, Delivery, Sizing">
              <Input id="f-c" {...register("category")} />
            </Field>
            <Field label="Position" htmlFor="f-p">
              <Input id="f-p" type="number" min={0} {...register("position")} />
            </Field>
          </div>
          <Switch label="Show on the FAQ page" {...register("isActive")} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this question?"
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      >
        {toDelete?.question}
      </ConfirmDialog>
    </Section>
  );
}

const TABS = [
  { value: "", label: "Homepage" },
  { value: "pages", label: "Pages" },
  { value: "faq", label: "FAQ" },
];

export function Content() {
  const { values, set } = useUrlState<"tab">();
  const tab = values.tab ?? "";
  return (
    <div className="space-y-5">
      <PageHeader
        title="Content"
        description="Storefront text and images. Changes appear on the store within about five minutes (pages are cached)."
      />
      <FilterTabs
        label="Content type"
        options={TABS}
        value={tab}
        onChange={(t) => set({ tab: t })}
      />
      {tab === "" && (
        <div className="space-y-6">
          <Announcement />
          <Banners />
        </div>
      )}
      {tab === "pages" && <Pages />}
      {tab === "faq" && <Faq />}
    </div>
  );
}
