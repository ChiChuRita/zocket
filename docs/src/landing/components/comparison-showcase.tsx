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
      <TabsList className="flex-wrap md:flex-nowrap self-start">
        {comparisons.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            vs {c.competitor}
          </TabsTrigger>
        ))}
      </TabsList>

      {comparisons.map((c) => (
        <TabsContent
          key={c.id}
          value={c.id}
          className="flex flex-col gap-5 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300"
        >
          <div className="frame flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border bg-bg/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
                Use case
              </span>
              <span className="text-base font-semibold text-fg">{c.useCase}</span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-subtle sm:text-right">
              {c.description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CodePane
              title={c.competitorFile}
              label={c.competitor}
              html={c.competitorHtml}
            />
            <CodePane
              title={c.zocketFile}
              label="Zocket"
              html={c.zocketHtml}
              variant="brand"
            />
          </div>

          <div className="rounded-2xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm leading-relaxed text-fg-muted">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.2em] text-brand/80">
              Takeaway
            </span>
            {c.takeaway}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CodePane({
  title,
  label,
  html,
  variant = "default",
}: {
  title: string;
  label: string;
  html: string;
  variant?: "default" | "brand";
}) {
  return (
    <div className={`code-frame flex flex-col overflow-hidden ${variant === "brand" ? "code-frame--brand" : ""}`}>
      <div className="code-header">
        <div className="code-header__dots">
          <span /><span /><span />
        </div>
        <span className="code-header__title">{title}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
            variant === "brand"
              ? "bg-brand/10 text-brand"
              : "bg-fg/[0.06] text-fg-subtle"
          }`}
        >
          {label}
        </span>
      </div>
      <div
        className="comparison-code code-body"
        style={{ maxHeight: "26rem" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
