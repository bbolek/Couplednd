import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Language } from "@familyquest/shared";
import { DM_MODELS, type DMModel } from "@familyquest/engine";
import { Body, Card, Chip, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const [draftKey, setDraftKey] = useState("");

  const maskedKey = store.apiKey ? `${store.apiKey.slice(0, 11)}…${store.apiKey.slice(-4)}` : "";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingTop: 64 }}>
      <Title>{t("settings.title")}</Title>

      <Card style={{ gap: 10 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("settings.apiKey")}</Body>
        <Muted>{t("settings.apiKeyHint")}</Muted>
        <TextInput
          value={draftKey}
          onChangeText={setDraftKey}
          placeholder={store.apiKey ? maskedKey : t("settings.apiKeyPlaceholder")}
          placeholderTextColor={theme.colors.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={{
            borderWidth: 2,
            borderColor: theme.colors.border,
            borderRadius: 16,
            padding: 14,
            fontSize: 16,
            color: theme.colors.text,
            fontFamily: theme.fonts.bodySemibold,
          }}
          onSubmitEditing={() => {
            if (draftKey.trim()) {
              void store.setApiKey(draftKey);
              setDraftKey("");
            }
          }}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {draftKey.trim() ? (
            <PrimaryButton
              label={t("common.done")}
              onPress={() => {
                void store.setApiKey(draftKey);
                setDraftKey("");
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <PrimaryButton
            label={t("settings.testKey")}
            variant="secondary"
            busy={store.keyStatus === "testing"}
            disabled={!store.apiKey && !draftKey.trim()}
            onPress={() => void store.testKey()}
            style={{ flex: 1 }}
          />
        </View>
        {store.keyStatus === "ok" ? <Body>{t("settings.keyWorks")}</Body> : null}
        {store.keyStatus === "bad" && store.apiKey ? <Muted>{t("settings.keyFailed")}</Muted> : null}
        {store.keyStatus === "network" ? <Muted>{t("errors.network")}</Muted> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("settings.model")}</Body>
        {DM_MODELS.map((m) => (
          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Chip
              label={t(m.labelKey)}
              selected={store.model === m.id}
              onPress={() => void store.setModel(m.id as DMModel)}
            />
            <Muted>{m.pricing}</Muted>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("settings.language")}</Body>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["en", "tr"] as Language[]).map((lang) => (
            <Chip
              key={lang}
              label={lang === "en" ? "English" : "Türkçe"}
              selected={store.language === lang}
              onPress={() => void store.setLanguage(lang)}
            />
          ))}
        </View>
      </Card>

      {store.usage ? (
        <Muted>
          {t("settings.costSoFar", {
            cost: `~$${estimateCost(store.model, store.usage).toFixed(2)}`,
          })}
        </Muted>
      ) : null}

      <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => store.go("home")} />
    </ScrollView>
  );
}

function estimateCost(
  model: DMModel,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number },
): number {
  const [inRate, outRate] =
    model === "claude-opus-4-8" ? [5, 25] : model === "claude-sonnet-5" ? [3, 15] : [1, 5];
  return (
    (usage.inputTokens / 1_000_000) * inRate +
    (usage.cacheReadTokens / 1_000_000) * inRate * 0.1 +
    (usage.outputTokens / 1_000_000) * outRate
  );
}
