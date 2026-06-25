import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

function Boom(): never {
  throw new Error("boom");
}

afterEach(cleanup);

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe content")).toBeTruthy();
  });

  it("shows the fallback instead of unmounting the tree when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>fallback ui</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("fallback ui")).toBeTruthy();
    spy.mockRestore();
  });

  it("offers a reload affordance in the default fallback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /recarregar/i })).toBeTruthy();
    spy.mockRestore();
  });
});
