import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function decodeRiotIdParam(riotId: string): string | null {
  try {
    return decodeURIComponent(riotId).trim();
  } catch {
    return null;
  }
}

export function formatRiotIdParam(riotId: string): string {
  return decodeRiotIdParam(riotId) || "TestPlayer#LAS";
}

export function encodeRiotId(riotId: string): string {
  return encodeURIComponent(riotId);
}

export function parseRiotId(riotId: string): { gameName: string; tagLine: string } | null {
  const [gameName, tagLine, ...extra] = riotId.split("#");

  if (!gameName?.trim() || !tagLine?.trim() || extra.length > 0) {
    return null;
  }

  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
  };
}

export function toPercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
