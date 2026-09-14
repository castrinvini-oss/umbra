import type { Tone } from "@/components/ui/primitives";

export const paymentTone: Record<string, Tone> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "info",
  EXPIRED: "neutral",
};

export const subscriptionTone: Record<string, Tone> = {
  ACTIVE: "success",
  PENDING: "warning",
  PAST_DUE: "warning",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export const leadStageTone: Record<string, Tone> = {
  NEW: "neutral",
  INTERESTED: "info",
  CHECKOUT: "primary",
  PAYMENT_PENDING: "warning",
  CUSTOMER: "success",
  RENEWAL: "success",
  CANCELLED: "danger",
};

export const reportStatusTone: Record<string, Tone> = {
  OPEN: "danger",
  REVIEWING: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export const contentStatusTone: Record<string, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  REMOVED: "danger",
};
