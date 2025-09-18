export default function OnboardingPage() {
  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <div className="mx-auto max-w-4xl p-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Welcome to HealthFirst</h1>
          <p className="text-xl text-gray-700 mb-8">This onboarding page is public and does not require login.</p>
          <ol className="list-decimal ml-6 space-y-4 text-lg text-gray-700">
            <li>Learn how to track your health metrics with our innovative voice-powered intake system.</li>
            <li>Understand how to connect with your doctor through our streamlined platform.</li>
            <li>Get started by creating an account or logging in to access personalized health services.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}


