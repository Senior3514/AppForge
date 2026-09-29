import type { AppSpec } from "@appforge/modules";

/** Bundled demo so the runtime boots with no backend. */
export const SAMPLE_SPEC: AppSpec = {
  version: 1, name: "Sample Cafe", tagline: "Fresh, every day", locale: "en",
  theme: { primary: "#b5532a", radius: 14, font: "rounded" },
  navigation: ["home", "menu", "rewards"],
  screens: [
    { id: "home", title: "Home", icon: "home", blocks: [{ id: "hero", module: "hero", props: { headline: "Sample Cafe", subtitle: "Fresh, every day", cta: "Order" } }] },
    { id: "menu", title: "Menu", icon: "list", blocks: [{ id: "list", module: "list", props: { collection: "menu", titleField: "name", subtitleField: "price" } }] },
    { id: "rewards", title: "Rewards", icon: "star", blocks: [{ id: "card", module: "loyalty", props: { goal: 8, reward: "Free coffee" } }] },
  ],
  dataModels: [{ id: "menu", fields: [{ name: "name", type: "text" }, { name: "price", type: "text" }], seed: [{ name: "Latte", price: "$4" }, { name: "Croissant", price: "$3" }] }],
  translations: {}, features: { payments: false, push: false, analytics: true },
};
