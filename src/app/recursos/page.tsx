import type { Metadata } from "next";
import { Suspense } from "react";
import { listSites, listTechnicians } from "@/db/queries";
import { cardClass } from "@/lib/styles";

export const metadata: Metadata = { title: "Técnicos y obras · Planificador de visitas" };

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Técnicos y obras</h1>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <Resources />
      </Suspense>
    </div>
  );
}

async function Resources() {
  const [technicians, sites] = await Promise.all([listTechnicians(), listSites()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Técnicos ({technicians.length})</h2>
        <ul className={`${cardClass} divide-y divide-slate-100 text-sm`}>
          {technicians.map((technician) => (
            <li key={technician.id} className="flex justify-between gap-4 px-4 py-3">
              <span>{technician.name}</span>
              <span className="tabular-nums text-slate-500">{technician.phone}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Obras ({sites.length})</h2>
        <ul className={`${cardClass} divide-y divide-slate-100 text-sm`}>
          {sites.map((site) => (
            <li key={site.id} className="px-4 py-3">
              <span className="font-medium">{site.name}</span>
              <span className="block text-slate-500">
                {site.address} · {site.municipality}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
