import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Muted, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const go = useHostStore((s) => s.go);
  const configured = useHostStore((s) => Boolean(s.serverAddress));
  const hasServer = useHostStore((s) => Boolean(s.serverAddress && s.hostKey));

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
          onPress={() => go(hasServer ? "newGame" : "settings")}
        />
        <PrimaryButton label={t("home.settings")} variant="ghost" onPress={() => go("settings")} />
      </View>
      {!configured ? (
        <Muted style={{ textAlign: "center" }}>{t("settings.serverMissing")}</Muted>
      ) : !hasServer ? (
        <Muted style={{ textAlign: "center" }}>{t("errors.noServer")}</Muted>
      ) : null}
    </View>
  );
}
