"use client";

import { useEffect } from "react";
import { buttonSecondary } from "@/lib/styles";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
      <h2 className="font-semibold">No se ha podido cargar la página</h2>
      <p className="mt-1 text-sm">
        Comprueba que la base de datos está disponible (variable DATABASE_URL) y vuelve a intentarlo.
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonSecondary} mt-4`}>
        Reintentar
      </button>
    </div>
  );
}
