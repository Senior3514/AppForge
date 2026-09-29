import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { dirOf } from "@appforge/i18n";
import type { AppSpec, Block } from "@appforge/modules";
import { tr } from "@appforge/spec";
import { paletteFromPrimary } from "@appforge/ui-tokens";

type Pal = ReturnType<typeof paletteFromPrimary>;
interface Ctx { spec: AppSpec; T: (s: string) => string; p: Pal; radius: number }

/** Native renderer for any AppSpec: real RN views, no WebView. Mirrors the web preview module by module. */
export function Renderer({ spec, dark = false }: { spec: AppSpec; dark?: boolean }) {
  const [tab, setTab] = useState(spec.navigation[0]!);
  const p = paletteFromPrimary(spec.theme.primary, dark ? "dark" : "light");
  const ctx: Ctx = { spec, T: (s) => tr(spec, spec.locale, s), p, radius: spec.theme.radius };
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

function BlockView({ b, spec, T, p, radius }: { b: Block } & Ctx) {
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
    case "catalog": return <Catalog collection={b.props.collection} spec={spec} T={T} p={p} radius={radius} />;
    case "booking": return <Booking label={T(b.props.submitLabel)} askPhone={b.props.askPhone} p={p} radius={radius} />;
    case "loyalty": return <Loyalty goal={b.props.goal} reward={T(b.props.reward)} p={p} radius={radius} />;
    case "contact": return <Card p={p} radius={radius}>{[b.props.address, b.props.phone, b.props.hours].filter(Boolean).map((l) => <Text key={l} style={{ color: p.text }}>{T(l)}</Text>)}</Card>;
    case "radio": return <Radio station={T(b.props.station)} p={p} radius={radius} />;
  }
}

function Catalog({ collection, spec, T, p, radius }: { collection: string } & Ctx) {
  const [cart, setCart] = useState(0);
  return <>
    {rows(spec, collection).map((r, i) => (
      <Card key={i} p={p} radius={radius}>
        <Text style={{ color: p.text, fontWeight: "500" }}>{T(String(r.name ?? ""))}</Text>
        <Text style={{ color: p.mutedText }}>{String(r.price ?? "")}</Text>
        <Btn p={p} radius={radius} label="+" onPress={() => setCart((c) => c + 1)} />
      </Card>))}
    <Text style={{ color: p.text, fontWeight: "600" }} accessibilityLiveRegion="polite">🛒 {cart}</Text>
  </>;
}

function Booking({ label, askPhone, p, radius }: { label: string; askPhone: boolean; p: Pal; radius: number }) {
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const input = { borderWidth: 1, borderColor: p.border, borderRadius: 8, padding: 8, color: p.text, backgroundColor: p.background };
  return (
    <Card p={p} radius={radius}>
      <View style={{ gap: 8 }}>
        <TextInput value={name} onChangeText={setName} accessibilityLabel="name" style={input} />
        {askPhone && <TextInput accessibilityLabel="phone" keyboardType="phone-pad" style={input} />}
        <Btn p={p} radius={radius} label={label} onPress={() => name.trim() && setDone(true)} />
        {done && <Text style={{ color: p.text }} accessibilityRole="alert">✓</Text>}
      </View>
    </Card>
  );
}

function Loyalty({ goal, reward, p, radius }: { goal: number; reward: string; p: Pal; radius: number }) {
  const [n, setN] = useState(0);
  return (
    <Card p={p} radius={radius}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: goal }, (_, i) => <View key={i} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: p.primary, backgroundColor: i < n ? p.primary : "transparent" }} />)}
      </View>
      <Text style={{ color: p.text, marginVertical: 8 }}>{n >= goal ? `🎉 ${reward}` : `${n}/${goal} · ${reward}`}</Text>
      <Btn p={p} radius={radius} label="+1" onPress={() => setN((v) => Math.min(goal, v + 1))} />
    </Card>
  );
}

function Radio({ station, p, radius }: { station: string; p: Pal; radius: number }) {
  const [on, setOn] = useState(false);
  return <Card p={p} radius={radius}><Text style={{ color: p.text, fontWeight: "500", marginBottom: 8 }}>{station}</Text><Btn p={p} radius={radius} label={on ? "⏸" : "▶"} onPress={() => setOn((v) => !v)} /></Card>;
}

