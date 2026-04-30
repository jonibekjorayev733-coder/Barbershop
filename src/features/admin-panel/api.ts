export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8000";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface AdminProfileApi {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface AdminProfileUpdatePayload {
  name: string;
  email: string;
  password?: string;
  avatar?: string | null;
}

export interface BarberProfileUpdatePayload {
  name: string;
  email: string;
  password?: string;
  photo_url?: string | null;
  specialty?: string;
  work_directions?: string;
  service_price?: number;
  discount_percent?: number;
}

export interface BarberProfileApi {
  id: number;
  name: string;
  email: string;
  photo_url?: string | null;
  specialty?: string;
  work_directions?: string;
  service_price?: number;
  discount_percent?: number;
}

export interface BarberNotificationApi {
  id: number;
  barber_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at?: string;
}

export interface BarberRatingPayload {
  score: number;
  user_name?: string;
  comment?: string;
}

export interface BarberRatingResponseApi {
  barber_id: number;
  rating: number;
  rating_votes: number;
}

export interface UserProfileUpdatePayload {
  name: string;
  email: string;
  password?: string;
  avatar?: string | null;
}

export interface UserProfileApi {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface BarberAppointmentApi {
  id: number;
  barber_id: number;
  client_name: string;
  client_phone: string;
  appointment_time: string;
  appointment_date: string;
  status: "pending" | "completed" | "cancelled";
  service_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BarberDashboardApi {
  barber_id: number;
  barber_name: string;
  today_total: number;
  today_done: number;
  today_pending: number;
  progress_ratio: number;
  next_appointment?: BarberAppointmentApi | null;
  today_appointments: BarberAppointmentApi[];
}

export interface UserBookingBarberApi {
  id: number;
  name: string;
  specialty: string;
  work_directions?: string | null;
  rating: number;
  years_experience: number;
  photo_url?: string | null;
  bio?: string | null;
  phone?: string | null;
  total_cuts?: number;
  status?: string;
  color?: string | null;
  service_price?: number;
  discount_percent?: number;
}

export interface PublicBarberPreviewApi {
  id: number;
  name: string;
  specialty: string;
  photo_url?: string | null;
  years_experience?: number;
  rating?: number;
}

export interface PublicBarbershopMapItemApi {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photo_url?: string | null;
  description?: string | null;
  distance_km?: number | null;
  barber_count: number;
  barbers: PublicBarberPreviewApi[];
}

export type PublicBarbershopDetailApi = PublicBarbershopMapItemApi;

export interface PublicUserLocationApi {
  lat: number;
  lng: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
  source: string;
  is_exact: boolean;
}

export interface BarbershopCreateUpdatePayload {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photo_url?: string;
  description?: string;
}

export interface BarberAvailabilitySlotApi {
  time: string;
  status: "available" | "booked";
}

export interface BarberAvailabilityApi {
  barber_id: number;
  barber_name: string;
  date: string;
  slots: BarberAvailabilitySlotApi[];
}

export interface UserBookingCreatePayload {
  barber_id: number;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_phone: string;
  service_name?: string;
  user_id?: number;
}

export interface UserBookingConfirmationApi {
  booking_id: string;
  appointment_id: number;
  barber_id: number;
  barber_name: string;
  barber_specialty: string;
  barber_photo_url?: string | null;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_phone: string;
  service_name?: string | null;
  service_price?: number | null;
  discount_percent?: number;
  created_at?: string;
  status: "pending" | "completed" | "cancelled";
}

export interface AdminBookingApi {
  id: string;
  client: string;
  phone: string;
  barber: string;
  service: string;
  price: number;
  time: string;
  date: string;
  status: "pending" | "completed" | "cancelled";
}

export type BarberApiStatus = "available" | "busy" | "off";

export interface BarberApi {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  rating: number;
  total_cuts: number;
  today_cuts: number;
  status: BarberApiStatus;
  color: string;
  gradient: string;
  created_at?: string;
  updated_at?: string;
  photo_url?: string;
  years_experience?: number;
  username?: string;
  password?: string;
  bio?: string;
  barbershop_id?: number | null;
}

export interface BarberApiPayload {
  name: string;
  specialty: string;
  phone: string;
  rating: number;
  total_cuts: number;
  today_cuts: number;
  status: BarberApiStatus;
  color: string;
  gradient: string;
  photo_url: string;
  years_experience: number;
  username: string;
  password: string;
  bio: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `So'rovda xatolik: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string; message?: string };
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
  } catch {
    const text = await response.text();
    if (text.trim()) {
      return text;
    }
  }

  return `So'rovda xatolik: ${response.status}`;
}

export async function getBarbers(): Promise<BarberApi[]> {
  return requestJson<BarberApi[]>("/barbers/");
}

export async function createBarber(payload: BarberApiPayload): Promise<BarberApi> {
  return requestJson<BarberApi>("/barbers/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBarber(barberId: number, payload: BarberApiPayload): Promise<BarberApi> {
  return requestJson<BarberApi>(`/barbers/${barberId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteBarber(barberId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/barbers/${barberId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `O'chirishda xatolik: ${response.status}`);
  }
}

export async function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerUser(payload: RegisterUserRequest): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyToken(accessToken: string): Promise<{ user_id: number; role: string; exp?: number }> {
  return requestJson<{ user_id: number; role: string; exp?: number }>("/auth/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function updateAdminProfile(adminId: number, payload: AdminProfileUpdatePayload): Promise<AdminProfileApi> {
  return requestJson<AdminProfileApi>(`/admins/${adminId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getAdminProfile(adminId: number): Promise<AdminProfileApi> {
  return requestJson<AdminProfileApi>(`/admins/${adminId}`);
}

export async function updateBarberProfile(barberId: number, payload: BarberProfileUpdatePayload): Promise<BarberProfileApi> {
  return requestJson<BarberProfileApi>(`/barbers/${barberId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getBarberProfile(barberId: number): Promise<BarberProfileApi> {
  return requestJson<BarberProfileApi>(`/barbers/${barberId}/profile`);
}

export async function getBarberNotifications(barberId: number): Promise<BarberNotificationApi[]> {
  return requestJson<BarberNotificationApi[]>(`/barbers/${barberId}/notifications`);
}

export async function markBarberNotificationRead(barberId: number, notificationId: number): Promise<BarberNotificationApi> {
  return requestJson<BarberNotificationApi>(`/barbers/${barberId}/notifications/${notificationId}/read`, {
    method: "PUT",
  });
}

export async function submitBarberRating(barberId: number, payload: BarberRatingPayload): Promise<BarberRatingResponseApi> {
  return requestJson<BarberRatingResponseApi>(`/barbers/${barberId}/ratings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStudentProfile(userId: number, payload: UserProfileUpdatePayload): Promise<UserProfileApi> {
  return requestJson<UserProfileApi>(`/students/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getStudentProfile(userId: number): Promise<UserProfileApi> {
  return requestJson<UserProfileApi>(`/students/${userId}/profile`);
}

export async function getBarberDashboard(barberId: number): Promise<BarberDashboardApi> {
  return requestJson<BarberDashboardApi>(`/barbers/${barberId}/dashboard`);
}

export async function getBarberAppointments(
  barberId: number,
  options?: { status?: "all" | "pending" | "completed"; date?: string },
): Promise<BarberAppointmentApi[]> {
  const query = new URLSearchParams();
  if (options?.status) {
    query.set("status_filter", options.status);
  }
  if (options?.date) {
    query.set("date", options.date);
  }

  const qs = query.toString();
  return requestJson<BarberAppointmentApi[]>(`/barbers/${barberId}/appointments${qs ? `?${qs}` : ""}`);
}

export async function completeBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return requestJson<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/complete`, {
    method: "PATCH",
  });
}

export async function approveBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return requestJson<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/approve`, {
    method: "PATCH",
  });
}

export async function rejectBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return requestJson<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/reject`, {
    method: "PATCH",
  });
}

export async function sendBarberAppointmentSms(
  barberId: number,
  appointmentId: number,
  message?: string,
): Promise<{ success: boolean; appointment_id: number; message: string }> {
  const params = new URLSearchParams();
  if (message?.trim()) {
    params.set("message", message.trim());
  }
  const query = params.toString();

  return requestJson<{ success: boolean; appointment_id: number; message: string }>(
    `/barbers/${barberId}/appointments/${appointmentId}/send-sms${query ? `?${query}` : ""}`,
    {
      method: "POST",
    },
  );
}

export async function getUserBookingBarbers(): Promise<UserBookingBarberApi[]> {
  return requestJson<UserBookingBarberApi[]>("/user/barbers");
}

export async function getBarberAvailability(barberId: number, date: string): Promise<BarberAvailabilityApi> {
  const params = new URLSearchParams({ date });
  return requestJson<BarberAvailabilityApi>(`/user/barbers/${barberId}/availability?${params.toString()}`);
}

export async function createUserBooking(payload: UserBookingCreatePayload): Promise<UserBookingConfirmationApi> {
  return requestJson<UserBookingConfirmationApi>("/user/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBookings(options?: { date?: string; status?: "all" | "pending" | "completed" | "cancelled" }): Promise<AdminBookingApi[]> {
  const params = new URLSearchParams();
  if (options?.date) {
    params.set("date", options.date);
  }
  if (options?.status) {
    params.set("status_filter", options.status);
  }
  const query = params.toString();
  return requestJson<AdminBookingApi[]>(`/bookings/${query ? `?${query}` : ""}`);
}

export async function getPublicBarbershops(options?: {
  lat?: number;
  lng?: number;
  scope?: "near" | "far";
}): Promise<PublicBarbershopMapItemApi[]> {
  const params = new URLSearchParams();
  if (typeof options?.lat === "number") {
    params.set("lat", String(options.lat));
  }
  if (typeof options?.lng === "number") {
    params.set("lng", String(options.lng));
  }
  if (options?.scope) {
    params.set("scope", options.scope);
  }

  const query = params.toString();
  return requestJson<PublicBarbershopMapItemApi[]>(`/public/barbershops${query ? `?${query}` : ""}`);
}

export async function getPublicBarbershopDetail(
  shopId: number,
  options?: { lat?: number; lng?: number },
): Promise<PublicBarbershopDetailApi> {
  const params = new URLSearchParams();
  if (typeof options?.lat === "number") {
    params.set("lat", String(options.lat));
  }
  if (typeof options?.lng === "number") {
    params.set("lng", String(options.lng));
  }
  const query = params.toString();
  return requestJson<PublicBarbershopDetailApi>(`/public/barbershops/${shopId}${query ? `?${query}` : ""}`);
}

export async function createBarbershop(payload: BarbershopCreateUpdatePayload): Promise<PublicBarbershopMapItemApi> {
  return requestJson<PublicBarbershopMapItemApi>("/barbershops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBarbershop(
  shopId: number,
  payload: BarbershopCreateUpdatePayload,
): Promise<PublicBarbershopMapItemApi> {
  return requestJson<PublicBarbershopMapItemApi>(`/barbershops/${shopId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function assignBarberToBarbershop(shopId: number, barberId: number): Promise<PublicBarbershopDetailApi> {
  return requestJson<PublicBarbershopDetailApi>(`/barbershops/${shopId}/assign-barber`, {
    method: "POST",
    body: JSON.stringify({ barber_id: barberId }),
  });
}

export async function getPublicUserLocationByIp(): Promise<PublicUserLocationApi> {
  return requestJson<PublicUserLocationApi>("/public/location-by-ip");
}
