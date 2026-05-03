"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type RowError = { row: number; field: string; message: string };

type State =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; imported: number }
  | { status: "errors"; errors: RowError[] };

export function ImportForm() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.name.endsWith(".csv")) {
      setState({
        status: "errors",
        errors: [{ row: 0, field: "file", message: "File must be a .csv" }],
      });
      return;
    }

    setState({ status: "uploading" });
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/import", {
      method: "POST",
      body: form,
    });

    const json = await res.json();

    if (res.ok) {
      setState({ status: "success", imported: json.imported });
    } else {
      setState({ status: "errors", errors: json.errors ?? [] });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => state.status !== "uploading" && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${
            dragOver
              ? "border-blue-500 bg-blue-500/5"
              : state.status === "success"
              ? "border-green-600 bg-green-900/10"
              : state.status === "errors"
              ? "border-red-700 bg-red-900/10"
              : "border-gray-700 hover:border-gray-500 bg-gray-800"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {state.status === "idle" || state.status === "uploading" ? (
          <>
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-white text-sm font-medium mb-1">
              {state.status === "uploading"
                ? "Validating and importing…"
                : "Drop your CSV here, or click to browse"}
            </p>
            <p className="text-gray-500 text-xs">Max 4MB</p>
          </>
        ) : state.status === "success" ? (
          <>
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 text-sm font-medium">
              {state.imported} contact{state.imported !== 1 ? "s" : ""}{" "}
              imported successfully
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setState({ status: "idle" });
              }}
              className="text-gray-500 hover:text-gray-300 text-xs mt-2 underline"
            >
              Import another file
            </button>
          </>
        ) : (
          <>
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 text-sm font-medium mb-1">
              Import failed — no data was written
            </p>
            <p className="text-gray-500 text-xs">
              Fix the errors below and re-upload the full file.
            </p>
          </>
        )}
      </div>

      {/* Error table */}
      {state.status === "errors" && state.errors.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-amber-300 text-sm font-medium">
              {state.errors.length} error
              {state.errors.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-750">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">
                    Row
                  </th>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">
                    Field
                  </th>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.errors.map((err, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-700"
                  >
                    <td className="px-4 py-2.5 text-gray-300 font-mono">
                      {err.row || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-amber-400 font-mono">
                      {err.field}
                    </td>
                    <td className="px-4 py-2.5 text-red-300">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => {
              setState({ status: "idle" });
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Try again with a corrected file →
          </button>
        </div>
      )}
    </div>
  );
}
