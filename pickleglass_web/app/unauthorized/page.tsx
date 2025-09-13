import Link from "next/link";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2">Insufficient permissions</h1>
        <p className="text-gray-600 mb-6">
          You do not have access to this page. If you believe this is an error, please contact support or try again.
        </p>
        <div className="space-x-3">
          <Link href="/login" className="inline-block rounded bg-blue-600 px-4 py-2 text-white">
            Go to login
          </Link>
          <Link href="/" className="inline-block rounded border px-4 py-2 text-gray-700">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
