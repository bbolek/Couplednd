import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AvatarBadge, Body, Card, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

export function RecapScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const state = store.gameState;

  const epilogue = state?.log.filter((e) => e.kind === "narration").at(-1)?.text;
  const highlights = state?.log.filter((e) => e.kind === "dice" || e.kind === "item").slice(-6) ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingTop: 80, alignItems: "center" }}>
      <Text style={{ fontSize: 64 }}>🏆</Text>
      <Title>{t("recap.title")}</Title>
      {epilogue ? (
        <Card>
          <Body style={{ fontSize: 18, lineHeight: 28 }}>{epilogue}</Body>
        </Card>
      ) : null}

      {state ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {Object.values(state.characters).map((c) => (
            <View key={c.name} style={{ alignItems: "center", gap: 4 }}>
              <AvatarBadge avatar={c.avatar} size={56} />
              <Muted>{c.name}</Muted>
            </View>
          ))}
        </View>
      ) : null}

      {highlights.length > 0 ? (
        <Card style={{ alignSelf: "stretch", gap: 6 }}>
          <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("recap.highlights")}</Body>
          {highlights.map((h) => (
            <Muted key={h.id}>· {h.text}</Muted>
          ))}
        </Card>
      ) : null}

      <PrimaryButton
        label={`${t("recap.playAgain")} 🎲`}
        onPress={() => void store.endGame().then(() => store.go("newGame"))}
        style={{ alignSelf: "stretch" }}
      />
    </ScrollView>
  );
}
