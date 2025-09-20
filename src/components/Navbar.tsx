"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user?.email;
  const role = (session?.user as any)?.role as "PATIENT" | "DOCTOR" | undefined;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className="w-full bg-white sticky top-0 z-50 shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between min-h-[80px]">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 cursor-pointer">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white text-lg font-bold">
            📍
          </div>
          <span className="text-2xl font-bold text-black" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            HealthFirst
          </span>
        </Link>

        {/* Center nav */}
        <div className="flex items-center gap-8 text-base font-medium text-black" style={{ fontFamily: 'var(--font-noto-sans)' }}>
          <Link href="/" className="hover:text-purple-600 transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">Home</Link>
          {role === 'PATIENT' && (
            <Link href="/patient/reservations" className="hover:text-purple-600 transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">My Reservations</Link>
          )}
          {role === 'DOCTOR' && (
            <Link href="/doctor/appointments" className="hover:text-purple-600 transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">My Appointments</Link>
          )}
          <Link href="/appointments/new" className="hover:text-purple-600 transition-colors duration-200 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">Book Appointment</Link>
        </div>

        {/* Right side - Notifications and User */}
        <div className="flex items-center gap-6">
          {/* Notifications */}
          <button className="p-3 hover:bg-gray-100 rounded-full transition-colors duration-200 cursor-pointer">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 1 0-15 0v5h5l-5 5-5-5h5V7a7.5 7.5 0 1 1 15 0v10z" />
            </svg>
          </button>

          {/* User Avatar */}
          {isAuthed ? (
            <div className="flex items-center gap-4">
              <div className="relative" ref={dropdownRef}>
                <div 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-semibold cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  {session?.user?.name?.charAt(0) || 'U'}
                </div>
                
                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {role === 'DOCTOR' && (
                      <Link
                        href="/doctor/appointments"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                        style={{ fontFamily: 'var(--font-noto-sans)' }}
                        onClick={() => setShowDropdown(false)}
                      >
                        My Appointments
                      </Link>
                    )}
                    {role === 'PATIENT' && (
                      <>
                        <Link
                          href="/patient/reservations"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                          style={{ fontFamily: 'var(--font-noto-sans)' }}
                          onClick={() => setShowDropdown(false)}
                        >
                          My Reservations
                        </Link>
                        <Link
                          href="/patient/medical-background"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                          style={{ fontFamily: 'var(--font-noto-sans)' }}
                          onClick={() => setShowDropdown(false)}
                        >
                          Medical History
                        </Link>
                      </>
                    )}
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                      onClick={() => setShowDropdown(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/login" className="px-6 py-2 text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-gray-50 rounded-lg transition-colors duration-200 cursor-pointer" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Login
              </Link>
              <Link href="/register/patient" className="px-6 py-2 bg-purple-600 text-white text-base font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
