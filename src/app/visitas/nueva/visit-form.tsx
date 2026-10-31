"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, startTransition, useActionState, useState } from "react";
import { RULE_LABELS } from "@/domain/scheduling";
import { formatMinutes, parseTime } from "@/domain/time";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "@/lib/styles";
import { createVisit, type VisitField, type VisitFormValues } from "../actions";

interface Props {
  technicians: { id: number; name: string }[];
  sites: { id: number; name: string; municipality: string }[];
  initialValues: VisitFormValues;
}

export function VisitForm({ technicians, sites, initialValues }: Props) {
  const [state, formAction, pending] = useActionState(createVisit, { values: initialValues });
  // Campos controlados: conservan lo escrito cuando el servidor rechaza la visita.
  const [values, setValues] = useState(initialValues);

  const update =
    (field: VisitField) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));

  // Con <form action={...}> React 19 resetea el formulario al terminar la
  // acción y los <select> controlados se quedan en blanco aunque el estado
  // conserve su valor. Se envía a mano para evitar ese reseteo; `action` se
  // mantiene para que el formulario funcione también sin JavaScript.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const fieldProps = (field: VisitField) => ({
    id: field,
    name: field,
    value: values[field],
    onChange: update(field),
    required: true,
    "aria-invalid": state.fieldErrors?.[field] ? true : undefined,
    "aria-describedby": state.fieldErrors?.[field] ? `${field}-error` : undefined,
    className: inputClass,
  });

  // La sugerencia vale para el técnico, la obra, el día y la duración que se
  // enviaron; si se cambia alguno de ellos deja de mostrarse.
  const suggestionApplies =
    state.suggestedStartTime !== undefined &&
    state.suggestedStartTime !== values.startTime &&
    (["siteId", "technicianId", "date", "durationMinutes"] as const).every(
      (field) => state.values[field] === values[field],
    );

  function applySuggestion(time: string) {
    setValues((current) => ({ ...current, startTime: time }));
  }

  const start = parseTime(values.startTime);
  const duration = Number(values.durationMinutes);
  const end = start !== null && Number.isInteger(duration) && duration > 0 ? start + duration : null;

  return (
    <form action={formAction} onSubmit={handleSubmit} className={`${cardClass} space-y-5 p-6`}>
      {state.violations && state.violations.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">No se puede guardar la visita porque no cumple estas reglas:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.violations.map((violation, index) => (
              <li key={index}>
                <strong>{RULE_LABELS[violation.rule]}.</strong> {violation.message}
              </li>
            ))}
          </ul>
          {suggestionApplies && <Suggestion time={state.suggestedStartTime} onUse={applySuggestion} />}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="siteId" className={labelClass}>
            Obra
          </label>
          <select {...fieldProps("siteId")}>
            <option value="">Elige una obra</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} — {site.municipality}
              </option>
            ))}
          </select>
          <FieldError field="siteId" message={state.fieldErrors?.siteId} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="technicianId" className={labelClass}>
            Técnico
          </label>
          <select {...fieldProps("technicianId")}>
            <option value="">Elige un técnico</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>
          <FieldError field="technicianId" message={state.fieldErrors?.technicianId} />
        </div>

        <div>
          <label htmlFor="date" className={labelClass}>
            Fecha
          </label>
          <input type="date" {...fieldProps("date")} />
          <FieldError field="date" message={state.fieldErrors?.date} />
        </div>

        <div>
          <label htmlFor="startTime" className={labelClass}>
            Hora de inicio
          </label>
          <input type="time" {...fieldProps("startTime")} />
          <FieldError field="startTime" message={state.fieldErrors?.startTime} />
        </div>

        <div>
          <label htmlFor="durationMinutes" className={labelClass}>
            Duración (minutos)
          </label>
          <input type="number" min={1} step={1} inputMode="numeric" {...fieldProps("durationMinutes")} />
          <FieldError field="durationMinutes" message={state.fieldErrors?.durationMinutes} />
        </div>

        <p className="self-end pb-2 text-sm text-slate-600" aria-live="polite">
          {end !== null && end < 24 * 60 && `Terminaría a las ${formatMinutes(end)}.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Guardando…" : "Programar visita"}
        </button>
        <Link href="/visitas" className={buttonSecondary}>
          Volver al listado
        </Link>
      </div>
    </form>
  );
}

function Suggestion({ time, onUse }: { time?: string | null; onUse: (time: string) => void }) {
  if (!time) {
    return (
      <p className="mt-3 border-t border-red-200 pt-3">
        Ese día no queda ningún hueco de esa duración para este técnico.
      </p>
    );
  }
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-red-200 pt-3">
      <span>
        La hora libre más cercana para este técnico ese día es a las <strong>{time}</strong>.
      </span>
      <button
        type="button"
        onClick={() => onUse(time)}
        className="rounded-md border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-900 hover:bg-red-100"
      >
        Usar las {time}
      </button>
    </p>
  );
}

function FieldError({ field, message }: { field: VisitField; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${field}-error`} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  );
}
