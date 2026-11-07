"use client";

import type { ApiResponse, Fit, ProductStatus } from "@hoodie/types";
import { FITS } from "@hoodie/types";
import { Button, Field, Input, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm";
import { AffixInput, Checkbox, Select, Textarea } from "@/components/ui/controls";
import { ImagePicker } from "@/components/ui/image-input";
import { ErrorState, PageHeader, Section } from "@/components/ui/page";
import { ProductStatusBadge } from "@/components/ui/status";
import { api, ApiError, errorMessage } from "@/lib/api";
import { adminConfig } from "@/lib/config";
import { applyApiError, fromMinor, toMinor } from "@/lib/forms";
import { useCategories } from "./products-list";
import type { AdminProduct, TaxonomyItem } from "./types";
import { VariantsSection } from "./variants";

interface FormValues {
  title: string;
  slug: string;
  description: string;
  fit: Fit;
  fabric: string;
  careInfo: string;
  basePrice: string;
  compareAtPrice: string;
  status: ProductStatus;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  categoryIds: string[];
  collectionIds: string[];
}

interface ImageRow {
  url: string;
  alt: string;
  color: string;
}

const FIT_LABEL: Record<Fit, string> = { REGULAR: "Regular", OVERSIZED: "Oversized", SLIM: "Slim" };

const defaults = (p?: AdminProduct): FormValues => ({
  title: p?.title ?? "",
  slug: p?.slug ?? "",
  description: p?.description ?? "",
  fit: p?.fit ?? "REGULAR",
  fabric: p?.fabric ?? "",
  careInfo: p?.careInfo ?? "",
  basePrice: fromMinor(p?.basePrice),
  compareAtPrice: fromMinor(p?.compareAtPrice),
  status: p?.status ?? "DRAFT",
  isFeatured: p?.isFeatured ?? false,
  seoTitle: p?.seoTitle ?? "",
  seoDescription: p?.seoDescription ?? "",
  categoryIds: p?.categories.map((c) => c.id) ?? [],
  collectionIds: p?.collections.map((c) => c.id) ?? [],
});

function useCollections() {
  return useQuery({
    queryKey: ["admin", "collections"],
    queryFn: async () => (await api<ApiResponse<TaxonomyItem[]>>("/admin/collections")).data,
  });
}

function CheckList({
  items,
  value,
  onChange,
  empty,
}: {
  items: TaxonomyItem[] | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  if (!items) return <Skeleton className="h-20" />;
  if (items.length === 0) return <p className="text-muted text-sm">{empty}</p>;
  return (
    <div className="max-h-56 space-y-2 overflow-y-auto">
      {items.map((item) => (
        <Checkbox
          key={item.id}
          label={item.name}
          checked={value.includes(item.id)}
          onChange={(e) =>
            onChange(e.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))
          }
        />
      ))}
    </div>
  );
}

function Gallery({
  images,
  setImages,
  colors,
}: {
  images: ImageRow[];
  setImages: (rows: ImageRow[]) => void;
  colors: string[];
}) {
  const move = (i: number, by: number) => {
    const next = [...images];
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row!);
    setImages(next);
  };
  const patch = (i: number, p: Partial<ImageRow>) =>
    setImages(images.map((row, j) => (j === i ? { ...row, ...p } : row)));

  return (
    <Section
      title="Images"
      description="The first image is the main photo. Tag an image with a colour so the gallery switches when a shopper picks that colour."
    >
      {images.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="border-line space-y-2 rounded-lg border p-2">
              <div className="bg-surface relative aspect-square overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- previews from any image host */}
                <img src={img.url} alt={img.alt} className="size-full object-cover" />
                {i === 0 && (
                  <span className="bg-ink absolute left-2 top-2 rounded px-1.5 py-0.5 text-xs font-medium text-white">
                    Main
                  </span>
                )}
              </div>
              <Input
                aria-label={`Image ${i + 1} description`}
                placeholder="Describe the photo (alt text)"
                value={img.alt}
                onChange={(e) => patch(i, { alt: e.target.value })}
                maxLength={200}
                className="h-8"
              />
              <Select
                aria-label={`Image ${i + 1} colour`}
                value={img.color}
                onChange={(e) => patch(i, { color: e.target.value })}
                className="h-8"
              >
                <option value="">All colours</option>
                {[...new Set([...colors, ...(img.color ? [img.color] : [])])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <div className="flex justify-between">
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move image ${i + 1} earlier`}
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move image ${i + 1} later`}
                  >
                    →
                  </Button>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ImagePicker
        folder="products"
        multiple
        label="Upload images"
        onAdd={(url) => setImages([...images, { url, alt: "", color: "" }])}
      />
    </Section>
  );
}

function ProductEditor({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const qc = useQueryClient();
  const categories = useCategories();
  const collections = useCollections();
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const initialImages = useMemo(
    () =>
      product?.images.map((i) => ({ url: i.url, alt: i.alt ?? "", color: i.color ?? "" })) ?? [],
    [product?.images],
  );
  const [images, setImagesState] = useState<ImageRow[]>(initialImages);
  const [imagesDirty, setImagesDirty] = useState(false);
  const setImages = (rows: ImageRow[]) => {
    setImagesState(rows);
    setImagesDirty(true);
  };

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: defaults(product) });

  const colors = [...new Set(product?.variants.map((v) => v.color) ?? [])];

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (
        await api<ApiResponse<AdminProduct>>(
          product ? `/admin/products/${product.id}` : "/admin/products",
          {
            method: product ? "PATCH" : "POST",
            body,
          },
        )
      ).data,
  });

  const archive = useMutation({
    mutationFn: () => api(`/admin/products/${product!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Product archived");
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push("/products");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const basePrice = toMinor(v.basePrice);
    const compareAt = toMinor(v.compareAtPrice);
    if (basePrice === null || Number.isNaN(basePrice) || basePrice <= 0) {
      setError("basePrice", { message: "Enter a price above zero" });
      return;
    }
    if (compareAt !== null && Number.isNaN(compareAt)) {
      setError("compareAtPrice", { message: "Enter a number, or leave it empty" });
      return;
    }
    const body = {
      title: v.title.trim(),
      ...(v.slug.trim() ? { slug: v.slug.trim() } : {}),
      description: v.description.trim(),
      fit: v.fit,
      fabric: v.fabric.trim(),
      careInfo: v.careInfo.trim(),
      basePrice,
      compareAtPrice: compareAt,
      status: v.status,
      isFeatured: v.isFeatured,
      seoTitle: v.seoTitle.trim(),
      seoDescription: v.seoDescription.trim(),
      categoryIds: v.categoryIds,
      collectionIds: v.collectionIds,
      ...(!product || imagesDirty
        ? {
            images: images.map((img, position) => ({
              url: img.url,
              ...(img.alt.trim() ? { alt: img.alt.trim() } : {}),
              ...(img.color ? { color: img.color } : {}),
              position,
            })),
          }
        : {}),
    };
    save.mutate(body, {
      onSuccess: (saved) => {
        void qc.invalidateQueries({ queryKey: ["admin", "products"] });
        if (!product) {
          toast.success("Product created. Now add its sizes and colours.");
          router.replace(`/products/${saved.id}`);
          return;
        }
        qc.setQueryData(["admin", "product", saved.id], saved);
        reset(defaults(saved));
        setImagesDirty(false);
        toast.success("Product saved");
      },
      onError: (err) => {
        const msg = applyApiError(err, setError);
        setFormError(
          msg ??
            (err instanceof ApiError && err.status === 422
              ? "Check the highlighted fields."
              : null),
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
  });

  const seoTitle = watch("seoTitle");
  const seoDescription = watch("seoDescription");
  const dirty = isDirty || imagesDirty;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={
          product ? (
            <span className="flex flex-wrap items-center gap-3">
              {product.title} <ProductStatusBadge status={product.status} />
            </span>
          ) : (
            "Add product"
          )
        }
        description={
          product
            ? `${product.soldCount} sold · /products/${product.slug}`
            : "Start with the details. You'll add sizes and colours after saving."
        }
        actions={
          <>
            {product?.status === "ACTIVE" && (
              <a
                href={`${adminConfig.storefrontUrl}/products/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="border-line hover:bg-surface inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
              >
                View in store ↗
              </a>
            )}
            <Button type="submit" loading={save.isPending} disabled={!!product && !dirty}>
              {product ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      />

      {formError && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {formError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Details">
            <Field label="Title" htmlFor="title" error={errors.title?.message}>
              <Input
                id="title"
                invalid={!!errors.title}
                {...register("title", {
                  required: "Enter a title",
                  minLength: { value: 3, message: "At least 3 characters" },
                  maxLength: { value: 120, message: "At most 120 characters" },
                })}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              error={errors.description?.message}
              hint="Shown on the product page. Blank lines start new paragraphs."
            >
              <Textarea
                id="description"
                rows={6}
                invalid={!!errors.description}
                {...register("description", {
                  required: "Write a description",
                  minLength: { value: 10, message: "At least 10 characters" },
                })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Fit" htmlFor="fit">
                <Select id="fit" {...register("fit")}>
                  {FITS.map((f) => (
                    <option key={f} value={f}>
                      {FIT_LABEL[f]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Fabric"
                htmlFor="fabric"
                error={errors.fabric?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="fabric"
                  placeholder="e.g. 80% cotton, 20% polyester, 320 GSM"
                  {...register("fabric")}
                />
              </Field>
            </div>
            <Field label="Care" htmlFor="careInfo" error={errors.careInfo?.message}>
              <Input
                id="careInfo"
                placeholder="e.g. Machine wash cold, inside out"
                {...register("careInfo")}
              />
            </Field>
          </Section>

          <Section title="Pricing" description="Variants use this price unless they set their own.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price" htmlFor="basePrice" error={errors.basePrice?.message}>
                <AffixInput
                  id="basePrice"
                  prefix="Rs"
                  inputMode="decimal"
                  invalid={!!errors.basePrice}
                  {...register("basePrice", { required: "Enter a price" })}
                />
              </Field>
              <Field
                label="Compare-at price"
                htmlFor="compareAtPrice"
                error={errors.compareAtPrice?.message}
                hint="Optional. Shows the price crossed out, as a sale."
              >
                <AffixInput
                  id="compareAtPrice"
                  prefix="Rs"
                  inputMode="decimal"
                  invalid={!!errors.compareAtPrice}
                  {...register("compareAtPrice")}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Search engines"
            description="Leave empty to use the title and description."
          >
            <Field
              label="SEO title"
              htmlFor="seoTitle"
              error={errors.seoTitle?.message}
              hint={`${seoTitle.length}/70`}
            >
              <Input id="seoTitle" maxLength={70} {...register("seoTitle")} />
            </Field>
            <Field
              label="SEO description"
              htmlFor="seoDescription"
              error={errors.seoDescription?.message}
              hint={`${seoDescription.length}/160`}
            >
              <Textarea
                id="seoDescription"
                maxLength={160}
                className="min-h-16"
                {...register("seoDescription")}
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="slug"
              error={errors.slug?.message}
              hint="Made from the title when empty."
            >
              <AffixInput
                id="slug"
                prefix="/products/"
                invalid={!!errors.slug}
                {...register("slug")}
              />
            </Field>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Status">
            <Field
              label="Visibility"
              htmlFor="status"
              hint="Only active products appear in the store."
            >
              <Select id="status" {...register("status")}>
                <option value="DRAFT">Draft (hidden)</option>
                <option value="ACTIVE">Active (for sale)</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
            <Checkbox label="Featured on the homepage" {...register("isFeatured")} />
            {product?.status === "ACTIVE" && product.variants.every((v) => v.available <= 0) && (
              <p className="bg-warning/15 rounded-lg px-3 py-2 text-sm">
                This product is live but has no stock, so shoppers see it as sold out.
              </p>
            )}
          </Section>
          <Section
            title="Categories"
            actions={
              <Link href="/categories" className="text-sm underline">
                Manage
              </Link>
            }
          >
            <Controller
              control={control}
              name="categoryIds"
              render={({ field }) => (
                <CheckList
                  items={categories.data}
                  value={field.value}
                  onChange={field.onChange}
                  empty="No categories yet."
                />
              )}
            />
          </Section>
          <Section
            title="Collections"
            actions={
              <Link href="/collections" className="text-sm underline">
                Manage
              </Link>
            }
          >
            <Controller
              control={control}
              name="collectionIds"
              render={({ field }) => (
                <CheckList
                  items={collections.data}
                  value={field.value}
                  onChange={field.onChange}
                  empty="No collections yet."
                />
              )}
            />
          </Section>
          {product && product.status !== "ARCHIVED" && (
            <Button variant="outline" className="w-full" onClick={() => setArchiveOpen(true)}>
              Archive product
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {product ? (
          <VariantsSection product={product} />
        ) : (
          <Section title="Variants">
            <p className="text-muted text-sm">
              Save the product first, then generate its sizes and colours here.
            </p>
          </Section>
        )}

        <Gallery images={images} setImages={setImages} colors={colors} />
      </div>

      {product && (
        <ConfirmDialog
          open={archiveOpen}
          onClose={() => setArchiveOpen(false)}
          title={`Archive ${product.title}?`}
          tone="danger"
          confirmLabel="Archive"
          loading={archive.isPending}
          onConfirm={() => archive.mutate()}
        >
          It disappears from the store. Past orders keep it, and you can make it active again later.
        </ConfirmDialog>
      )}
    </form>
  );
}

export function NewProduct() {
  return <ProductEditor />;
}

export function EditProduct({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: async () => (await api<ApiResponse<AdminProduct>>(`/admin/products/${id}`)).data,
  });
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Product" back={{ href: "/products", label: "Products" }} />
        <ErrorState
          message={
            query.error instanceof ApiError && query.error.status === 404
              ? "This product doesn't exist."
              : errorMessage(query.error)
          }
        />
      </div>
    );
  }
  return <ProductEditor key={query.data.id} product={query.data} />;
}
