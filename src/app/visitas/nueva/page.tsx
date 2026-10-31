import type { Metadata } from "next";
import { Suspense } from "react";
import { listSites, listTechnicians } from "@/db/queries";
import { parseDateParam, parseIdParam, parseTimeParam } from "@/lib/search-params";
import { pageTitle } from "@/lib/styles";
import { VisitForm } from "./visit-form";

export const metadata: Metadata = { title: "Programar visita · Planificador de visitas" };

export default function NewVisitPage({ searchParams }: PageProps<"/visitas/nueva">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className={pageTitle}>Programar visita</h1>
        <p className="text-sm text-slate-600">
          La visita debe empezar y terminar entre las 08:00 y las 17:00, no puede solaparse con otra
          del mismo técnico y, si la visita anterior o la siguiente es en otra obra, tiene que haber al
          menos 30 minutos entre ambas para el desplazamiento.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando formulario…</p>}>
        <VisitFormLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VisitFormLoader({ searchParams }: Pick<PageProps<"/visitas/nueva">, "searchParams">) {
  const params = await searchParams;
  const [technicians, sites] = await Promise.all([listTechnicians(), listSites()]);

  return (
    <VisitForm
      technicians={technicians.map(({ id, name }) => ({ id, name }))}
      sites={sites.map(({ id, name, municipality }) => ({ id, name, municipality }))}
      initialValues={{
        siteId: "",
        technicianId: String(parseIdParam(params.tecnico) ?? ""),
        date: parseDateParam(params.fecha) ?? "",
        startTime: parseTimeParam(params.hora) ?? "09:00",
        durationMinutes: "60",
      }}
    />
  );
}
