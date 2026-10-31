"use client";

import { useState, useTransition } from "react";
import { cancelVisit } from "./actions";

export function CancelVisitButton({ visitId, description }: { visitId: number; description: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(`¿Cancelar la visita ${description}? El horario del técnico quedará libre.`)) {
      return;
    }
    startTransition(async () => {
      const result = await cancelVisit(visitId);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
