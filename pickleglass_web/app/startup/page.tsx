import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default function StartupPage({ searchParams }: { searchParams?: SearchParams }) {
  const sp = searchParams || {};
  const returnUrl = typeof sp.returnUrl === "string" ? sp.returnUrl : "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <div
          className="mx-auto mb-4 h-10 w-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold mb-2">Starting up…</h1>
        <p className="text-gray-600 mb-6">
          Authentication services are initializing. This can take a few seconds during a cold start.
        </p>
        <div className="space-x-3">
          <Link href={returnUrl} className="inline-block rounded bg-blue-600 px-4 py-2 text-white">
            Try again
          </Link>
          <Link href="/" className="inline-block rounded border px-4 py-2 text-gray-700">
            Go home
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          If this persists for more than 30 seconds, please try reloading the page.
        </p>
      </div>
    </main>
  );
}
