export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Welcome to Health Journey</h1>
      <p className="text-gray-700">This onboarding page is public and does not require login.</p>
      <ol className="list-decimal ml-6 space-y-2">
        <li>Learn how to track your health metrics.</li>
        <li>Understand how to connect with your doctor.</li>
        <li>Get started by creating an account or logging in.</li>
      </ol>
    </div>
  )
}


