import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Your Health, Our Journey Together
            </h1>
            <p className="text-gray-600">
              Manage health records, schedule appointments, and connect with healthcare providers. Start your journey to better health today.
            </p>
            <div className="flex gap-3">
              <Link href="/onboarding" className="px-5 py-2.5 rounded bg-indigo-600 text-white">Get Started</Link>
              <Link href="/register/patient" className="px-5 py-2.5 rounded border">Patient Register</Link>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border shadow-sm">
            <Image
              src="/window.svg"
              alt="Health hero"
              width={1200}
              height={800}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </section>
    </div>
  );
}
