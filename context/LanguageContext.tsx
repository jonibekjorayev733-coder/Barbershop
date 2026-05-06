import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANGUAGE_STORAGE_KEY, type LanguageCode } from "@/lib/userPreferences";

type Dictionary = Record<string, Record<LanguageCode, string>>;

const STRINGS: Dictionary = {
  welcome: { uz: "Xush kelibsiz", ru: "Добро пожаловать", en: "Welcome" },
  chooseService: { uz: "xizmatni tanlang", ru: "выберите услугу", en: "choose a service" },
  nearbyBarbers: { uz: "Yaqin atrofdagi sartaroshlar", ru: "Ближайшие барберы", en: "Nearby barbers" },
  cheapBarbers: { uz: "Arzon sartaroshlar", ru: "Бюджетные барберы", en: "Budget barbers" },
  noBarberFound: { uz: "Sartarosh topilmadi", ru: "Барбер не найден", en: "No barber found" },
  internetProblem: { uz: "Internet muammosi: tarmoqni tekshirib qayta urinib ko'ring.", ru: "Проблема с интернетом: проверьте сеть и повторите.", en: "Internet issue: check your connection and try again." },
  searchSpecialist: { uz: "Mutaxassis yoki xizmat qidiring", ru: "Поиск барбера или услуги", en: "Search specialist or service" },
  experts: { uz: "mutaxassis", ru: "мастеров", en: "experts" },
  yearsShort: { uz: "yil", ru: "лет", en: "yrs" },
  locating: { uz: "Lokatsiya aniqlanmoqda...", ru: "Определяем локацию...", en: "Detecting location..." },
  chooseSpecialist: { uz: "Mutaxassis tanlang", ru: "Выберите специалиста", en: "Choose specialist" },
  nearbyListTitle: { uz: "Yaqin sartaroshlar", ru: "Барберы рядом", en: "Nearby barbers" },
  retry: { uz: "Qayta urinish", ru: "Повторить", en: "Try again" },
  locationPermissionRequired: { uz: "Lokatsiya ruxsati kerak: yaqin sartaroshlarni ko'rish uchun GPS ni yoqing.", ru: "Нужно разрешение на геолокацию: включите GPS для ближайших барберов.", en: "Location permission required: enable GPS to see nearby barbers." },
  locationLoadError: { uz: "Lokatsiyani olishda xatolik bo'ldi. Internet/GPS ni tekshirib qayta urinib ko'ring.", ru: "Не удалось определить геолокацию. Проверьте интернет/GPS и попробуйте снова.", en: "Failed to get location. Check internet/GPS and try again." },
  featuredMaster: { uz: "Top usta", ru: "Топ-мастер", en: "Featured master" },
  bookNow: { uz: "Hozir bron", ru: "Записаться", en: "Book now" },
  customer: { uz: "Mijoz", ru: "Клиент", en: "Customer" },
  online: { uz: "online", ru: "онлайн", en: "online" },
  premiumClub: { uz: "Premium klub", ru: "Премиум клуб", en: "Premium club" },
  fastBooking: { uz: "Tez bron", ru: "Быстрая запись", en: "Fast booking" },
  premiumPromoTitle: { uz: "VIP ko‘rinish, tez ishlash, kuchli boshqaruv", ru: "VIP-вид, быстрая работа, мощное управление", en: "VIP look, fast flow, powerful control" },
  premiumPromoSub: { uz: "Bir bosishda bron, profil, xabarlar va yordam.", ru: "Запись, профиль, сообщения и помощь в один клик.", en: "Booking, profile, messages and support in one tap." },
  quickActions: { uz: "Tez tugmalar", ru: "Быстрые действия", en: "Quick actions" },
  newBooking: { uz: "Yangi bron", ru: "Новая запись", en: "New booking" },
  myBookings: { uz: "Bronlarim", ru: "Мои записи", en: "My bookings" },
  profile: { uz: "Profil", ru: "Профиль", en: "Profile" },
  messages: { uz: "Xabarlar", ru: "Сообщения", en: "Messages" },
  support: { uz: "Yordam", ru: "Поддержка", en: "Support" },
  language: { uz: "Til", ru: "Язык", en: "Language" },
  topServices: { uz: "Top xizmatlar", ru: "Топ услуги", en: "Top services" },
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (key: keyof typeof STRINGS) => string;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "uz",
  setLanguage: async () => {},
  t: (key) => STRINGS[key].uz,
  isReady: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("uz");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored === "uz" || stored === "ru" || stored === "en") {
          setLanguageState(stored);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLanguageState(code);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  }, []);

  const t = useCallback((key: keyof typeof STRINGS) => STRINGS[key][language] ?? STRINGS[key].uz, [language]);

  const value = useMemo(() => ({ language, setLanguage, t, isReady }), [language, setLanguage, t, isReady]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
