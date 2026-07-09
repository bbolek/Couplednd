import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  avatarColors,
  isValidAllocation,
  STAT_POOL,
  STATS,
  statMeta,
  type CharacterConcept,
  type Stats,
} from "@familyquest/shared";
import { AvatarBadge, Body, Card, Chip, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

const FACES = ["🦊", "🐶", "🐱", "🐰", "🐻", "🦁", "🦄", "🐲", "🤖", "🧚", "🦉", "🐙"];

export function HostCharacterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const concepts = store.gameState?.setup.concepts ?? [];

  const [concept, setConcept] = useState<CharacterConcept | null>(null);
  const [name, setName] = useState("");
  const [face, setFace] = useState(FACES[0]!);
  const [color, setColor] = useState("coral");
  const [stats, setStats] = useState<Stats>({ brave: 2, smart: 2, charm: 2, sneaky: 2 });

  const left = STAT_POOL - STATS.reduce((sum, s) => sum + stats[s], 0);
  const valid = useMemo(
    () => isValidAllocation(stats) && name.trim().length > 0,
    [stats, name],
  );

  function pick(c: CharacterConcept) {
    setConcept(c);
    setName(c.name);
    setStats(c.suggestedStats);
    if (FACES.includes(c.emoji)) setFace(c.emoji);
  }

  function bump(stat: (typeof STATS)[number], delta: 1 | -1) {
    const next = { ...stats, [stat]: stats[stat] + delta };
    if (next[stat] < 0 || next[stat] > 4) return;
    if (STATS.reduce((sum, s) => sum + next[s], 0) > STAT_POOL) return;
    setStats(next);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingTop: 64 }}>
      <Title>{t("character.title")}</Title>

      {concepts.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {concepts.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => pick(c)}
              style={{
                width: "47%",
                alignItems: "center",
                gap: 4,
                padding: 12,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: concept?.id === c.id ? theme.colors.primary : theme.colors.border,
                backgroundColor: theme.colors.surfaceRaised,
              }}
            >
              <Text style={{ fontSize: 38 }}>{c.emoji}</Text>
              <Body style={{ fontFamily: theme.fonts.displayBold }}>{c.name}</Body>
              <Muted style={{ textAlign: "center", fontSize: 12 }}>{c.tagline}</Muted>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Card style={{ gap: 12 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("character.stepName")}</Body>
        <TextField value={name} onChange={setName} />
        <View style={{ alignItems: "center" }}>
          <AvatarBadge avatar={{ emoji: face, color }} size={80} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {FACES.map((f) => (
            <Chip key={f} label={f} selected={face === f} onPress={() => setFace(f)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
          {Object.entries(avatarColors).map(([token, hex]) => (
            <Pressable
              key={token}
              onPress={() => setColor(token)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: hex,
                borderWidth: 3,
                borderColor: color === token ? theme.colors.text : "transparent",
              }}
            />
          ))}
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>
          {t("character.stepStats")} · {left > 0 ? t("character.pointsLeft", { count: left }) : "✓"}
        </Body>
        {STATS.map((stat) => (
          <View key={stat} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 20 }}>{statMeta[stat].emoji}</Text>
            <Body style={{ flex: 1, fontFamily: theme.fonts.display }}>
              {t(`character.stat_${stat}`)}
            </Body>
            <RoundButton label="−" onPress={() => bump(stat, -1)} />
            <Body style={{ width: 22, textAlign: "center", fontFamily: theme.fonts.bodyBold }}>
              {stats[stat]}
            </Body>
            <RoundButton label="+" onPress={() => bump(stat, 1)} />
          </View>
        ))}
      </Card>

      <PrimaryButton
        label={`${t("character.ready")} 🎉`}
        disabled={!valid}
        onPress={() =>
          store.createHostCharacter({
            name: name.trim(),
            species: concept?.species ?? "Adventurer",
            avatar: { emoji: face, color },
            stats,
          })
        }
      />
      <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => store.go("lobby")} />
    </ScrollView>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.secondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 22, fontFamily: theme.fonts.bodyBold }}>{label}</Text>
    </Pressable>
  );
}

function TextField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      maxLength={24}
      style={{
        borderWidth: 2,
        borderColor: theme.colors.border,
        borderRadius: 16,
        padding: 14,
        fontSize: 20,
        textAlign: "center",
        color: theme.colors.text,
        fontFamily: theme.fonts.displayBold,
      }}
    />
  );
}
