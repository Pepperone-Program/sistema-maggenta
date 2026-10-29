"use client";

import { useState } from "react";
import { ExternalLink, Globe, Link2 } from "lucide-react";
import { resources } from "@/config/resources";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResourcePage } from "./resource-page";

type LandingPage = Record<string, unknown>;

function displayValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : value == null || value === "" ? "Não informado" : String(value);
}

function landingUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function displayDate(value: unknown): string {
  if (typeof value !== "string") return displayValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : displayValue(value);
}

export function LandingPagesPage() {
  const [selected, setSelected] = useState<LandingPage | null>(null);
  const url = landingUrl(selected?.url);
  const title = displayValue(selected?.title);
  const details = [
    ["ID", displayValue(selected?.id)],
    ["Slug", displayValue(selected?.slug)],
    ["Data", displayDate(selected?.data_lp)],
    ["Palavras-chave", displayValue(selected?.keywords)],
    ["Descrição", displayValue(selected?.description)],
  ];

  return (
    <>
      <ResourcePage config={resources["landing-pages"]} onRowClick={setSelected} />
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="flex max-h-[92vh] max-w-[1500px] flex-col overflow-hidden p-0">
          <div className="shrink-0 border-b border-stroke px-4 py-3 pr-12 dark:border-dark-3 sm:px-5">
            <DialogTitle className="truncate text-lg font-bold">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-dark-4 dark:text-dark-6">Detalhes e visualização da landing page</DialogDescription>
          </div>
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(250px,320px)_minmax(0,1fr)] lg:overflow-hidden">
            <section aria-label="Informações da landing page" className="space-y-4 border-b border-stroke p-4 dark:border-dark-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary"><Link2 className="size-4" aria-hidden="true" /> Informações</div>
              <dl className="space-y-3 text-sm">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-dark-4 dark:text-dark-6">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words font-medium text-dark dark:text-white">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs font-semibold text-dark-4 dark:text-dark-6">URL cadastrada</dt>
                  <dd className="mt-1 break-all text-dark dark:text-white">{url ? <a className="text-primary underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{displayValue(selected?.url)}</a> : displayValue(selected?.url)}</dd>
                </div>
              </dl>
            </section>
            <section aria-label="Visualização da landing page" className="flex min-h-[440px] flex-col bg-gray-2/60 p-3 dark:bg-dark-2/40 lg:min-h-[70vh]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-dark dark:text-white"><Globe className="size-4 text-primary" aria-hidden="true" /> Visualização</div>
                {url && <a className="inline-flex items-center gap-1.5 rounded-md border border-stroke bg-white px-2.5 py-1.5 text-xs font-semibold text-dark hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white" href={url} target="_blank" rel="noopener noreferrer">Abrir em nova aba <ExternalLink className="size-3.5" aria-hidden="true" /></a>}
              </div>
              {url ? <>
                <div className="min-h-[360px] flex-1 overflow-hidden rounded-md border border-stroke bg-white dark:border-dark-3">
                  <iframe title={`Visualização: ${title}`} src={url} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" className="h-full min-h-[360px] w-full border-0" />
                </div>
                <p className="pt-2 text-xs text-dark-4 dark:text-dark-6">Se a página não aparecer, o site pode bloquear a visualização incorporada. Use “Abrir em nova aba”.</p>
              </> : <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-md border border-dashed border-stroke p-5 text-center text-sm text-dark-4 dark:border-dark-3 dark:text-dark-6">Não há uma URL HTTP ou HTTPS válida para visualizar esta landing page.</div>}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
