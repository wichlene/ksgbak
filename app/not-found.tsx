import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-gray-700">404</p>
      <p className="text-gray-400">Ürün bulunamadı.</p>
      <Link href="/" className="text-accent hover:underline">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
