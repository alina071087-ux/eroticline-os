import { Bot, type LucideIcon } from "lucide-react";
import { metricDisplayConfig } from "@/lib/data/metricDisplayConfig";
import type { DashboardViewModel } from "@/lib/types/finance";

type DashboardViewProps = {
  data: DashboardViewModel;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function getTodayDate(): string {
  return new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function MetricCard({
  title,
  value,
  icon: Icon,
  accent,
  bg,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
}) {
  return (
    <article className="group rounded-2xl border border-white/[0.06] bg-[#111113] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-[#141416] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_16px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-50">
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className={`h-5 w-5 ${accent}`} strokeWidth={1.75} />
        </div>
      </div>
    </article>
  );
}

export function DashboardView({ data }: DashboardViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <header className="mb-10 border-b border-white/[0.06] pb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {getGreeting()}, Алина 👋
        </h2>
        <p className="mt-2 text-base capitalize text-zinc-400">
          {getTodayDate()}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => {
          const display = metricDisplayConfig[metric.key];

          return (
            <MetricCard
              key={metric.key}
              title={metric.title}
              value={metric.value}
              icon={display.icon}
              accent={display.accent}
              bg={display.bg}
            />
          );
        })}
      </section>

      <section className="mt-6">
        <article className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#14101f] via-[#111113] to-[#0f1117] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.25)] transition-all duration-200 hover:border-violet-500/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_20px_48px_rgba(0,0,0,0.3)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
              <Bot className="h-6 w-6 text-violet-400" strokeWidth={1.75} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-wider text-violet-300/80">
                AI CFO
              </h3>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-300">
                Свободных денег хватит примерно на{" "}
                <span className="font-medium text-zinc-100">
                  {data.aiCfo.cashRunwayDays} дней
                </span>
                .
                <br />
                Следующая крупная оплата фабрике через{" "}
                <span className="font-medium text-zinc-100">
                  {data.aiCfo.nextFactoryPaymentDays} дней
                </span>
                .
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
