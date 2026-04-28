import { bookingStatusLabel } from "../copy";
import type { AdminBookingApi, BarberApi } from "../api";
import { formatUzs } from "../utils/currency";

interface BookingsTableProps {
  rows: AdminBookingApi[];
  barbers: BarberApi[];
}

export function BookingsTable({ rows, barbers }: BookingsTableProps) {
  return (
    <div className="tbl-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Mijoz</th>
            <th>Sartarosh</th>
            <th>Xizmat</th>
            <th>Sana va vaqt</th>
            <th>Narx</th>
            <th>Holat</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((booking) => (
            <tr key={booking.id}>
              <td>
                <div className="client-cell">
                  <div
                    className="c-av"
                    style={{
                      background:
                        barbers.find((barber) => barber.name === booking.barber)?.gradient ||
                        "linear-gradient(135deg,#6366f1,#818cf8)",
                    }}
                  >
                    {booking.client[0]}
                  </div>
                  <div>
                    <strong>{booking.client}</strong>
                    <small>{booking.phone}</small>
                  </div>
                </div>
              </td>
              <td>
                <span className="barber-tag">{booking.barber}</span>
              </td>
              <td>{booking.service}</td>
              <td>
                <strong>{booking.time}</strong>
                <small>{booking.date}</small>
              </td>
              <td>
                <strong className="price-tag">{formatUzs(booking.price)}</strong>
              </td>
              <td>
                <span className={`badge b-${booking.status}`}>{bookingStatusLabel[booking.status]}</span>
              </td>
              <td>
                <span className="bk-id">{booking.id}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
