/**
 * Sharp Cuts – Push Notification Service
 * Telegram singari ovozli ichki bildirishnomalar
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Foreground'da ham ovozli va bannerni ko'rsatish
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

const PUSH_TOKEN_KEY = "sharpcuts_push_token";

// --- Android notification channels ---
export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("sms", {
    name: "Sharp Cuts SMS",
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

// --- OTP SMS kodi keldi (ovozli) ---
export async function notifyOtpCode() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "✂️ Sharp Cuts",
      body: "Tasdiqlash kodi telefoningizga yuborildi",
      sound: "sms.wav",
      priority: "high",
      ...(Platform.OS === "android" && { channelId: "sms" }),
    },
    trigger: null, // darhol
  });
}

// --- Bron qabul qilindi ---
export async function notifyBookingAccepted(barberName: string, time: string, date: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "✅ Bron tasdiqlandi!",
      body: `${barberName} broningizni qabul qildi\n📅 ${date} – ⏰ ${time}`,
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
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "❌ Bron rad etildi",
      body: `${barberName} broningizni rad etdi. Boshqa vaqt tanlang.`,
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
