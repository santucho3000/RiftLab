"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { encodeRiotId, parseRiotId } from "@/lib/utils";

type ResolveAccountResponse =
  | {
      ok: true;
      mode: "mock" | "riot";
      riotId: string;
      message?: string;
      account: {
        puuid: string;
        gameName: string;
        tagLine: string;
      } | null;
    }
  | {
      ok: false;
      error: string;
      code: string;
    };

export function SearchPlayer() {
  const router = useRouter();
  const [riotId, setRiotId] = useState("TestPlayer#LAS");
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRiotId = riotId.trim() || "TestPlayer#LAS";
    const parsedRiotId = parseRiotId(nextRiotId);

    setError(null);
    setNotice(null);

    if (!parsedRiotId) {
      setError("Use Riot ID format Name#TAG.");
      return;
    }

    setIsResolving(true);

    try {
      const response = await fetch("/api/riot/account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ riotId: nextRiotId }),
      });
      const result = (await response.json()) as ResolveAccountResponse;

      if (!response.ok || !result.ok) {
        setError(result.ok ? "Unable to resolve that Riot ID." : result.error);
        return;
      }

      if (result.mode === "mock" && result.message) {
        setNotice(result.message);
      }

      router.push(`/player/${encodeRiotId(result.riotId)}`);
    } catch {
      setError("Could not reach the server-side Riot resolver. Try again.");
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 rounded-md border border-white/[0.08] bg-lab-panel/92 p-3 shadow-panel-glow sm:flex-row"
      >
        <label className="sr-only" htmlFor="riot-id">
          Riot ID
        </label>
        <div className="flex min-h-12 flex-1 items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-4">
          <Search className="h-4 w-4 shrink-0 text-lab-cyan" aria-hidden="true" />
          <input
            id="riot-id"
            value={riotId}
            onChange={(event) => setRiotId(event.target.value)}
            placeholder="Name#TAG"
            disabled={isResolving}
            className="h-12 w-full bg-transparent text-base text-lab-text outline-none placeholder:text-lab-muted disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
        <button
          type="submit"
          disabled={isResolving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-lab-cyan px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-lab-cyan focus:ring-offset-2 focus:ring-offset-lab-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isResolving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Resolving
            </>
          ) : (
            "Analyze Player"
          )}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm leading-6 text-lab-red">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm leading-6 text-lab-amber">{notice}</p> : null}
    </div>
  );
}
