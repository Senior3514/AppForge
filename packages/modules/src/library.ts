import { z } from "zod";
import { idSchema } from "@appforge/spec";
import { defineModule } from "./define";

const text = (max = 200) => z.string().min(1).max(max);

export const hero = defineModule({
  id: "hero", title: "Hero banner", description: "Large headline with an optional call-to-action button.",
  props: z.object({ headline: text(80), subtitle: z.string().max(160), cta: z.string().max(30) }),
  defaults: { headline: "Welcome", subtitle: "", cta: "" },
  collections: () => [], requires: [],
});

export const richText = defineModule({
  id: "text", title: "Text", description: "A paragraph of static copy.",
  props: z.object({ body: text(1000) }),
  defaults: { body: "Tell your story here." },
  collections: () => [], requires: [],
});

export const collectionList = defineModule({
  id: "list", title: "List", description: "Scrollable list of records from a data model (menu, classes, news).",
  props: z.object({ collection: idSchema, titleField: idSchema, subtitleField: idSchema.nullable() }),
  defaults: { collection: "items", titleField: "name", subtitleField: null },
  collections: (p) => [p.collection], requires: [],
});

export const booking = defineModule({
  id: "booking", title: "Booking form", description: "Let customers request an appointment or reservation.",
  props: z.object({ collection: idSchema, submitLabel: text(30), askPhone: z.boolean() }),
  defaults: { collection: "bookings", submitLabel: "Book now", askPhone: true },
  collections: (p) => [p.collection], requires: [],
});

export const catalog = defineModule({
  id: "catalog", title: "Product catalog", description: "Products with cart and checkout.",
  props: z.object({ collection: idSchema, currency: z.string().regex(/^[A-Z]{3}$/) }),
  defaults: { collection: "products", currency: "USD" },
  collections: (p) => [p.collection], requires: ["payments"],
});

export const loyalty = defineModule({
  id: "loyalty", title: "Loyalty card", description: "Stamp card: collect N visits, earn a reward.",
  props: z.object({ goal: z.number().int().min(2).max(30), reward: text(60) }),
  defaults: { goal: 10, reward: "Free item" },
  collections: () => [], requires: [],
});

export const contact = defineModule({
  id: "contact", title: "Contact & location", description: "Address, phone and opening hours.",
  props: z.object({ address: z.string().max(120), phone: z.string().max(30), hours: z.string().max(120) }),
  defaults: { address: "", phone: "", hours: "" },
  collections: () => [], requires: [],
});

export const radio = defineModule({
  id: "radio", title: "Audio stream", description: "Play a live radio or audio stream.",
  props: z.object({ streamUrl: z.string().url().startsWith("https://"), station: text(60) }),
  defaults: { streamUrl: "https://example.com/stream", station: "Live" },
  collections: () => [], requires: [],
});

export const announcements = defineModule({
  id: "announcements", title: "Announcements", description: "News feed with optional push notifications.",
  props: z.object({ collection: idSchema, pushOptIn: z.boolean() }),
  defaults: { collection: "news", pushOptIn: true },
  collections: (p) => [p.collection], requires: ["push"],
});

export const MODULES = [hero, richText, collectionList, booking, catalog, loyalty, contact, radio, announcements] as const;
export const moduleById = (id: string) => MODULES.find((m) => m.id === id);
