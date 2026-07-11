import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  avatarColors,
  defaultSprite,
  isSpriteHat,
  isValidAllocation,
  randomSprite,
  SPRITE_ACCESSORIES,
  SPRITE_CLOTHING,
  SPRITE_EYES,
  SPRITE_FABRIC_COLORS,
  SPRITE_FACIAL_HAIR,
  SPRITE_HAIR,
  SPRITE_HAIR_COLORS,
  SPRITE_HATS,
  SPRITE_MOUTHS,
  SPRITE_SKIN_COLORS,
  STAT_POOL,
  STATS,
  statMeta,
  type AvatarSprite,
  type CharacterConcept,
  type Stats,
} from "@familyquest/shared";
import { AvatarBadge, Body, Card, Chip, Muted, PrimaryButton, Title } from "../ui/components";
import { SpriteImage } from "../ui/sprite";
import { useTheme } from "../ui/theme";
import { useHostStore } from "../state/hostStore";

type LookTab = "skin" | "hair" | "outfit" | "face" | "extras";
const LOOK_TABS: { id: LookTab; emoji: string }[] = [
  { id: "skin", emoji: "🖐️" },
  { id: "hair", emoji: "💇" },
  { id: "outfit", emoji: "👕" },
  { id: "face", emoji: "😊" },
  { id: "extras", emoji: "🕶️" },
];

export function HostCharacterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useHostStore();
  const concepts = store.gameState?.setup.concepts ?? [];

  const [concept, setConcept] = useState<CharacterConcept | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("coral");
  const [sprite, setSprite] = useState<AvatarSprite>(() => defaultSprite());
  const [tab, setTab] = useState<LookTab>("skin");
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
  }

  function bump(stat: (typeof STATS)[number], delta: 1 | -1) {
    const next = { ...stats, [stat]: stats[stat] + delta };
    if (next[stat] < 0 || next[stat] > 4) return;
    if (STATS.reduce((sum, s) => sum + next[s], 0) > STAT_POOL) return;
    setStats(next);
  }

  function set(patch: Partial<AvatarSprite>) {
    setSprite((s) => ({ ...s, ...patch }));
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

        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={{ position: "relative" }}>
            <AvatarBadge avatar={{ emoji: concept?.emoji ?? "🙂", color, sprite }} size={110} />
            <Pressable
              onPress={() => setSprite(randomSprite())}
              style={{
                position: "absolute",
                right: -10,
                bottom: -4,
                width: 42,
                height: 42,
                borderRadius: 21,
                borderWidth: 2,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceRaised,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>🎲</Text>
            </Pressable>
          </View>
          <SwatchRow
            colors={Object.values(avatarColors)}
            tokens={Object.keys(avatarColors)}
            value={color}
            onPick={setColor}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {LOOK_TABS.map((lt) => (
            <Chip
              key={lt.id}
              label={`${lt.emoji} ${t(`character.tab_${lt.id}`)}`}
              selected={tab === lt.id}
              onPress={() => setTab(lt.id)}
            />
          ))}
        </ScrollView>

        {tab === "skin" && (
          <SwatchRow
            colors={SPRITE_SKIN_COLORS.map((c) => `#${c}`)}
            tokens={[...SPRITE_SKIN_COLORS]}
            value={sprite.skinColor}
            onPick={(hex) => set({ skinColor: hex })}
          />
        )}

        {tab === "hair" && (
          <View style={{ gap: 10 }}>
            <TileRow
              options={["", ...SPRITE_HAIR, ...SPRITE_HATS]}
              selected={sprite.top}
              render={(top) => <SpriteImage sprite={{ ...sprite, top }} size={116} />}
              noneEmoji="🥚"
              onPick={(top) => set({ top })}
              zoomFace
            />
            {sprite.top !== "" ? (
              <SwatchRow
                colors={(isSpriteHat(sprite.top) ? SPRITE_FABRIC_COLORS : SPRITE_HAIR_COLORS).map(
                  (c) => `#${c}`,
                )}
                tokens={[...(isSpriteHat(sprite.top) ? SPRITE_FABRIC_COLORS : SPRITE_HAIR_COLORS)]}
                value={isSpriteHat(sprite.top) ? sprite.hatColor : sprite.hairColor}
                onPick={(hex) =>
                  set(isSpriteHat(sprite.top) ? { hatColor: hex } : { hairColor: hex })
                }
              />
            ) : null}
          </View>
        )}

        {tab === "outfit" && (
          <View style={{ gap: 10 }}>
            <TileRow
              options={[...SPRITE_CLOTHING]}
              selected={sprite.clothing}
              render={(clothing) => <SpriteImage sprite={{ ...sprite, clothing }} size={58} />}
              onPick={(clothing) => set({ clothing })}
            />
            <SwatchRow
              colors={SPRITE_FABRIC_COLORS.map((c) => `#${c}`)}
              tokens={[...SPRITE_FABRIC_COLORS]}
              value={sprite.clothesColor}
              onPick={(hex) => set({ clothesColor: hex })}
            />
          </View>
        )}

        {tab === "face" && (
          <View style={{ gap: 10 }}>
            <Muted>{t("character.eyes")}</Muted>
            <TileRow
              options={[...SPRITE_EYES]}
              selected={sprite.eyes}
              render={(eyes) => <SpriteImage sprite={{ ...sprite, eyes }} size={116} />}
              onPick={(eyes) => set({ eyes })}
              zoomFace
            />
            <Muted>{t("character.mouth")}</Muted>
            <TileRow
              options={[...SPRITE_MOUTHS]}
              selected={sprite.mouth}
              render={(mouth) => <SpriteImage sprite={{ ...sprite, mouth }} size={116} />}
              onPick={(mouth) => set({ mouth })}
              zoomFace
            />
          </View>
        )}

        {tab === "extras" && (
          <View style={{ gap: 10 }}>
            <Muted>{t("character.glasses")}</Muted>
            <TileRow
              options={["", ...SPRITE_ACCESSORIES]}
              selected={sprite.accessory}
              render={(accessory) => <SpriteImage sprite={{ ...sprite, accessory }} size={116} />}
              noneEmoji="✖️"
              onPick={(accessory) => set({ accessory })}
              zoomFace
            />
            <Muted>{t("character.beard")}</Muted>
            <TileRow
              options={["", ...SPRITE_FACIAL_HAIR]}
              selected={sprite.facialHair}
              render={(facialHair) => <SpriteImage sprite={{ ...sprite, facialHair }} size={116} />}
              noneEmoji="✖️"
              onPick={(facialHair) => set({ facialHair })}
              zoomFace
            />
          </View>
        )}
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
            avatar: { emoji: concept?.emoji ?? "🙂", color, sprite },
            stats,
          })
        }
      />
      <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => store.go("lobby")} />
    </ScrollView>
  );
}

function TileRow({
  options,
  selected,
  render,
  onPick,
  noneEmoji,
  zoomFace,
}: {
  options: string[];
  selected: string;
  render: (value: string) => React.ReactNode;
  onPick: (value: string) => void;
  noneEmoji?: string;
  zoomFace?: boolean;
}) {
  const theme = useTheme();
  const TILE = 58;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((value) => (
        <Pressable
          key={value || "none"}
          onPress={() => onPick(value)}
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: selected === value ? theme.colors.primary : theme.colors.border,
            backgroundColor: theme.colors.surfaceRaised,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {value === "" ? (
            <Text style={{ fontSize: 22 }}>{noneEmoji ?? "✖️"}</Text>
          ) : zoomFace ? (
            /* 2x sprite shifted so the head fills the tile */
            <View style={{ marginTop: TILE * 0.62 }}>{render(value)}</View>
          ) : (
            render(value)
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SwatchRow({
  colors,
  tokens,
  value,
  onPick,
}: {
  colors: string[];
  tokens: string[];
  value: string;
  onPick: (token: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
      {tokens.map((token, i) => (
        <Pressable
          key={token}
          onPress={() => onPick(token)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: colors[i],
            borderWidth: 3,
            borderColor: value === token ? theme.colors.text : "transparent",
          }}
        />
      ))}
    </View>
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
