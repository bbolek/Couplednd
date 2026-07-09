import { useEffect } from "react";
import { View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
} from "@expo-google-fonts/fredoka";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { darkColors, lightColors } from "@familyquest/shared";
import "./i18n";
import { useHostStore, type Screen } from "./state/hostStore";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { NewGameScreen } from "./screens/NewGameScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { HostCharacterScreen } from "./screens/HostCharacterScreen";
import { GameTableScreen } from "./screens/GameTableScreen";
import { RecapScreen } from "./screens/RecapScreen";

const SCREENS: Record<Screen, () => React.JSX.Element | null> = {
  home: HomeScreen,
  settings: SettingsScreen,
  newGame: NewGameScreen,
  lobby: LobbyScreen,
  hostCharacter: HostCharacterScreen,
  table: GameTableScreen,
  recap: RecapScreen,
};

export default function App() {
  const dark = useColorScheme() === "dark";
  const colors = dark ? darkColors : lightColors;
  const screen = useHostStore((s) => s.screen);
  const settingsLoaded = useHostStore((s) => s.settingsLoaded);
  const init = useHostStore((s) => s.init);

  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    void init();
  }, [init]);

  const Active = SCREENS[screen];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? "light" : "dark"} />
      {fontsLoaded && settingsLoaded ? <Active /> : null}
    </View>
  );
}
