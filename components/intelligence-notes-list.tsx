import { formatDistanceToNow } from "@/lib/date";
import { Lock, Globe } from "lucide-react";

type Note = {
  id: string;
  noteType: string;
  body: string;
  visibility: string;
  createdByAgencyId: string;
  createdAt: Date;
};

const noteTypeColors: Record<string, string> = {
  meeting: "text-blue-400 bg-blue-900/30",
  news: "text-purple-400 bg-purple-900/30",
  budget_signal: "text-yellow-400 bg-yellow-900/30",
  relationship: "text-green-400 bg-green-900/30",
  risk: "text-red-400 bg-red-900/30",
};

type Props = {
  notes: Note[];
  agencyMap: Record<string, string>;
  currentUserRole: string;
};

export function IntelligenceNotesList({ notes, agencyMap, currentUserRole }: Props) {
  if (notes.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 border-dashed rounded-xl p-6 text-center mb-3">
        <p className="text-gray-500 text-sm">
          No intelligence notes yet. Add the first one below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 mb-3">
      {notes.map((note) => (
        <div
          key={note.id}
          className="bg-gray-800 border border-gray-700 rounded-xl p-4"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  noteTypeColors[note.noteType] ?? "text-gray-400 bg-gray-700"
                }`}
              >
                {note.noteType.replace("_", " ")}
              </span>
              {/* Visibility indicator */}
              {note.visibility === "agency_only" ? (
                <span className="flex items-center gap-1 text-amber-400 text-xs">
                  <Lock className="w-3 h-3" />
                  {(currentUserRole === "ceo_md" || currentUserRole === "system_admin")
                    ? agencyMap[note.createdByAgencyId] ?? "Unknown agency"
                    : "Agency only"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500 text-xs">
                  <Globe className="w-3 h-3" />
                  WPP SA
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs shrink-0">
              {formatDistanceToNow(note.createdAt)}
            </span>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {note.body}
          </p>
        </div>
      ))}
    </div>
  );
}
