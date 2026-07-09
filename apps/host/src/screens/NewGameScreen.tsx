import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Audience } from "@familyquest/shared";
import { Body, Card, Chip, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

const AUDIENCES: { id: Audience; labelKey: string; hintKey: string; emoji: string }[] = [
  { id: "kids", labelKey: "newGame.audienceKids", hintKey: "newGame.audienceKidsHint", emoji: "🧸" },
  { id: "family", labelKey: "newGame.audienceFamily", hintKey: "newGame.audienceFamilyHint", emoji: "👨‍👩‍👧‍👦" },
  { id: "grownups", labelKey: "newGame.audienceGrownups", hintKey: "newGame.audienceGrownupsHint", emoji: "🍷" },
];

export function NewGameScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const [shows, setShows] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [audience, setAudience] = useState<Audience>("family");

  function addShow() {
    const value = draft.trim();
    if (!value || shows.includes(value) || shows.length >= 5) return;
    setShows([...shows, value]);
    setDraft("");
  }

  if (store.building) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <Text style={{ fontSize: 64 }}>🪄</Text>
        <Title>{t("newGame.building")}</Title>
        <Muted style={{ textAlign: "center" }}>{t("newGame.buildingHint")}</Muted>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingTop: 64 }}>
      <Title>{t("newGame.title")}</Title>

      <Card style={{ gap: 12 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("newGame.showsPrompt")}</Body>
        <Muted>{t("newGame.showsHint")}</Muted>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t("newGame.showsPlaceholder")}
            placeholderTextColor={theme.colors.textSoft}
            onSubmitEditing={addShow}
            style={{
              flex: 1,
              borderWidth: 2,
              borderColor: theme.colors.border,
              borderRadius: 16,
              padding: 14,
              fontSize: 16,
              color: theme.colors.text,
              fontFamily: theme.fonts.bodySemibold,
            }}
          />
          <PrimaryButton label={t("newGame.add")} variant="secondary" onPress={addShow} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {shows.map((show) => (
            <Chip
              key={show}
              label={`${show} ✕`}
              selected
              onPress={() => setShows(shows.filter((s) => s !== show))}
            />
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("newGame.audiencePrompt")}</Body>
        {AUDIENCES.map((option) => (
          <View key={option.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Chip
              label={`${option.emoji} ${t(option.labelKey)}`}
              selected={audience === option.id}
              onPress={() => setAudience(option.id)}
            />
            <Muted style={{ flex: 1 }}>{t(option.hintKey)}</Muted>
          </View>
        ))}
      </Card>

      <PrimaryButton
        label={`${t("newGame.buildWorld")} 🌍`}
        disabled={shows.length === 0}
        onPress={() => void store.startNewGame(shows, audience)}
      />
      <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => store.go("home")} />
      {store.dmError ? <Muted style={{ textAlign: "center" }}>{store.dmError}</Muted> : null}
    </ScrollView>
  );
}
