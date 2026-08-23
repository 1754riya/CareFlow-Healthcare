export function filterBookings(bookings, filter) {
    const now = new Date();
    
    switch (filter) {
      case 'Upcoming':
        return bookings.filter(booking => new Date(booking.startTime) > now);
      case 'Past':
        return bookings.filter(booking => new Date(booking.endTime) < now);
      case 'Recurring':
        return bookings.filter(booking => booking.recurring);
      case 'Cancelled':
        return bookings.filter(booking => booking.status === 'cancelled');
      default:
        return bookings;
    }
  }