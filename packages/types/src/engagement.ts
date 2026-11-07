import type { OrderStatus, PaymentMethod, ReturnStatus } from "./enums";

/*
 * Phase 5 (engagement) response shapes: reviews, returns, search suggestions,
 * newsletter. Money is in minor units; dates are ISO strings.
 */

// ───────────── Reviews ─────────────

export interface ReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  /** "Ayesha M." — first name and initial only. */
  author: string;
  createdAt: string;
  /** The store's public reply, if any. */
  adminReply: string | null;
}

export interface ReviewSummaryDTO {
  average: number;
  count: number;
  /** Count per star rating, 5 down to 1. */
  distribution: { rating: number; count: number }[];
}

export interface ReviewsPageDTO {
  data: ReviewDTO[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: ReviewSummaryDTO;
}

export interface MyReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isApproved: boolean;
  adminReply: string | null;
  createdAt: string;
}

export interface ReviewEligibilityDTO {
  canReview: boolean;
  /** Why not: signed out, or no delivered order containing this product. */
  reason: "sign_in" | "not_purchased" | null;
  review: MyReviewDTO | null;
}

export interface AdminReviewDTO extends MyReviewDTO {
  product: { id: string; title: string; slug: string; image: string | null };
  user: { id: string; name: string; email: string };
}

// ───────────── Returns ─────────────

export const RETURN_REASON_LABEL: Record<string, string> = {
  wrong_size: "Wrong size",
  not_as_described: "Not as described",
  damaged: "Arrived damaged or faulty",
  wrong_item: "Received the wrong item",
  changed_mind: "Changed my mind",
  other: "Other",
};

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved: send it back",
  REJECTED: "Declined",
  RECEIVED: "Received",
  REFUNDED: "Refunded",
};

export interface ReturnItemDTO {
  orderItemId: string;
  title: string;
  size: string;
  color: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
}

export interface ReturnDTO {
  id: string;
  status: ReturnStatus;
  reason: string;
  details: string | null;
  items: ReturnItemDTO[];
  /** Sum of unit prices × quantities being returned. */
  itemsValue: number;
  refundAmount: number | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  refundedAt: string | null;
}

export interface AdminReturnListItemDTO {
  id: string;
  status: ReturnStatus;
  reason: string;
  orderNumber: string;
  customerName: string;
  email: string;
  itemCount: number;
  itemsValue: number;
  createdAt: string;
}

export interface AdminReturnDTO extends ReturnDTO {
  restocked: boolean;
  order: {
    number: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    customerName: string;
    email: string;
    phone: string;
    deliveredAt: string | null;
    /** Still refundable on the order's payment. */
    refundable: number;
  };
  /** Items value, capped at what is still refundable. */
  suggestedRefund: number;
}

// ───────────── Search, newsletter ─────────────

export interface SearchSuggestionsDTO {
  products: { slug: string; title: string; image: string | null; price: number }[];
  categories: { slug: string; name: string }[];
}

export interface NewsletterSubscriberDTO {
  id: string;
  email: string;
  createdAt: string;
  unsubscribedAt: string | null;
}

export interface AuthProvidersDTO {
  google: boolean;
}
