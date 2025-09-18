import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Your Health, Our Journey Together
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Manage health records, schedule appointments, and connect with healthcare providers. Start your journey to better health today with our innovative voice-powered intake system.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/onboarding" 
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg text-center"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Get Started
              </Link>
              <Link 
                href="/register/patient" 
                className="px-8 py-4 rounded-xl border-2 border-purple-300 text-purple-700 font-semibold text-lg hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 text-center"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Patient Register
              </Link>
            </div>
            
            <div className="mt-12">
              <div className="relative rounded-2xl overflow-hidden border border-purple-200 shadow-lg bg-white p-4">
                <Image
                  src="/window.svg"
                  alt="Health hero"
                  width={1200}
                  height={800}
                  className="w-full h-auto rounded-xl"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
