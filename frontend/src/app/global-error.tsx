"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-gray-2 px-6 py-12 text-dark">
          <section className="w-full max-w-md rounded-xl border border-stroke bg-white p-6 text-center shadow-1">
            <h1 className="text-heading-5 font-bold">Algo saiu do esperado</h1>
            <p className="mt-3 text-sm text-dark-4">
              Nao foi possivel carregar esta area do sistema agora.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Tentar novamente
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
