"use client";

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded border border-(--rule) px-3 py-2.5 text-left text-sm"
    >
      {label}
      <span
        className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${checked ? "justify-end bg-unal-green-dark" : "justify-start bg-(--rule)"}`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </button>
  );
}
