export const product = {
  name: "ClerkAI",
  legalName: "ClerkAI",
  supportEmail: "info@clerkai.it",
  publicUrl: "https://www.clerkai.it",
  locale: "it-IT",
  currency: "EUR",
  minimumCommitmentMonths: 3,
} as const;

export const supportMailto = (subject: string) =>
  `mailto:${product.supportEmail}?subject=${encodeURIComponent(subject)}`;
