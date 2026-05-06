export type Page = "dashboard" | "barbers" | "bookings";
export type BookingStatus = "completed" | "pending" | "cancelled" | "accepted" | "rated";
export type BarberStatus = "available" | "busy" | "off";

export interface Barber {
  id: string | number;
  name: string;
  specialty: string;
  phone: string;
  rating: number;
  totalCuts: number;
  todayCuts: number;
  status: BarberStatus;
  initials: string;
  color: string;
  gradient: string;
}

export interface Booking {
  id: string;
  client: string;
  phone: string;
  barber: string;
  service: string;
  price: number;
  time: string;
  date: string;
  status: BookingStatus;
}

export interface ChartPoint {
  day: string;
  completed: number;
  pending: number;
}
