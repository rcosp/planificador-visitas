import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { listTechnicians, listVisits, type VisitRow } from "@/db/queries";
import { STATUS_LABELS, type VisitStatus } from "@/domain/scheduling";
import { describeSlot } from "@/lib/format";
import { parseDateParam, parseIdParam } from "@/lib/search-params";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, pageTitle } from "@/lib/styles";
import { CancelVisitButton } from "./cancel-visit-button";

export const metadata: Metadata = { title: "Visitas · Planificador de visitas" };

export default function VisitsPage({ searchParams }: PageProps<"/visitas">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitle}>Visitas</h1>
        <Link href="/visitas/nueva" className={buttonPrimary}>
          Programar visita
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando visitas…</p>}>
        <VisitsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VisitsList({ searchParams }: Pick<PageProps<"/visitas">, "searchParams">) {
  const params = await searchParams;
  const technicianId = parseIdParam(params.tecnico);
  const date = parseDateParam(params.fecha);
  const createdId = parseIdParam(params.creada);

  const [technicians, rows] = await Promise.all([
    listTechnicians(),
    listVisits({ technicianId, date }),
  ]);
  const scheduledCount = rows.filter((row) => row.status === "scheduled").length;
  const isFiltered = technicianId !== undefined || date !== undefined;

  return (
    <div className="space-y-4">
      {createdId !== undefined && rows.some((row) => row.id === createdId) && (
        <p
          role="status"
          className="rounded-md border border-brand-mint bg-brand-mint/25 px-4 py-3 text-sm text-brand-navy"
        >
          Visita programada correctamente.
        </p>
      )}

      {/* La key reinicia los campos al cambiar de filtro con el navegador. */}
      <Form
        key={`${technicianId}-${date}`}
        action="/visitas"
        className={`${cardClass} flex flex-wrap items-end gap-4 p-4`}
      >
        <label className={`${labelClass} min-w-48 flex-1`}>
          Técnico
          <select name="tecnico" defaultValue={technicianId ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} min-w-40`}>
          Fecha
          <input type="date" name="fecha" defaultValue={date ?? ""} className={inputClass} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonSecondary}>
            Filtrar
          </button>
          {isFiltered && (
            <Link href="/visitas" className={buttonSecondary}>
              Quitar filtros
            </Link>
          )}
        </div>
      </Form>

      <p className="text-sm text-slate-600">
        {rows.length === 1 ? "1 visita" : `${rows.length} visitas`} · {scheduledCount}{" "}
        {scheduledCount === 1 ? "programada" : "programadas"}
      </p>

      {rows.length === 0 ? (
        <div className={`${cardClass} p-8 text-center text-sm text-slate-600`}>
          No hay visitas {isFiltered ? "con estos filtros" : "todavía"}.
        </div>
      ) : (
        <VisitsTable rows={rows} highlightId={createdId} />
      )}
    </div>
  );
}

function VisitsTable({ rows, highlightId }: { rows: VisitRow[]; highlightId?: number }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Hora</th>
            <th className="px-4 py-3 font-medium">Técnico</th>
            <th className="px-4 py-3 font-medium">Obra</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const slot = describeSlot(row.startsAt, row.endsAt);
            const cancelled = row.status === "cancelled";
            return (
              <tr
                key={row.id}
                className={row.id === highlightId ? "bg-brand-mint/20" : cancelled ? "text-slate-400" : undefined}
              >
                <td className="whitespace-nowrap px-4 py-3">{slot.dateLabel}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="tabular-nums">{slot.timeLabel}</span>
                  <span className="ml-2 text-xs text-slate-500">{slot.durationLabel}</span>
                </td>
                <td className="px-4 py-3">{row.technicianName}</td>
                <td className="px-4 py-3">
                  {row.siteName}
                  <span className="block text-xs text-slate-500">{row.municipality}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {!cancelled && (
                    <CancelVisitButton
                      visitId={row.id}
                      description={`de ${row.technicianName} en ${row.siteName} (${slot.dateLabel}, ${slot.timeLabel})`}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: VisitStatus }) {
  const style =
    status === "scheduled"
      ? "bg-brand-mint/30 text-brand-navy ring-brand-mint"
      : "bg-slate-100 text-slate-500 ring-slate-400/20";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
