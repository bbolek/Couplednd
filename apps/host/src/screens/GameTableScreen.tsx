import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AvatarBadge, Body, Card, HeartsRow, Muted, PrimaryButton, Title } from "../ui/components";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

/**
 * The shared "table" — designed to sit in the middle of the family and be
 * readable from across a coffee table: big narration, glanceable party strip.
 */
export function GameTableScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const state = store.gameState;
  const feedRef = useRef<ScrollView>(null);

  useEffect(() => {
    feedRef.current?.scrollToEnd({ animated: true });
  }, [store.beats]);

  useEffect(() => {
    if (state?.phase === "ended") store.go("recap");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  if (!state) return null;

  const waitingRoll = Object.values(state.pending.rolls)[0];
  const waitingTask = Object.values(state.pending.tasks)[0];
  const waiting = waitingRoll ?? waitingTask;
  const waitingName = waiting ? state.players[waiting.playerId]?.name : null;

  return (
    <View style={{ flex: 1, paddingTop: 56, gap: 12 }}>
      {/* Scene banner */}
      <View style={{ paddingHorizontal: 20, gap: 2 }}>
        <Muted>{t("table.scene")}</Muted>
        <Title style={{ fontSize: 24 }}>
          {state.scene ? `🎬 ${state.scene.title}` : state.setup.worldBible?.title}
        </Title>
      </View>

      {/* Party strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {Object.entries(state.characters).map(([playerId, c]) => (
          <Card key={playerId} style={{ padding: 10, alignItems: "center", gap: 4, minWidth: 96 }}>
            <AvatarBadge avatar={c.avatar} size={44} knockedOut={c.status === "knockedOut"} />
            <Body style={{ fontFamily: theme.fonts.displayBold, fontSize: 14 }}>{c.name}</Body>
            <HeartsRow hp={c.hp} maxHp={c.maxHp} />
            {c.items.length > 0 ? (
              <Text style={{ fontSize: 13 }}>{c.items.map((i) => i.emoji).join(" ")}</Text>
            ) : null}
            {state.players[playerId]?.connection === "offline" ? <Muted>💤</Muted> : null}
          </Card>
        ))}
      </ScrollView>

      {/* Narration feed */}
      <ScrollView ref={feedRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
        {store.beats.map((beat) => (
          <Card key={beat.messageId} style={{ borderTopLeftRadius: 6 }}>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 19,
                lineHeight: 30,
                color: theme.colors.text,
              }}
            >
              {beat.text}
              {!beat.done ? " ▍" : ""}
            </Text>
          </Card>
        ))}
        {store.beats.length === 0 ? (
          <Muted style={{ textAlign: "center", paddingTop: 40 }}>🔮 {t("play.yourTurnSoon")}</Muted>
        ) : null}
      </ScrollView>

      {/* Status + DM controls */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
        {waitingName ? (
          <Body style={{ textAlign: "center", fontFamily: theme.fonts.display }}>
            {waitingRoll ? "🎲" : "🗣️"} {t("play.waitingOn", { name: waitingName })}
          </Body>
        ) : null}
        {store.dmError ? (
          <Card style={{ borderColor: theme.colors.danger, gap: 8 }}>
            <Body>{store.dmError}</Body>
            <PrimaryButton
              label={t("common.retry")}
              variant="secondary"
              onPress={() => {
                store.clearDmError();
                void store.nudge();
              }}
            />
          </Card>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PrimaryButton
            label={`✨ ${t("table.nudge")}`}
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => void store.nudge()}
          />
          <PrimaryButton
            label={t("common.done")}
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => void store.endGame()}
          />
        </View>
      </View>
    </View>
  );
}
