import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, Text, TextInput, View } from "react-native";
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

const BUILD_EMOJIS = ["🗺️", "🏰", "🐉", "🌋", "🧭", "✨"];
const EMOJI_SWAP_MS = 1400;

/** World-building wait screen: emoji conjured one after another out of a
 * gentle pop, with bouncing dots — enough life for a ~30s wait. */
function BuildingScreen() {
  const { t } = useTranslation();
  const [emojiIndex, setEmojiIndex] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    let index = 0;
    const conjure = () => {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    };
    conjure();
    const timer = setInterval(() => {
      index = (index + 1) % BUILD_EMOJIS.length;
      setEmojiIndex(index);
      conjure();
    }, EMOJI_SWAP_MS);

    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: -8, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());

    return () => {
      clearInterval(timer);
      loops.forEach((loop) => loop.stop());
    };
  }, [pop, dots]);

  const spin = pop.interpolate({ inputRange: [0, 1], outputRange: ["-30deg", "0deg"] });

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
      <Animated.Text
        style={{ fontSize: 72, transform: [{ scale: pop }, { rotate: spin }] }}
      >
        {BUILD_EMOJIS[emojiIndex]}
      </Animated.Text>
      <Title>{t("newGame.building")}</Title>
      <Muted style={{ textAlign: "center" }}>{t("newGame.buildingHint")}</Muted>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {dots.map((dot, i) => (
          <Animated.Text key={i} style={{ fontSize: 22, transform: [{ translateY: dot }] }}>
            🎲
          </Animated.Text>
        ))}
      </View>
    </View>
  );
}

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
    return <BuildingScreen />;
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
