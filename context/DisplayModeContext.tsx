import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeColorScheme } from "react-native";

export type DisplayMode = "system" | "light" | "dark";

interface DisplayModeContextValue {
  mode: DisplayMode;
  setMode: (value: DisplayMode) => Promise<void>;
  brightnessShift: number;
  setBrightnessShift: (value: number) => Promise<void>;
  effectiveScheme: "light" | "dark";
}

const STORAGE_MODE_KEY = "sharpcuts_display_mode";
const STORAGE_BRIGHTNESS_KEY = "sharpcuts_display_brightness";

const DisplayModeContext = createContext<DisplayModeContextValue>({
  mode: "system",
  setMode: async () => {},
  brightnessShift: 0,
  setBrightnessShift: async () => {},
  effectiveScheme: "light",
});

function normalizeBrightness(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-0.45, Math.min(0.45, value));
}

export function DisplayModeProvider({ children }: { children: React.ReactNode }) {
  const nativeScheme = useNativeColorScheme();
  const [mode, setModeState] = useState<DisplayMode>("system");
  const [brightnessShift, setBrightnessShiftState] = useState(0);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [storedMode, storedBrightness] = await Promise.all([
          AsyncStorage.getItem(STORAGE_MODE_KEY),
          AsyncStorage.getItem(STORAGE_BRIGHTNESS_KEY),
        ]);
        if (!mounted) return;

        if (storedMode === "system" || storedMode === "light" || storedMode === "dark") {
          setModeState(storedMode);
        }
        if (storedBrightness != null) {
          const parsed = Number(storedBrightness);
          setBrightnessShiftState(normalizeBrightness(parsed));
        }
      } catch {
        return;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (value: DisplayMode) => {
    setModeState(value);
    await AsyncStorage.setItem(STORAGE_MODE_KEY, value);
  }, []);

  const setBrightnessShift = useCallback(async (value: number) => {
    const normalized = normalizeBrightness(value);
    setBrightnessShiftState(normalized);
    await AsyncStorage.setItem(STORAGE_BRIGHTNESS_KEY, String(normalized));
  }, []);

  const effectiveScheme: "light" | "dark" = useMemo(() => {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return nativeScheme === "dark" ? "dark" : "light";
  }, [mode, nativeScheme]);

  const value = useMemo(
    () => ({ mode, setMode, brightnessShift, setBrightnessShift, effectiveScheme }),
    [mode, setMode, brightnessShift, setBrightnessShift, effectiveScheme],
  );

  return <DisplayModeContext.Provider value={value}>{children}</DisplayModeContext.Provider>;
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
