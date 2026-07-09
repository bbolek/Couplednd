import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import QRCode from "react-native-qrcode-svg";
import { AvatarBadge, Body, Card, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

export function LobbyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const state = store.gameState;
  if (!state) return null;

  const players = Object.values(state.players);
  const heroes = players.filter((p) => state.characters[p.playerId]);
  const hostHasCharacter = Boolean(
    store.hostPlayerId && state.characters[store.hostPlayerId],
  );
  const canStart = heroes.length >= 1 && players.every((p) => state.characters[p.playerId]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingTop: 64, alignItems: "stretch" }}>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Title>{t("lobby.title")}</Title>
        <Muted>{state.setup.worldBible?.title}</Muted>
      </View>

      <Card style={{ alignItems: "center", gap: 12 }}>
        {store.joinUrl ? (
          <>
            <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 20 }}>
              <QRCode value={store.joinUrl} size={200} backgroundColor="#fff" color="#3A2E22" />
            </View>
            <Body style={{ fontFamily: theme.fonts.displayBold }}>{t("lobby.scanToJoin")}</Body>
            <Muted>{t("lobby.orVisit")}</Muted>
            <Body style={{ fontFamily: theme.fonts.bodyBold }}>{store.joinUrl}</Body>
          </>
        ) : (
          <Muted style={{ textAlign: "center" }}>{t("lobby.sameWifiHint")}</Muted>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Body style={{ fontFamily: theme.fonts.displayBold }}>
          {t("lobby.joined", { count: players.length })}
        </Body>
        {players.map((p) => {
          const c = state.characters[p.playerId];
          return (
            <View key={p.playerId} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {c ? (
                <AvatarBadge avatar={c.avatar} size={40} />
              ) : (
                <Text style={{ fontSize: 26 }}>⏳</Text>
              )}
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: theme.fonts.bodyBold }}>
                  {p.name}
                  {p.isHost ? ` · ${t("table.hostBadge")}` : ""}
                </Body>
                <Muted>{c ? `${c.name} — ${c.species}` : t("lobby.waitingForCharacters")}</Muted>
              </View>
              {p.connection === "offline" ? <Muted>💤</Muted> : null}
            </View>
          );
        })}
      </Card>

      {!hostHasCharacter ? (
        <PrimaryButton
          label={`${t("lobby.createMyCharacter")} 🎨`}
          variant="secondary"
          onPress={() => store.go("hostCharacter")}
        />
      ) : null}

      <PrimaryButton
        label={`${t("lobby.startAdventure")} 🚀`}
        disabled={!canStart}
        onPress={() => void store.startAdventure()}
      />
      <PrimaryButton label={t("common.cancel")} variant="ghost" onPress={() => void store.endGame()} />
    </ScrollView>
  );
}
