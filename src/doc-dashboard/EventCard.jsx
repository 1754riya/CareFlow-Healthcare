import { format } from 'date-fns';
import { useState } from 'react';

export function BookingCard({ booking, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleMenuClick = async (action) => {
    if (action === 'delete') {
      setIsDeleting(true);
    }
    await onEdit(booking, action);
    setMenuOpen(false);
    setIsDeleting(false);
  };

  // Convert timestamp to Date if needed
  const startTime = new Date(booking.startTime);

  return (
    <div className="p-4 border rounded-lg mb-4 hover:shadow-md transition-shadow flex items-center">
      <div className="w-1/4 text-center">
        <div className="text-gray-600">
          {format(startTime, 'EEE')}
        </div>
        <div className="text-4xl font-bold">
          {format(startTime, 'dd')}
        </div>
      </div>
      
      <div className="w-2/4 px-4">
        <div className="flex items-center gap-2">
          <h3 className="font-medium mb-1">{booking.patientName}</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <span>{booking.timeSlot}</span>
          <span className={`px-2 py-1 rounded text-sm ${
            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {booking.status}
          </span>
        </div>
      </div>
      
      <div className="w-1/4 text-right relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          disabled={isDeleting}
        >
          {isDeleting ? 'Cancelling...' : 'Open'}
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
            <button
              onClick={() => handleMenuClick('view')}
              className="block px-4 py-2 text-left w-full hover:bg-blue-100"
            >
              View Patient
            </button>
            <button
              onClick={() => handleMenuClick('delete')}
              className="block px-4 py-2 text-left w-full text-red-600 hover:bg-red-100"
              disabled={isDeleting}
            >
              {isDeleting ? 'Cancelling...' : 'Cancel Appointment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}