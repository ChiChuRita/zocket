import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

interface Comparison {
  id: string;
  competitor: string;
  useCase: string;
  description: string;
  competitorFile: string;
  competitorHtml: string;
  zocketFile: string;
  zocketHtml: string;
  takeaway: string;
}

export function ComparisonShowcase({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <Tabs defaultValue={comparisons[0]?.id} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-gradient-to-r from-[hsl(30,100%,50%)]/70 to-transparent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(30,100%,65%)]/75">
            Compare the tradeoffs
          </span>
        </div>
        <TabsList className="flex-wrap md:flex-nowrap">
          {comparisons.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              vs {c.competitor}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {comparisons.map((c) => (
        <TabsContent
          key={c.id}
          value={c.id}
          className="flex flex-col gap-5 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/[0.08] bg-black/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">
                Use case
              </span>
              <span className="text-lg font-semibold text-white/95">{c.useCase}</span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-white/45 sm:text-right">
              {c.description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d]/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors duration-300 hover:border-white/[0.12]">
              <div className="flex items-center border-b border-white/[0.06] px-5 py-3">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]" />
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]" />
                  <div className="h-3 w-3 rounded-full bg-white/[0.08]" />
                </div>
                <span className="mx-auto font-mono text-[11px] font-medium tracking-wide text-white/25 uppercase">
                  {c.competitorFile}
                </span>
                <span className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/40">
                  {c.competitor}
                </span>
              </div>
              <div
                className="comparison-code max-h-[400px] overflow-auto px-5 py-4 text-[13px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: c.competitorHtml }}
              />
            </div>

            <div className="flex flex-col overflow-hidden rounded-2xl border border-[hsl(30,100%,50%)]/20 bg-[#0d0d0d]/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors duration-300 hover:border-[hsl(30,100%,50%)]/30">
              <div className="flex items-center border-b border-[hsl(30,100%,50%)]/10 px-5 py-3">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-[hsl(30,100%,50%)]/20" />
                  <div className="h-3 w-3 rounded-full bg-[hsl(30,100%,50%)]/20" />
                  <div className="h-3 w-3 rounded-full bg-[hsl(30,100%,50%)]/20" />
                </div>
                <span className="mx-auto font-mono text-[11px] font-medium tracking-wide text-white/25 uppercase">
                  {c.zocketFile}
                </span>
                <span className="rounded bg-[hsl(30,100%,50%)]/10 px-2 py-0.5 font-mono text-[10px] text-[hsl(30,100%,50%)]">
                  Zocket
                </span>
              </div>
              <div
                className="comparison-code max-h-[400px] overflow-auto px-5 py-4 text-[13px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: c.zocketHtml }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(30,100%,50%)]/10 bg-[hsl(30,100%,50%)]/5 px-4 py-3 text-sm leading-relaxed text-white/55">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(30,100%,65%)]/70">
              Takeaway
            </span>
            {c.takeaway}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
