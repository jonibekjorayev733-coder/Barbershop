import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  getAppSupportConfig,
  updateAppSupportConfig,
  type AppSupportConfigApi,
} from "../api";

interface SupportSettingsPageProps {
  adminId: number;
}

const EMPTY_FORM: Omit<AppSupportConfigApi, "updated_at"> = {
  call_center_phone: "",
  telegram_username: "",
  telegram_url: "",
  email: "",
  work_hours: "",
  extra_hint: "",
};

export function SupportSettingsPage({ adminId }: SupportSettingsPageProps) {
  const [form, setForm] = useState<Omit<AppSupportConfigApi, "updated_at">>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const row = await getAppSupportConfig();
      setForm({
        call_center_phone: row.call_center_phone || "",
        telegram_username: row.telegram_username || "",
        telegram_url: row.telegram_url || "",
        email: row.email || "",
        work_hours: row.work_hours || "",
        extra_hint: row.extra_hint || "",
      });
      setSavedAt(row.updated_at ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Support sozlamalari yuklanmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lastUpdatedLabel = useMemo(() => {
    if (!savedAt) {
      return "Hali saqlanmagan";
    }
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) {
      return "Yangilangan";
    }
    return date.toLocaleString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [savedAt]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      const updated = await updateAppSupportConfig(adminId, {
        call_center_phone: form.call_center_phone.trim(),
        telegram_username: form.telegram_username.trim(),
        telegram_url: form.telegram_url.trim(),
        email: form.email.trim(),
        work_hours: form.work_hours.trim(),
        extra_hint: form.extra_hint.trim(),
      });
      setForm({
        call_center_phone: updated.call_center_phone,
        telegram_username: updated.telegram_username,
        telegram_url: updated.telegram_url,
        email: updated.email,
        work_hours: updated.work_hours,
        extra_hint: updated.extra_hint,
      });
      setSavedAt(updated.updated_at ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">Support boshqaruvi</div>
          <h2 className="ph-title">Aloqa va support sozlamalari</h2>
          <p className="ph-sub">Bu yerda saqlangan ma&apos;lumotlar mobile ilovadagi profil va support sahifasida real vaqtda ko&apos;rinadi.</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 22 }}>
        {loading ? <p>Yuklanmoqda...</p> : null}
        {error ? <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p> : null}

        {!loading ? (
          <form className="barber-form" onSubmit={onSubmit}>
            <label className="barber-field">
              <span>Call center raqami</span>
              <input
                value={form.call_center_phone}
                onChange={(event) => setForm((prev) => ({ ...prev, call_center_phone: event.target.value }))}
                placeholder="+998 90 777 77 77"
              />
            </label>

            <label className="barber-field">
              <span>Telegram username</span>
              <input
                value={form.telegram_username}
                onChange={(event) => setForm((prev) => ({ ...prev, telegram_username: event.target.value }))}
                placeholder="@sharpcuts_support"
              />
            </label>

            <label className="barber-field">
              <span>Telegram link</span>
              <input
                value={form.telegram_url}
                onChange={(event) => setForm((prev) => ({ ...prev, telegram_url: event.target.value }))}
                placeholder="https://t.me/sharpcuts_support"
              />
            </label>

            <label className="barber-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="support@sharpcuts.uz"
              />
            </label>

            <label className="barber-field">
              <span>Ish vaqti</span>
              <input
                value={form.work_hours}
                onChange={(event) => setForm((prev) => ({ ...prev, work_hours: event.target.value }))}
                placeholder="Dushanba - Yakshanba: 09:00 - 22:00"
              />
            </label>

            <label className="barber-field">
              <span>Qo&apos;shimcha izoh</span>
              <textarea
                value={form.extra_hint}
                onChange={(event) => setForm((prev) => ({ ...prev, extra_hint: event.target.value }))}
                rows={3}
                placeholder="Telegram va email orqali 24/7 xabar qoldirishingiz mumkin."
              />
            </label>

            <div className="barber-form-actions" style={{ alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Oxirgi yangilanish: {lastUpdatedLabel}</span>
              <button type="submit" className="ba-pri" disabled={saving}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}
