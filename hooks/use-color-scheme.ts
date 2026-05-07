import { useColorScheme as useNativeColorScheme } from "react-native";
import { useDisplayMode } from "@/context/DisplayModeContext";

export function useColorScheme() {
	const nativeScheme = useNativeColorScheme();
	const { effectiveScheme } = useDisplayMode();
	return effectiveScheme ?? nativeScheme ?? "light";
}
