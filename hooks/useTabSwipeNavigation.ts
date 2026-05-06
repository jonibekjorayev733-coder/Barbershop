import { useMemo } from "react";
import { PanResponder } from "react-native";
import { useRouter } from "expo-router";

type UserTabKey = "home" | "mybookings" | "profile";

const TAB_ORDER: UserTabKey[] = ["home", "mybookings", "profile"];
const TAB_ROUTES: Record<UserTabKey, "/user/home" | "/user/mybookings" | "/user/profile"> = {
  home: "/user/home",
  mybookings: "/user/mybookings",
  profile: "/user/profile",
};

export function useTabSwipeNavigation(currentTab: UserTabKey) {
  const router = useRouter();

  return useMemo(() => {
    const currentIndex = TAB_ORDER.indexOf(currentTab);

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 22 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 72 || Math.abs(gestureState.vx) < 0.08) {
          return;
        }

        const nextTab = gestureState.dx < 0 ? TAB_ORDER[currentIndex + 1] : TAB_ORDER[currentIndex - 1];
        if (!nextTab) {
          return;
        }

        router.replace(TAB_ROUTES[nextTab]);
      },
    });
  }, [currentTab, router]);
}