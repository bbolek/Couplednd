import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Muted, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const go = useHostStore((s) => s.go);
  const hasKey = useHostStore((s) => Boolean(s.apiKey));

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28, padding: 24 }}>
      <Text style={{ fontSize: 72 }}>🎲</Text>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Title style={{ fontSize: theme.sizes.hero }}>{t("app.name")}</Title>
        <Muted>{t("app.tagline")}</Muted>
      </View>
      <View style={{ gap: 14, width: "100%", maxWidth: 340 }}>
        <PrimaryButton
          label={`${t("home.newGame")} ✨`}
          onPress={() => go(hasKey ? "newGame" : "settings")}
        />
        <PrimaryButton label={t("home.settings")} variant="ghost" onPress={() => go("settings")} />
      </View>
      {!hasKey ? <Muted style={{ textAlign: "center" }}>{t("errors.noKey")}</Muted> : null}
    </View>
  );
}
