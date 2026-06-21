import { describe, it, expect, vi, afterEach } from "vitest";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/client";

afterEach(() => vi.unstubAllEnvs());

describe("supabase config", () => {
  it("reads url + anon key from NEXT_PUBLIC env", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(getSupabaseConfig()).toEqual({
      url: "https://proj.supabase.co",
      anonKey: "anon-key",
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("reports not-configured when env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
  });
});
