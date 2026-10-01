import { useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { dirOf } from "@appforge/i18n";
import type { AppSpec, Block } from "@appforge/modules";
import { tr } from "@appforge/spec";
import { paletteFromPrimary } from "@appforge/ui-tokens";
import type { Backend } from "./backend";
import { loadNumber, saveNumber } from "./storage";

type Pal = ReturnType<typeof paletteFromPrimary>;
interface Ctx { spec: AppSpec; T: (s: string) => string; p: Pal; radius: number; backend: Backend }

/** Native renderer for any AppSpec: real RN views, no WebView. Mirrors the web preview module by module. */
export function Renderer({ spec, backend, dark = false }: { spec: AppSpec; backend: Backend; dark?: boolean }) {
  const [tab, setTab] = useState(spec.navigation[0]!);
  useEffect(() => { backend.track("screen_view", tab); }, [tab, backend]);
  useEffect(() => { const i = setInterval(() => void backend.flush(), 15_000); return () => { clearInterval(i); void backend.flush(); }; }, [backend]);
  const p = paletteFromPrimary(spec.theme.primary, dark ? "dark" : "light");
  const ctx: Ctx = { spec, T: (s) => tr(spec, spec.locale, s), p, radius: spec.theme.radius, backend };
  const screen = spec.screens.find((s) => s.id === tab) ?? spec.screens[0]!;
  return (
    <View style={{ flex: 1, backgroundColor: p.background, direction: dirOf(spec.locale) }}>
      <View style={{ backgroundColor: p.primary, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: p.onPrimary, fontSize: 20, fontWeight: "600" }}>{ctx.T(spec.name)}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        {screen.blocks.map((b) => <BlockView key={b.id} b={b} {...ctx} />)}
      </ScrollView>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderColor: p.border, backgroundColor: p.surface }}>
        {spec.navigation.map((id) => {
          const s = spec.screens.find((x) => x.id === id)!;
          const on = id === screen.id;
          return (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(id)} style={{ flex: 1, paddingVertical: 14, alignItems: "center" }}>
              <Text numberOfLines={1} style={{ color: on ? p.primary : p.mutedText, fontSize: 12, fontWeight: "500" }}>{ctx.T(s.title)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Card = ({ p, radius, children }: { p: Pal; radius: number; children: ReactNode }) => (
  <View style={{ backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: radius, padding: 12 }}>{children}</View>
);
const Btn = ({ p, radius, label, onPress }: { p: Pal; radius: number; label: string; onPress?: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: p.primary, borderRadius: radius, paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start" }}>
    <Text style={{ color: p.onPrimary, fontWeight: "600" }}>{label}</Text>
  </Pressable>
);
const rows = (spec: AppSpec, id: string) => spec.dataModels.find((d) => d.id === id)?.seed ?? [];

function BlockView({ b, spec, T, p, radius, backend }: { b: Block } & Ctx) {
  switch (b.module) {
    case "hero": return (
      <View style={{ backgroundColor: p.primary, borderRadius: radius, padding: 20 }}>
        <Text style={{ color: p.onPrimary, fontSize: 28, fontWeight: "700" }}>{T(b.props.headline)}</Text>
        {!!b.props.subtitle && <Text style={{ color: p.onPrimary, marginTop: 4 }}>{T(b.props.subtitle)}</Text>}
        {!!b.props.cta && <Text style={{ color: p.onPrimary, marginTop: 12, fontWeight: "600" }}>{T(b.props.cta)}</Text>}
      </View>);
    case "text": return <Text style={{ color: p.text }}>{T(b.props.body)}</Text>;
    case "list": case "announcements": {
      const props = b.props as { collection: string; titleField?: string; subtitleField?: string | null };
      const tf = props.titleField ?? spec.dataModels.find((d) => d.id === props.collection)?.fields[0]?.name ?? "name";
      return <>{rows(spec, props.collection).map((r, i) => (
        <Card key={i} p={p} radius={radius}>
          <Text style={{ color: p.text, fontWeight: "500" }}>{T(String(r[tf] ?? ""))}</Text>
          {!!props.subtitleField && <Text style={{ color: p.mutedText }}>{String(r[props.subtitleField] ?? "")}</Text>}
        </Card>))}</>;
    }
    case "catalog": return <Catalog collection={b.props.collection} spec={spec} T={T} p={p} radius={radius} backend={backend} />;
    case "booking": return <Booking collection={b.props.collection} label={T(b.props.submitLabel)} askPhone={b.props.askPhone} p={p} radius={radius} backend={backend} />;
    case "loyalty": return <Loyalty id={`${spec.name}:${b.id}`} goal={b.props.goal} reward={T(b.props.reward)} p={p} radius={radius} />;
    case "contact": return <Card p={p} radius={radius}>{[b.props.address, b.props.phone, b.props.hours].filter(Boolean).map((l) => <Text key={l} style={{ color: p.text }}>{T(l)}</Text>)}</Card>;
    case "radio": return <Radio station={T(b.props.station)} p={p} radius={radius} />;
  }
}

function Catalog({ collection, spec, T, p, radius, backend }: { collection: string } & Ctx) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState<string | null>(null);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  async function checkout() {
    setNote(null);
    const url = await backend.checkout(Object.entries(cart).map(([name, qty]) => ({ name, qty })));
    if (url) await Linking.openURL(url);
    else setNote(backend.live ? "!" : "Demo preview: checkout is available once the app is published.");
  }
  return <>
    {rows(spec, collection).map((r, i) => {
      const name = String(r.name ?? "");
      return (
        <Card key={i} p={p} radius={radius}>
          <Text style={{ color: p.text, fontWeight: "500" }}>{T(name)}</Text>
          <Text style={{ color: p.mutedText }}>{String(r.price ?? "")}</Text>
          <Btn p={p} radius={radius} label="+" onPress={() => setCart((c) => ({ ...c, [name]: (c[name] ?? 0) + 1 }))} />
        </Card>
      );
    })}
    <Text style={{ color: p.text, fontWeight: "600" }} accessibilityLiveRegion="polite">🛒 {count}</Text>
    {count > 0 && <Btn p={p} radius={radius} label="Checkout" onPress={() => void checkout()} />}
    {note && <Text style={{ color: p.mutedText }} accessibilityRole="alert">{note}</Text>}
  </>;
}

function Booking({ collection, label, askPhone, p, radius, backend }: { collection: string; label: string; askPhone: boolean; p: Pal; radius: number; backend: Backend }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const input = { borderWidth: 1, borderColor: p.border, borderRadius: 8, padding: 8, color: p.text, backgroundColor: p.background };
  async function send() {
    if (!name.trim()) return;
    const ok = await backend.submit(collection, { name: name.trim(), ...(askPhone && phone.trim() ? { phone: phone.trim() } : {}) });
    setState(ok ? "sent" : "error");
  }
  return (
    <Card p={p} radius={radius}>
      <View style={{ gap: 8 }}>
        <TextInput value={name} onChangeText={setName} accessibilityLabel="name" style={input} />
        {askPhone && <TextInput value={phone} onChangeText={setPhone} accessibilityLabel="phone" keyboardType="phone-pad" style={input} />}
        <Btn p={p} radius={radius} label={label} onPress={() => void send()} />
        {state !== "idle" && <Text style={{ color: p.text }} accessibilityRole="alert">{state === "sent" ? "✓" : "!"}</Text>}
      </View>
    </Card>
  );
}

function Loyalty({ id, goal, reward, p, radius }: { id: string; goal: number; reward: string; p: Pal; radius: number }) {
  const [n, setN] = useState(0);
  useEffect(() => { void loadNumber(`loyalty:${id}`).then((v) => setN(Math.min(goal, v))); }, [id, goal]);
  const bump = () => setN((v) => { const next = Math.min(goal, v + 1); void saveNumber(`loyalty:${id}`, next); return next; });
  return (
    <Card p={p} radius={radius}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: goal }, (_, i) => <View key={i} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: p.primary, backgroundColor: i < n ? p.primary : "transparent" }} />)}
      </View>
      <Text style={{ color: p.text, marginVertical: 8 }}>{n >= goal ? `🎉 ${reward}` : `${n}/${goal} · ${reward}`}</Text>
      <Btn p={p} radius={radius} label="+1" onPress={bump} />
    </Card>
  );
}

function Radio({ station, p, radius }: { station: string; p: Pal; radius: number }) {
  const [on, setOn] = useState(false);
  return <Card p={p} radius={radius}><Text style={{ color: p.text, fontWeight: "500", marginBottom: 8 }}>{station}</Text><Btn p={p} radius={radius} label={on ? "⏸" : "▶"} onPress={() => setOn((v) => !v)} /></Card>;
}

