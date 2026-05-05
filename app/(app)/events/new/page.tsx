import { requireAuth } from "@/lib/auth";
import { createEvent } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAuth();

  return (
    <div className="max-w-lg">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to events
      </Link>

      <h1 className="text-white text-2xl font-semibold mb-6">New event</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <form action={createEvent} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
              Event name <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. WPP Stream 2026"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
              Venue
            </label>
            <input
              name="venue"
              placeholder="e.g. Tintswalo Atlantic"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">
                Date
              </label>
              <input
                name="event_date"
                type="date"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">
                Capacity
              </label>
              <input
                name="capacity"
                type="number"
                min="1"
                placeholder="e.g. 150"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Optional notes about this event"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Create event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
