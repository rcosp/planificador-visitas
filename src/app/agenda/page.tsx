import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { findNextVisitDate, listTechnicians, listVisits, type VisitRow } from "@/db/queries";
import { WORKDAY_END, WORKDAY_START } from "@/domain/scheduling";
import { addDays, formatMinutes, fromTimestamp, today } from "@/domain/time";
import { formatDate, formatLongDate } from "@/lib/format";
import { parseDateParam } from "@/lib/search-params";
import { buttonPrimary, buttonSecondary, cardClass, pageTitle } from "@/lib/styles";

export const metadata: Metadata = { title: "Agenda · Planificador de visitas" };

// La jornada se dibuja como una columna por técnico de altura fija; las visitas
// se colocan encima con top y height en porcentaje de la jornada.
const DAY_MINUTES = WORKDAY_END - WORKDAY_START;
const HOUR_HEIGHT_REM = 4;
const COLUMN_HEIGHT = `${(DAY_MINUTES / 60) * HOUR_HEIGHT_REM}rem`;
const SLOT_MINUTES = 30;
const HOURS = Array.from({ length: DAY_MINUTES / 60 + 1 }, (_, i) => WORKDAY_START + i * 60);
const SLOTS = Array.from(
  { length: DAY_MINUTES / SLOT_MINUTES },
  (_, i) => WORKDAY_START + i * SLOT_MINUTES,
);

const percent = (minutes: number) => `${(minutes / DAY_MINUTES) * 100}%`;
const linkClass = "font-medium text-brand-blue hover:underline";

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Agenda</h1>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando agenda…</p>}>
        <AgendaDay searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AgendaDay({ searchParams }: Pick<PageProps<"/agenda">, "searchParams">) {
  const params = await searchParams;
  await connection(); // today() lee el reloj: solo en la petición
  const currentDay = today();
  const date = parseDateParam(params.fecha) ?? currentDay;

  const [technicians, rows] = await Promise.all([listTechnicians(), listVisits({ date })]);
  const scheduled = rows.filter((row) => row.status === "scheduled");
  const cancelledCount = rows.length - scheduled.length;
  const nextDate = scheduled.length === 0 ? await findNextVisitDate(date) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Cambiar de día" className="flex gap-2">
          <Link href={`/agenda?fecha=${addDays(date, -1)}`} className={buttonSecondary}>
            ← Anterior
          </Link>
          <Link href="/agenda" className={buttonSecondary}>
            Hoy
          </Link>
          <Link href={`/agenda?fecha=${addDays(date, 1)}`} className={buttonSecondary}>
            Siguiente →
          </Link>
        </nav>
        {/* La key reinicia la fecha al cambiar de día con los botones. */}
        <Form key={date} action="/agenda" className="flex gap-2">
          <label htmlFor="fecha" className="sr-only">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            name="fecha"
            defaultValue={date}
            required
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <button type="submit" className={buttonSecondary}>
            Ir
          </button>
        </Form>
        <Link href={`/visitas/nueva?fecha=${date}`} className={`${buttonPrimary} sm:ml-auto`}>
          Programar visita
        </Link>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-brand-navy first-letter:uppercase">
          {formatLongDate(date)}
          {date === currentDay && (
            <span className="ml-2 rounded-full bg-brand-mint/40 px-2 py-0.5 align-middle text-xs font-medium">
              Hoy
            </span>
          )}
        </h2>
        <p className="text-sm text-slate-600">
          {scheduled.length === 0
            ? "No hay visitas programadas este día"
            : scheduled.length === 1
              ? "1 visita programada"
              : `${scheduled.length} visitas programadas`}
          {nextDate && (
            <>
              {" · "}
              <Link href={`/agenda?fecha=${nextDate}`} className={linkClass}>
                Ir al siguiente día con visitas ({formatDate(nextDate)})
              </Link>
            </>
          )}
          {cancelledCount > 0 && (
            <>
              {" · "}
              <Link href={`/visitas?fecha=${date}`} className={linkClass}>
                Ver {cancelledCount === 1 ? "1 cancelada" : `${cancelledCount} canceladas`} en el
                listado
              </Link>
            </>
          )}
        </p>
        <p className="text-sm text-slate-500">
          Pulsa un hueco libre para programar una visita a esa hora.
        </p>
      </div>

      {technicians.length === 0 ? (
        <div className={`${cardClass} p-8 text-center text-sm text-slate-600`}>
          No hay técnicos.
        </div>
      ) : (
        // relative: contiene el texto sr-only de los bloques dentro del scroll.
        <div className={`${cardClass} relative overflow-x-auto`}>
          <div
            className="grid min-w-[640px] pb-3"
            style={{ gridTemplateColumns: `3.5rem repeat(${technicians.length}, minmax(0, 1fr))` }}
          >
            <div className="border-b border-slate-200" />
            {technicians.map((technician) => {
              const count = scheduled.filter((v) => v.technicianId === technician.id).length;
              return (
                <div
                  key={technician.id}
                  className="border-b border-l border-slate-200 px-3 py-2 text-sm font-medium text-brand-navy"
                >
                  {technician.name}
                  <span className="block text-xs font-normal text-slate-500">
                    {count === 1 ? "1 visita" : `${count} visitas`}
                  </span>
                </div>
              );
            })}

            <HourLabels />
            {technicians.map((technician) => (
              <TechnicianColumn
                key={technician.id}
                technician={technician}
                date={date}
                visits={scheduled.filter((v) => v.technicianId === technician.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HourLabels() {
  return (
    <div className="relative" style={{ height: COLUMN_HEIGHT }} aria-hidden>
      {HOURS.map((minutes) => (
        <span
          key={minutes}
          className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-slate-500"
          style={{ top: percent(minutes - WORKDAY_START) }}
        >
          {formatMinutes(minutes)}
        </span>
      ))}
    </div>
  );
}

function TechnicianColumn({
  technician,
  date,
  visits,
}: {
  technician: { id: number; name: string };
  date: string;
  visits: VisitRow[];
}) {
  const blocks = visits.map((visit) => ({
    visit,
    start: fromTimestamp(visit.startsAt).minutes,
    end: fromTimestamp(visit.endsAt).minutes,
  }));

  return (
    <div className="relative border-l border-slate-200" style={{ height: COLUMN_HEIGHT }}>
      {/* Franjas de media hora: las libres enlazan al formulario con la hora puesta. */}
      <div className="flex h-full flex-col">
        {SLOTS.map((slot) => {
          const time = formatMinutes(slot);
          const line =
            slot % 60 === 0 ? "border-t border-slate-200" : "border-t border-dashed border-slate-100";
          const busy = blocks.some(({ start, end }) => start < slot + SLOT_MINUTES && slot < end);
          if (busy) return <div key={slot} className={`flex-1 ${line}`} />;
          return (
            <Link
              key={slot}
              href={`/visitas/nueva?tecnico=${technician.id}&fecha=${date}&hora=${time}`}
              aria-label={`Programar visita para ${technician.name} a las ${time}`}
              className={`group flex-1 px-2 text-xs leading-6 text-brand-blue hover:bg-brand-mint/20 focus-visible:bg-brand-mint/20 focus-visible:outline-none ${line}`}
            >
              <span className="invisible group-hover:visible group-focus-visible:visible">
                + {time}
              </span>
            </Link>
          );
        })}
      </div>

      {blocks.map(({ visit, start, end }) => {
        const timeLabel = `${formatMinutes(start)}–${formatMinutes(end)}`;
        return (
          <Link
            key={visit.id}
            href={`/visitas?tecnico=${technician.id}&fecha=${date}`}
            title={`${timeLabel} · ${visit.siteName} (${visit.municipality})`}
            className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 border-brand-blue bg-brand-mint/45 px-2 py-1 text-xs leading-4 text-brand-navy shadow-sm hover:bg-brand-mint/70"
            style={{
              top: percent(start - WORKDAY_START),
              height: `calc(${percent(end - start)} - 2px)`,
            }}
          >
            <span className="sr-only">{technician.name}, </span>
            <span className="block font-semibold tabular-nums">{timeLabel}</span>
            <span className="block truncate">{visit.siteName}</span>
            <span className="block truncate text-slate-600">{visit.municipality}</span>
          </Link>
        );
      })}
    </div>
  );
}
