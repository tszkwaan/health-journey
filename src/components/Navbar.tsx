"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user?.email;
  const role = (session?.user as any)?.role as "PATIENT" | "DOCTOR" | undefined;

  return (
    <nav className="w-full border-b border-purple-200 sticky top-0 z-50 shadow-sm" style={{ backgroundColor: '#E6DFFF' }}>
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg">
            ◆
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            HealthFirst
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <Link href="/intake" className="hover:text-purple-600 transition-colors duration-200">Intake</Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isAuthed && (
            <>
              <Link href="/login" className="px-5 py-2.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold hover:bg-purple-200 transition-all duration-200 shadow-sm">
                Login
              </Link>
              <Link href="/register/patient" className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg">
                Patient Register
              </Link>
            </>
          )}
          {isAuthed && (
            <>
              {role === "PATIENT" && (
                <Link href="/appointments/new" className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg">
                  Make Appointment
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-5 py-2.5 rounded-full border-2 border-purple-200 text-purple-700 text-sm font-semibold hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
