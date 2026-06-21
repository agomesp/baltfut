import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Health check for the test harness itself: confirms jsdom rendering plus the
 * jest-dom matchers are wired. If this fails, the testing setup is broken — not
 * the feature under test.
 */
describe("test harness", () => {
  it("renders React into jsdom and exposes jest-dom matchers", () => {
    render(<button type="button">Vote</button>);
    expect(screen.getByRole("button", { name: "Vote" })).toBeInTheDocument();
  });
});
