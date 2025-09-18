import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent leading-tight">
              Your Health, Our Journey Together
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Manage health records, schedule appointments, and connect with healthcare providers. Start your journey to better health today with our innovative voice-powered intake system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/onboarding" 
                className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg text-center"
              >
                Get Started
              </Link>
              <Link 
                href="/register/patient" 
                className="px-8 py-4 rounded-full border-2 border-purple-300 text-purple-700 font-semibold text-lg hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 text-center"
              >
                Patient Register
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden border-2 border-purple-200 shadow-2xl bg-white p-4">
              <Image
                src="/window.svg"
                alt="Health hero"
                width={1200}
                height={800}
                className="w-full h-auto rounded-2xl"
                priority
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-indigo-400 to-blue-500 rounded-full opacity-20 blur-xl"></div>
          </div>
        </div>
      </section>
    </div>
  );
}
