import type { BarberStatus, BookingStatus } from "./types";

export const bookingStatusLabel: Record<BookingStatus, string> = {
  completed: "yakunlangan",
  pending: "kutilmoqda",
  cancelled: "bekor qilingan",
  accepted: "jarayonda",
  rated: "baholangan",
};

export const barberStatusLabel: Record<BarberStatus, string> = {
  available: "bo'sh",
  busy: "band",
  off: "dam olishda",
};

export const bookingFilterLabels: Record<"all" | BookingStatus, string> = {
  all: "Barchasi",
  completed: "Yakunlangan",
  pending: "Kutilmoqda",
  cancelled: "Bekor qilingan",
  accepted: "Jarayonda",
  rated: "Baholangan",
};

export const topCopy = {
  dashboard: {
    eyebrow: "Bugungi holat",
    title: "Boshqaruv paneli",
    subtitle: "Dushanba, 27-aprel, 2026",
    cta: "Yangi bron qo'shish",
  },
  bookings: {
    eyebrow: "Bronlar bo'limi",
    title: "Bronlar",
    subtitle: "Bugungi va keyingi yozuvlar",
    dateTitle: "Bugun — Dushanba, 27-aprel",
    chips: {
      total: "jami",
      done: "yakunlangan",
      pending: "kutilmoqda",
    },
  },
  barbers: {
    eyebrow: "Jamoa",
    title: "Sartaroshlar",
    subtitle: "Ish jadvali va holatini boshqaring",
    cta: "Sartarosh qo'shish",
  },
};
