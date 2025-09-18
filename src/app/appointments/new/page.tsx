"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Doctor, TimeSlot, Reservation } from '@/types/reservation';

export default function NewAppointmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<Record<string, TimeSlot[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{doctorId: string, slotId: string} | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [booking, setBooking] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [status, router]);

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    setSelectedDate(dateString);
  }, []);

  // Fetch doctors
  useEffect(() => {
    async function fetchDoctors() {
      try {
        const response = await fetch('/api/doctors');
        const data = await response.json();
        setDoctors(data.doctors || []);
      } catch (error) {
        console.error('Error fetching doctors:', error);
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchDoctors();
    }
  }, [status]);

  // Fetch time slots for all doctors when date changes
  useEffect(() => {
    if (selectedDate && doctors.length > 0 && status === 'authenticated') {
      fetchTimeSlotsForAllDoctors();
    }
  }, [selectedDate, doctors, status]);

  const fetchTimeSlotsForAllDoctors = async () => {
    const slotsData: Record<string, TimeSlot[]> = {};
    
    for (const doctor of doctors) {
      try {
        const response = await fetch(`/api/doctors/${doctor.id}/slots?date=${selectedDate}`);
        const data = await response.json();
        slotsData[doctor.id] = data.slots || [];
      } catch (error) {
        console.error(`Error fetching slots for doctor ${doctor.id}:`, error);
        slotsData[doctor.id] = [];
      }
    }
    
    setTimeSlots(slotsData);
  };

  const handleSlotClick = (doctorId: string, slotId: string) => {
    setSelectedSlot({ doctorId, slotId });
    setShowConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    console.log('handleConfirmBooking called', { selectedSlot, userId: (session?.user as any)?.id, status });
    
    if (!selectedSlot) {
      console.log('No slot selected');
      alert('Please select a time slot first.');
      return;
    }

    if (!(session?.user as any)?.id) {
      console.log('User not authenticated, redirecting to login');
      alert('You need to be logged in to book an appointment. Redirecting to login...');
      router.push('/login');
      return;
    }

    setBooking(true);
    try {
      console.log('Making booking request...', {
        doctorId: selectedSlot.doctorId,
        timeSlotId: selectedSlot.slotId,
      });

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId: selectedSlot.doctorId,
          timeSlotId: selectedSlot.slotId,
        }),
      });

      console.log('Booking response:', response.status, response.statusText);

      if (response.ok) {
        const reservation = await response.json();
        console.log('Booking successful:', reservation);
        // Show success modal instead of redirecting
        setShowConfirmModal(false);
        setShowSuccessModal(true);
        // Reset selected slot
        setSelectedSlot(null);
      } else {
        const error = await response.json();
        console.error('Booking failed:', error);
        alert(`Booking failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert('Failed to book appointment. Please try again.');
    } finally {
      setBooking(false);
      setShowConfirmModal(false);
    }
  };

  const getTimeSlotsForDoctor = (doctorId: string): TimeSlot[] => {
    return timeSlots[doctorId] || [];
  };

  const isSlotAvailable = (slot: TimeSlot): boolean => {
    return slot.isAvailable;
  };

  const formatTime = (time: string): string => {
    return time;
  };

  const getTimeRange = (startTime: string, endTime: string): string => {
    return `${startTime} - ${endTime}`;
  };

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            You need to be logged in to book an appointment.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
            style={{ fontFamily: 'var(--font-noto-sans)' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>Loading doctors and available slots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>Schedule Your Pre-Care Intake</h1>
          <p className="text-lg text-gray-600 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>Select a doctor and a time slot that works for you.</p>
          
          {/* Date Picker */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <label htmlFor="date" className="text-sm font-medium text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>Select Date:</label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              style={{ fontFamily: 'var(--font-noto-sans)' }}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>Available slot</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>Occupied slot</span>
            </div>
          </div>
        </div>

        {/* Scheduling Grid */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>Time Slot</th>
                  {doctors.map((doctor) => (
                    <th key={doctor.id} className="text-center py-4 px-6">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=random&color=fff&size=200&format=png`}
                            alt={doctor.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-sm font-semibold text-gray-900 text-center" style={{ fontFamily: 'var(--font-noto-sans)' }}>{doctor.name}</div>
                        <div className="text-xs text-gray-500 text-center" style={{ fontFamily: 'var(--font-noto-sans)' }}>{doctor.specialization}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => {
                  const nextHour = parseInt(time.split(':')[0]) + 1;
                  const endTime = `${nextHour.toString().padStart(2, '0')}:00`;
                  
                  return (
                    <tr key={time} className="border-b border-gray-100">
                      <td className="py-4 px-6 font-medium text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        {getTimeRange(time, endTime)}
                      </td>
                      {doctors.map((doctor) => {
                        const slots = getTimeSlotsForDoctor(doctor.id);
                        const slot = slots.find(s => s.startTime === time);
                        
                        return (
                          <td key={`${doctor.id}-${time}`} className="py-4 px-6 text-center">
                            <div className="flex justify-center">
                              {slot ? (
                                isSlotAvailable(slot) ? (
                                  <button
                                    onClick={() => handleSlotClick(doctor.id, slot.id)}
                                    className="py-2 px-6 text-sm font-normal rounded-lg transition-colors duration-200 shadow-sm cursor-pointer w-full"
                                    style={{ 
                                      fontFamily: 'var(--font-noto-sans)',
                                      backgroundColor: '#EBFBF2',
                                      color: '#059669',
                                      minWidth: '80px'
                                    }}
                                  >
                                    Book
                                  </button>
                                ) : (
                                  <span className="px-4 py-2 bg-gray-300 text-gray-600 text-sm font-medium rounded-lg" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                                    Occupied
                                  </span>
                                )
                              ) : (
                                <span className="px-4 py-2 bg-gray-300 text-gray-600 text-sm font-medium rounded-lg" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && selectedSlot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>Confirm Booking</h3>
              <p className="text-gray-600 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Are you sure you want to book this appointment?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                  disabled={booking}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={booking}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {booking ? 'Booking...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  Reserve Successfully!
                </h3>
                <p className="text-gray-600 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  Your appointment has been booked successfully. You can now complete your pre-care intake.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    Stay Here
                  </button>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      router.push('/intake');
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    Complete Intake
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}