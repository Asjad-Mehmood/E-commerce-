"use client";

import { Badge, Button, Dialog, Field, Input } from "@hoodie/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Checkbox, Select, Textarea } from "@/components/ui/controls";
import { ImagePicker } from "@/components/ui/image-input";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/page";
import { LoadingRows, Table, Td, Th, Tr } from "@/components/ui/table";
import { useCrud } from "@/hooks/use-crud";
import { errorMessage } from "@/lib/api";
import { adminConfig } from "@/lib/config";
import { applyApiError } from "@/lib/forms";

type Kind = "category" | "collection";

interface Item {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  // categories
  imageUrl?: string | null;
  parentId?: string | null;
  // collections
  bannerUrl?: string | null;
  isFeatured?: boolean;
  _count: { products: number };
}

interface Values {
  name: string;
  slug: string;
  description: string;
  position: string;
  image: string;
  parentId: string;
  isFeatured: boolean;
}

const CONFIG = {
  category: {
    path: "/admin/categories",
    title: "Categories",
    one: "category",
    description:
      "How the store's menu is organised. Sub-categories appear under their parent. A product can be in several categories.",
    storePath: "/categories",
    imageField: "imageUrl",
    folder: "categories",
  },
  collection: {
    path: "/admin/collections",
    title: "Collections",
    one: "collection",
    description:
      "Hand-picked groups of products, such as Winter Drop or Best Sellers. Featured collections appear on the homepage.",
    storePath: "/collections",
    imageField: "bannerUrl",
    folder: "collections",
  },
} as const;

/** Categories sorted as a tree: each parent followed by its children (indented). */
function treeOrder(items: Item[]): { item: Item; depth: number }[] {
  const byParent = new Map<string | null, Item[]>();
  for (const i of items) {
    const p = i.parentId && items.some((x) => x.id === i.parentId) ? i.parentId : null;
    byParent.set(p, [...(byParent.get(p) ?? []), i]);
  }
  const out: { item: Item; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const i of byParent.get(parent) ?? []) {
      out.push({ item: i, depth });
      walk(i.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function ItemDialog({
  kind,
  item,
  items,
  open,
  onClose,
  save,
}: {
  kind: Kind;
  item: Item | null;
  items: Item[];
  open: boolean;
  onClose: () => void;
  save: ReturnType<typeof useCrud<Item>>["save"];
}) {
  const c = CONFIG[kind];
  const [formError, setFormError] = useState<string | null>(null);
  const toValues = (i: Item | null): Values => ({
    name: i?.name ?? "",
    slug: i?.slug ?? "",
    description: i?.description ?? "",
    position: String(i?.position ?? 0),
    image: (kind === "category" ? i?.imageUrl : i?.bannerUrl) ?? "",
    parentId: i?.parentId ?? "",
    isFeatured: i?.isFeatured ?? false,
  });
  const { register, handleSubmit, reset, setError, setValue, watch, formState } = useForm<Values>({
    defaultValues: toValues(item),
  });
  useEffect(() => {
    if (open) {
      reset(toValues(item));
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [open, item]);
  const image = watch("image");

  // A category can't move under itself or its own sub-categories.
  const descendants = new Set<string>();
  if (item) {
    const add = (id: string) => {
      descendants.add(id);
      items.filter((i) => i.parentId === id).forEach((i) => add(i.id));
    };
    add(item.id);
  }

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const body: Record<string, unknown> = {
      name: v.name.trim(),
      ...(v.slug.trim() ? { slug: v.slug.trim() } : {}),
      description: v.description.trim() || null,
      position: Number.parseInt(v.position, 10) || 0,
      [c.imageField]: v.image || null,
      ...(kind === "category" ? { parentId: v.parentId || null } : { isFeatured: v.isFeatured }),
    };
    save.mutate(
      { id: item?.id, body },
      {
        onSuccess: () => {
          toast.success(item ? "Saved" : `Created ${v.name}`);
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
      title={item ? `Edit ${item.name}` : `New ${c.one}`}
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
        <Field label="Name" htmlFor="tx-name" error={formState.errors.name?.message}>
          <Input
            id="tx-name"
            invalid={!!formState.errors.name}
            {...register("name", {
              required: "Enter a name",
              minLength: { value: 2, message: "At least 2 characters" },
            })}
          />
        </Field>
        <Field
          label="URL slug"
          htmlFor="tx-slug"
          error={formState.errors.slug?.message}
          hint={`Made from the name when empty. Shown at ${c.storePath}/your-slug.`}
        >
          <Input id="tx-slug" {...register("slug")} />
        </Field>
        {kind === "category" && (
          <Field label="Parent" htmlFor="tx-parent" error={formState.errors.parentId?.message}>
            <Select id="tx-parent" {...register("parentId")}>
              <option value="">None (top level)</option>
              {items
                .filter((i) => !descendants.has(i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field
          label="Description"
          htmlFor="tx-description"
          error={formState.errors.description?.message}
        >
          <Textarea
            id="tx-description"
            maxLength={500}
            className="min-h-16"
            {...register("description")}
          />
        </Field>
        <Field label="Position" htmlFor="tx-position" hint="Lower numbers come first.">
          <Input
            id="tx-position"
            type="number"
            min={0}
            className="w-28"
            {...register("position")}
          />
        </Field>
        {kind === "collection" && (
          <Checkbox label="Feature on the homepage" {...register("isFeatured")} />
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">{kind === "category" ? "Image" : "Banner image"}</p>
          {image && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview from any image host */}
              <img src={image} alt="" className="bg-surface h-16 w-28 rounded-md object-cover" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setValue("image", "", { shouldDirty: true })}
              >
                Remove
              </Button>
            </div>
          )}
          <ImagePicker
            folder={c.folder}
            onAdd={(url) => setValue("image", url, { shouldDirty: true })}
          />
        </div>
      </form>
    </Dialog>
  );
}

export function Taxonomy({ kind }: { kind: Kind }) {
  const c = CONFIG[kind];
  const { list, save, remove } = useCrud<Item>(c.path, [
    ["admin", kind === "category" ? "categories" : "collections"],
  ]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const items = list.data ?? [];
  const rows = kind === "category" ? treeOrder(items) : items.map((item) => ({ item, depth: 0 }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New {c.one}
          </Button>
        }
      />
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data && items.length === 0 ? (
        <EmptyState title={`No ${c.title.toLowerCase()} yet`} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th className="text-right">Products</Th>
              <Th className="text-right">Position</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {list.isPending ? (
              <LoadingRows cols={5} />
            ) : (
              rows.map(({ item, depth }) => (
                <Tr key={item.id}>
                  <Td>
                    <span className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
                      {depth > 0 && (
                        <span className="text-muted" aria-hidden>
                          ↳
                        </span>
                      )}
                      <span className="font-medium">{item.name}</span>
                      {item.isFeatured && <Badge tone="brand">Featured</Badge>}
                    </span>
                  </Td>
                  <Td>
                    <a
                      href={`${adminConfig.storefrontUrl}${c.storePath}/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted font-mono text-xs hover:underline"
                    >
                      {item.slug}
                    </a>
                  </Td>
                  <Td className="text-right tabular-nums">{item._count.products}</Td>
                  <Td className="text-muted text-right tabular-nums">{item.position}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(item);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(item)}>
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      <ItemDialog
        kind={kind}
        item={editing}
        items={items}
        open={open}
        onClose={() => setOpen(false)}
        save={save}
      />
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
        {kind === "category"
          ? "Its products are kept (they just leave this category) and its sub-categories move to the top level."
          : "Its products are kept; they just leave this collection."}
      </ConfirmDialog>
    </div>
  );
}

export const Categories = () => <Taxonomy kind="category" />;
export const Collections = () => <Taxonomy kind="collection" />;
