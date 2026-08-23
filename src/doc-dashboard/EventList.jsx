import { BookingCard } from './EventCard';

export function BookingList({ bookings, onEdit }) {
  return (
    <div>
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}