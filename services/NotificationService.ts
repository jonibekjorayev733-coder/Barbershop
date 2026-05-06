/**
 * Barber – Push Notification Service
 * Telegram singari ovozli ichki bildirishnomalar
 */
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

type NotificationsModule = any;

let notificationsModule: NotificationsModule | null = null;
let notificationHandlerConfigured = false;

function isExpoGoClient(): boolean {
  const ownership = (Constants as { appOwnership?: string | null }).appOwnership;
  const executionEnvironment = (Constants as { executionEnvironment?: string | null }).executionEnvironment;

  return ownership === "expo" || executionEnvironment === "storeClient";
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") return null;
  if (isExpoGoClient()) return null;
  if (notificationsModule) return notificationsModule;

  try {
    const ExpoNotifications = (await import("expo-notifications")) as NotificationsModule;
    notificationsModule = ExpoNotifications;

    if (!notificationHandlerConfigured) {
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: notificationsModule!.AndroidNotificationPriority.HIGH,
        }),
      });
      notificationHandlerConfigured = true;
    }

    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
}

const PUSH_TOKEN_KEY = "sharpcuts_push_token";

// --- Android notification channels ---
export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync("sms", {
    name: "Barber SMS",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "sms.wav",
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync("booking", {
    name: "Bron bildirishnomalari",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    sound: "sms.wav",
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// --- Permission so'rash ---
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

// Push token (faqat development build uchun - Expo Go'da ishlamaydi)
export async function getSavedPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function registerNotificationListeners() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => undefined;
  }

  const notificationListener = Notifications.addNotificationReceivedListener(() => {});
  const responseListener = Notifications.addNotificationResponseReceivedListener(() => {});

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}

// --- OTP SMS kodi keldi (ovozli) ---
export async function notifyOtpCode() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Barber verification",
      body: "SMS kod yuborildi — ilovaga qaytib tasdiqlang",
      sound: "sms.wav",
      priority: "high",
      ...(Platform.OS === "android" && { channelId: "sms" }),
    },
    trigger: null, // darhol
  });
}

// --- Bron qabul qilindi ---
export async function notifyBookingAccepted(barberName: string, time: string, date: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "✅ Bron tasdiqlandi",
      body: `${barberName} sizni kutmoqda · ${date} · ${time}`,
      sound: "sms.wav",
      priority: "high",
      data: { type: "booking_accepted" },
      ...(Platform.OS === "android" && { channelId: "booking" }),
    },
    trigger: null,
  });
}

// --- Bron rad etildi ---
export async function notifyBookingRejected(barberName: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "❌ Bron holati o'zgardi",
      body: `${barberName} bronni rad etdi. Yangi vaqtni tanlab ko'ring.`,
      sound: "sms.wav",
      priority: "high",
      data: { type: "booking_rejected" },
      ...(Platform.OS === "android" && { channelId: "booking" }),
    },
    trigger: null,
  });
}

// --- Yangi bron keldi (sartarosh uchun) ---
export async function notifyNewBookingForBarber(clientName: string, time: string, date: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💈 Yangi bron!",
      body: `${clientName} sizga bron qildi\n📅 ${date} – ⏰ ${time}`,
      sound: "sms.wav",
      priority: "high",
      data: { type: "new_booking" },
      ...(Platform.OS === "android" && { channelId: "booking" }),
    },
    trigger: null,
  });
}

// --- Baholandi (sartarosh uchun) ---
export async function notifyRatingReceived(stars: number, clientName: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  const starStr = "⭐".repeat(stars);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${starStr} Baholandi!`,
      body: `${clientName} sizni ${stars} yulduz bilan baholadi`,
      sound: "sms.wav",
      priority: "high",
      data: { type: "rating_received", stars },
      ...(Platform.OS === "android" && { channelId: "booking" }),
    },
    trigger: null,
  });
}

// --- Umumiy SMS style notification ---
export async function showLocalNotification(title: string, body: string, type = "general") {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await playSmsSound();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "sms.wav",
      priority: "high",
      data: { type },
      ...(Platform.OS === "android" && { channelId: "booking" }),
    },
    trigger: null,
  });
}

// --- Ovozli sound ijro etish (fallback) ---
export async function playSmsSound() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
    });
    const player = createAudioPlayer(require("../assets/sounds/sms.wav"));
    player.play();
  } catch {
    // sound fail bo'lsa ignore
  }
}
