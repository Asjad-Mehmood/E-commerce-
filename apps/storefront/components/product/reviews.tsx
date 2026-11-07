"use client";

import type { ApiResponse, MyReviewDTO, ReviewEligibilityDTO, ReviewsPageDTO } from "@hoodie/types";
import { reviewSchema } from "@hoodie/validation";
import { Button, cn, Field, Input } from "@hoodie/ui";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import { Stars } from "./stars";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Sort = "newest" | "highest" | "lowest";

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const labels = ["Poor", "Fair", "Good", "Very good", "Excellent"];
  return (
    <fieldset>
      <legend className="text-sm font-medium">Your rating</legend>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}: ${labels[n - 1]}`}
            onClick={() => onChange(n)}
            className="focus-visible:ring-brand-500 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2"
          >
            <svg width="28" height="28" viewBox="0 0 20 20" aria-hidden>
              <path
                d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
                className={n <= value ? "fill-ink" : "fill-line"}
              />
            </svg>
          </button>
        ))}
        {value > 0 && <span className="text-muted ml-2 text-sm">{labels[value - 1]}</span>}
      </div>
    </fieldset>
  );
}

function ReviewForm({
  slug,
  existing,
  onDone,
}: {
  slug: string;
  existing: MyReviewDTO | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: { rating: number; title: string | null; body: string }) =>
      api<ApiResponse<MyReviewDTO>>(`/products/${slug}/reviews`, { method: "PUT", body: input }),
    onSuccess: ({ data }) => {
      toast.success(
        data.isApproved
          ? "Thanks! Your review is live."
          : "Thanks! Your review will appear after a quick check.",
      );
      void qc.invalidateQueries({ queryKey: ["reviews", slug] });
      onDone();
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(
          Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])),
        );
      } else toast.error(err instanceof ApiError ? err.message : "Couldn't save your review.");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reviewSchema.safeParse({ rating, title, body });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    save.mutate({
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      body: parsed.data.body,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="border-line space-y-4 rounded-xl border p-5">
      <RatingPicker value={rating} onChange={setRating} />
      {errors.rating && (
        <p role="alert" className="text-danger text-sm">
          {errors.rating}
        </p>
      )}
      <Field label="Title (optional)" htmlFor="review-title" error={errors.title}>
        <Input
          id="review-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
        />
      </Field>
      <Field
        label="Your review"
        htmlFor="review-body"
        error={errors.body}
        hint="How's the fit, fabric and size? It helps other shoppers choose."
      >
        <textarea
          id="review-body"
          value={body}
          maxLength={2000}
          rows={5}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={!!errors.body || undefined}
          className={cn(
            "border-line bg-canvas focus:border-ink focus:ring-ink/10 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
            errors.body && "border-danger",
          )}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {existing ? "Update review" : "Post review"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function WriteReview({ slug }: { slug: string }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const eligibility = useQuery({
    queryKey: ["reviews", slug, "eligibility", me.data?.id ?? null],
    queryFn: async () =>
      (await api<ApiResponse<ReviewEligibilityDTO>>(`/products/${slug}/reviews/eligibility`)).data,
    enabled: me.isFetched,
  });
  const e = eligibility.data;
  if (!e) return null;

  if (open) return <ReviewForm slug={slug} existing={e.review} onDone={() => setOpen(false)} />;
  if (e.review) {
    return (
      <div className="bg-surface rounded-xl p-4 text-sm">
        <p className="font-medium">
          Your review
          {!e.review.isApproved && (
            <span className="text-muted font-normal"> · waiting for a quick check</span>
          )}
        </p>
        <Stars rating={e.review.rating} size={14} className="mt-1 flex" />
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Edit your review
        </Button>
      </div>
    );
  }
  if (e.canReview) return <Button onClick={() => setOpen(true)}>Write a review</Button>;
  return (
    <p className="text-muted text-sm">
      {e.reason === "sign_in" ? (
        <>
          <Link href={`/login?next=/products/${slug}%23reviews`} className="text-ink underline">
            Sign in
          </Link>{" "}
          to review a hoodie you&apos;ve bought.
        </>
      ) : (
        "You can review this hoodie once an order with it has been delivered to you."
      )}
    </p>
  );
}

/** Rating summary, filters, the review list and the "write a review" form. */
export function Reviews({ slug }: { slug: string }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [rating, setRating] = useState<number | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["reviews", slug, sort, rating],
    queryFn: ({ pageParam }) =>
      api<ReviewsPageDTO>(
        `/products/${slug}/reviews?page=${pageParam}&limit=6&sort=${sort}${rating ? `&rating=${rating}` : ""}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
  const first = query.data?.pages[0];
  const summary = first?.summary;
  const reviews = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <section id="reviews" className="mt-16 scroll-mt-24" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl font-bold tracking-tight">
        Reviews
      </h2>
      <div className="mt-6 grid gap-10 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-5">
          {summary && summary.count > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">{summary.average.toFixed(1)}</span>
                <span>
                  <Stars rating={summary.average} />
                  <span className="text-muted block text-sm">
                    {summary.count} review{summary.count === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
              <ul className="space-y-1.5" aria-label="Filter by rating">
                {summary.distribution.map((d) => {
                  const share = summary.count ? (d.count / summary.count) * 100 : 0;
                  const active = rating === d.rating;
                  return (
                    <li key={d.rating}>
                      <button
                        type="button"
                        disabled={d.count === 0}
                        aria-pressed={active}
                        onClick={() => setRating(active ? null : d.rating)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-1 py-0.5 text-sm disabled:opacity-50",
                          active ? "bg-surface font-semibold" : "hover:bg-surface",
                        )}
                      >
                        <span className="w-12 text-left">{d.rating} star</span>
                        <span
                          className="bg-line h-2 flex-1 overflow-hidden rounded-full"
                          aria-hidden
                        >
                          <span
                            className="bg-ink block h-full rounded-full"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="text-muted w-6 text-right tabular-nums">{d.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            summary && (
              <p className="text-muted text-sm">
                No reviews yet. Be the first to share how it fits.
              </p>
            )
          )}
          <WriteReview slug={slug} />
        </div>

        <div>
          {summary && summary.count > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted text-sm">
                {rating
                  ? `Showing ${rating}-star reviews`
                  : "All reviews are from verified buyers."}
                {rating && (
                  <button
                    type="button"
                    className="text-ink ml-2 underline"
                    onClick={() => setRating(null)}
                  >
                    Show all
                  </button>
                )}
              </p>
              <select
                aria-label="Sort reviews"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="border-line bg-canvas h-9 rounded-lg border px-2 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </div>
          )}
          <ul
            className={cn(
              "divide-line divide-y",
              query.isFetching && !query.isFetchingNextPage && "opacity-60",
            )}
          >
            {reviews.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} size={14} />
                  {r.title && <h3 className="font-semibold">{r.title}</h3>}
                </div>
                <p className="text-muted mt-1 text-xs">
                  {r.author} · Verified buyer · {dateFmt.format(new Date(r.createdAt))}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
                {r.adminReply && (
                  <div className="bg-surface mt-3 rounded-lg p-3 text-sm">
                    <p className="font-semibold">Reply from the store</p>
                    <p className="text-muted mt-1 whitespace-pre-line">{r.adminReply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="outline"
              className="mt-4"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Show more reviews
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
