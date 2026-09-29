export const LOCALES = ["en", "he", "ar", "es", "fr", "de", "pt", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

const RTL: ReadonlySet<Locale> = new Set<Locale>(["he", "ar"]);
export const isRtl = (l: Locale): boolean => RTL.has(l);
export const dirOf = (l: Locale): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", he: "עברית", ar: "العربية", es: "Español",
  fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский",
};

/** Platform UI strings (marketing site, studio). Generated apps use AppSpec.translations instead. */
const en = {
  "hero.placeholder": "Describe the app you want to build…",
  "hero.cta": "Generate my app",
  "hero.mic": "Speak your idea",
  "steps.understand": "Understanding your idea",
  "steps.modules": "Choosing modules",
  "steps.theme": "Designing theme",
  "steps.content": "Writing content",
  "steps.assemble": "Assembling app",
  "studio.undo": "Undo",
  "studio.redo": "Redo",
  "studio.publish": "Publish",
} as const;
export type MessageKey = keyof typeof en;

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en,
  he: {
    "hero.placeholder": "תארו את האפליקציה שאתם רוצים לבנות…",
    "hero.cta": "צרו את האפליקציה שלי",
    "hero.mic": "דברו את הרעיון",
    "steps.understand": "מבינים את הרעיון שלכם",
    "steps.modules": "בוחרים מודולים",
    "steps.theme": "מעצבים ערכת נושא",
    "steps.content": "כותבים תוכן",
    "steps.assemble": "מרכיבים את האפליקציה",
    "studio.undo": "ביטול",
    "studio.redo": "ביצוע חוזר",
    "studio.publish": "פרסום",
  },
  ar: {
    "hero.placeholder": "صف التطبيق الذي تريد بناءه…",
    "hero.cta": "أنشئ تطبيقي",
    "hero.mic": "انطق فكرتك",
    "steps.understand": "نفهم فكرتك",
    "steps.modules": "نختار الوحدات",
    "steps.theme": "نصمم المظهر",
    "steps.content": "نكتب المحتوى",
    "steps.assemble": "نجمع التطبيق",
    "studio.undo": "تراجع",
    "studio.redo": "إعادة",
    "studio.publish": "نشر",
  },
  es: {
    "hero.placeholder": "Describe la app que quieres crear…",
    "hero.cta": "Generar mi app",
    "hero.mic": "Di tu idea",
    "steps.understand": "Entendiendo tu idea",
    "steps.modules": "Eligiendo módulos",
    "steps.theme": "Diseñando el tema",
    "steps.content": "Escribiendo contenido",
    "steps.assemble": "Montando la app",
    "studio.undo": "Deshacer",
    "studio.redo": "Rehacer",
    "studio.publish": "Publicar",
  },
  fr: {
    "hero.placeholder": "Décrivez l'application que vous voulez créer…",
    "hero.cta": "Générer mon appli",
    "hero.mic": "Dites votre idée",
    "steps.understand": "Compréhension de votre idée",
    "steps.modules": "Choix des modules",
    "steps.theme": "Conception du thème",
    "steps.content": "Rédaction du contenu",
    "steps.assemble": "Assemblage de l'appli",
    "studio.undo": "Annuler",
    "studio.redo": "Rétablir",
    "studio.publish": "Publier",
  },
  de: {
    "hero.placeholder": "Beschreibe die App, die du bauen möchtest…",
    "hero.cta": "Meine App erstellen",
    "hero.mic": "Idee einsprechen",
    "steps.understand": "Deine Idee verstehen",
    "steps.modules": "Module auswählen",
    "steps.theme": "Design gestalten",
    "steps.content": "Inhalte schreiben",
    "steps.assemble": "App zusammensetzen",
    "studio.undo": "Rückgängig",
    "studio.redo": "Wiederholen",
    "studio.publish": "Veröffentlichen",
  },
  pt: {
    "hero.placeholder": "Descreva o app que você quer criar…",
    "hero.cta": "Gerar meu app",
    "hero.mic": "Fale sua ideia",
    "steps.understand": "Entendendo sua ideia",
    "steps.modules": "Escolhendo módulos",
    "steps.theme": "Criando o tema",
    "steps.content": "Escrevendo o conteúdo",
    "steps.assemble": "Montando o app",
    "studio.undo": "Desfazer",
    "studio.redo": "Refazer",
    "studio.publish": "Publicar",
  },
  ru: {
    "hero.placeholder": "Опишите приложение, которое хотите создать…",
    "hero.cta": "Создать приложение",
    "hero.mic": "Надиктовать идею",
    "steps.understand": "Разбираемся в вашей идее",
    "steps.modules": "Подбираем модули",
    "steps.theme": "Проектируем тему",
    "steps.content": "Пишем контент",
    "steps.assemble": "Собираем приложение",
    "studio.undo": "Отменить",
    "studio.redo": "Повторить",
    "studio.publish": "Опубликовать",
  },
};

export const t = (locale: Locale, key: MessageKey): string => MESSAGES[locale][key];

/** Example-prompt chips on the landing page; label doubles as the starter prompt in that language. */
export const EXAMPLE_KEYS = ["restaurant", "salon", "fitness", "ecommerce", "community", "radio", "church", "service", "loyalty"] as const;
export type ExampleKey = (typeof EXAMPLE_KEYS)[number];

export const EXAMPLES: Record<Locale, Record<ExampleKey, string>> = {
  en: { restaurant: "Restaurant", salon: "Salon booking", fitness: "Fitness coach", ecommerce: "E-commerce", community: "Community", radio: "Online radio", church: "Church / community", service: "Local service", loyalty: "Loyalty club" },
  he: { restaurant: "מסעדה", salon: "הזמנת תורים למספרה", fitness: "מאמן כושר", ecommerce: "חנות אונליין", community: "קהילה", radio: "רדיו אונליין", church: "בית כנסת / קהילה", service: "שירות מקומי", loyalty: "מועדון לקוחות" },
  ar: { restaurant: "مطعم", salon: "حجز صالون", fitness: "مدرب لياقة", ecommerce: "متجر إلكتروني", community: "مجتمع", radio: "راديو عبر الإنترنت", church: "كنيسة / جمعية", service: "خدمة محلية", loyalty: "نادي ولاء" },
  es: { restaurant: "Restaurante", salon: "Reservas de salón", fitness: "Entrenador personal", ecommerce: "Tienda online", community: "Comunidad", radio: "Radio online", church: "Iglesia / comunidad", service: "Servicio local", loyalty: "Club de fidelidad" },
  fr: { restaurant: "Restaurant", salon: "Réservation salon", fitness: "Coach sportif", ecommerce: "Boutique en ligne", community: "Communauté", radio: "Radio en ligne", church: "Église / association", service: "Service local", loyalty: "Club de fidélité" },
  de: { restaurant: "Restaurant", salon: "Salon-Buchung", fitness: "Fitness-Coach", ecommerce: "Onlineshop", community: "Community", radio: "Online-Radio", church: "Kirche / Gemeinde", service: "Lokaler Service", loyalty: "Bonusclub" },
  pt: { restaurant: "Restaurante", salon: "Agendamento de salão", fitness: "Personal trainer", ecommerce: "Loja online", community: "Comunidade", radio: "Rádio online", church: "Igreja / comunidade", service: "Serviço local", loyalty: "Clube de fidelidade" },
  ru: { restaurant: "Ресторан", salon: "Запись в салон", fitness: "Фитнес-тренер", ecommerce: "Интернет-магазин", community: "Сообщество", radio: "Онлайн-радио", church: "Церковь / община", service: "Местные услуги", loyalty: "Клуб лояльности" },
};
