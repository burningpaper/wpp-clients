import { cn } from "@/lib/cn";

type Strength = "cold" | "warm" | "strong";

const config: Record<Strength, { label: string; className: string }> = {
  cold: {
    label: "Cold",
    className: "bg-gray-700 text-gray-300",
  },
  warm: {
    label: "Warm",
    className: "bg-amber-900/40 text-amber-400",
  },
  strong: {
    label: "Strong",
    className: "bg-green-900/40 text-green-400",
  },
};

export function StrengthBadge({ strength }: { strength: Strength | null }) {
  if (!strength) return null;
  const { label, className } = config[strength];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5",
          strength === "cold"
            ? "bg-gray-400"
            : strength === "warm"
            ? "bg-amber-400"
            : "bg-green-400"
        )}
      />
      {label}
    </span>
  );
}
