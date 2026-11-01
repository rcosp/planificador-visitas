import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getVisit, listSites, listTechnicians } from "@/db/queries";
import { formatMinutes, fromTimestamp } from "@/domain/time";
import { describeSlot } from "@/lib/format";
import { parseIdParam } from "@/lib/search-params";
import { buttonSecondary, cardClass, pageTitle } from "@/lib/styles";
import { rescheduleVisit } from "../../actions";
import { VisitForm } from "../../visit-form";

export const metadata: Metadata = { title: "Reprogramar visita · Planificador de visitas" };

type Props = PageProps<"/visitas/[id]/reprogramar">;

export default function RescheduleVisitPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className={pageTitle}>Reprogramar visita</h1>
        <p className="text-sm text-slate-600">
          Puedes cambiar la obra, el técnico, el día, la hora o la duración. Se aplican las mismas
          reglas que al programarla; la propia visita no cuenta como conflicto, así que también se
          puede alargar o mover dentro de su horario.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando visita…</p>}>
        <RescheduleFormLoader params={params} />
      </Suspense>
    </div>
  );
}

async function RescheduleFormLoader({ params }: Pick<Props, "params">) {
  const visitId = parseIdParam((await params).id);
  const visit = visitId === undefined ? null : await getVisit(visitId);
  if (!visit) notFound();

  const slot = describeSlot(visit.startsAt, visit.endsAt);
  if (visit.status !== "scheduled") {
    return (
      <div className={`${cardClass} space-y-4 p-6 text-sm`}>
        <p>Esta visita está cancelada y no se puede reprogramar. Si hace falta, programa una nueva.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/visitas/nueva?tecnico=${visit.technicianId}&fecha=${slot.date}`}
            className={buttonSecondary}
          >
            Programar una visita nueva
          </Link>
          <Link href={`/visitas?fecha=${slot.date}`} className={buttonSecondary}>
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const [technicians, sites] = await Promise.all([listTechnicians(), listSites()]);
  const start = fromTimestamp(visit.startsAt);
  const end = fromTimestamp(visit.endsAt);

  return (
    <div className="space-y-4">
      <p className={`${cardClass} px-4 py-3 text-sm`}>
        <span className="font-medium text-brand-navy">Ahora:</span> {visit.technicianName} en{" "}
        {visit.siteName} ({visit.municipality}), {slot.dateLabel} de {slot.timeLabel}.
      </p>
      <VisitForm
        action={rescheduleVisit.bind(null, visit.id)}
        submitLabel="Guardar cambios"
        technicians={technicians.map(({ id, name }) => ({ id, name }))}
        sites={sites.map(({ id, name, municipality }) => ({ id, name, municipality }))}
        initialValues={{
          siteId: String(visit.siteId),
          technicianId: String(visit.technicianId),
          date: start.date,
          startTime: formatMinutes(start.minutes),
          durationMinutes: String(end.minutes - start.minutes),
        }}
      />
    </div>
  );
}
