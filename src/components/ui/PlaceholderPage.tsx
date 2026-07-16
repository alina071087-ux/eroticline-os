export function PlaceholderPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] items-center justify-center px-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-8 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <p className="text-lg font-medium text-zinc-300">Раздел в разработке</p>
        <p className="mt-2 text-sm text-zinc-500">
          Скоро здесь появится функциональность
        </p>
      </div>
    </div>
  );
}
