"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user?.email;
  const role = (session?.user as any)?.role as "PATIENT" | "DOCTOR" | undefined;

  return (
    <nav className="w-full border-b border-violet-200 bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-white text-xs font-semibold">◆</span>
          <span className="font-semibold">HealthJourney</span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-700">
          <Link href="#" className="hover:text-black">About</Link>
          <Link href="#" className="hover:text-black">Services</Link>
          <Link href="#" className="hover:text-black">Contact</Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isAuthed && (
            <>
              <Link href="/login" className="px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition">Login</Link>
              <Link href="/register/patient" className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Patient Register</Link>
            </>
          )}
          {isAuthed && (
            <>
              {role === "PATIENT" && (
                <Link href="/appointments/new" className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">
                  Make Appointment
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium hover:bg-gray-50 transition"
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
