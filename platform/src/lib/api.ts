import { treaty } from "@elysiajs/eden";
import type { PlatformApi } from "../server/api/app";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.PLATFORM_PUBLIC_URL ?? "http://localhost:3000";
}

export function getApi() {
  return treaty<PlatformApi>(getBaseUrl()).api;
}

export function requireApiData<T>(result: { data: T; error: unknown }) {
  if (result.error) {
    if (
      typeof result.error === "object" &&
      result.error !== null &&
      "value" in result.error &&
      typeof result.error.value === "object" &&
      result.error.value !== null &&
      "error" in result.error.value &&
      typeof result.error.value.error === "string"
    ) {
      throw new Error(result.error.value.error);
    }

    throw new Error("API request failed");
  }

  return result.data;
}

export async function readApiData<T>(request: Promise<{ data: unknown; error: unknown }>) {
  return requireApiData<T>(await request as { data: T; error: unknown });
}
