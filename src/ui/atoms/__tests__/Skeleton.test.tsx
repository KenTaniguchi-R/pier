import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  it("renders a div with pulse animation and merges className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" data-testid="s" />);
    const el = container.querySelector('[data-testid="s"]') as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("animate-pulse-soft");
    expect(el.className).toContain("bg-bg-2");
    expect(el.className).toContain("rounded-2");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-20");
  });

  it("is aria-hidden so screen readers skip the placeholder", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
