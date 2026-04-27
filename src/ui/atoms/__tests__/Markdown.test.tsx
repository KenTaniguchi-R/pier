import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Markdown } from "../Markdown";
import { OpenerProvider } from "../../../state/OpenerContext";

const opener = { open: async () => {} };
function R(src: string) {
  return render(
    <OpenerProvider opener={opener}>
      <Markdown source={src} />
    </OpenerProvider>,
  );
}

describe("Markdown", () => {
  it("renders an h2 heading", () => { R("## Hello"); expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hello"); });
  it("renders an unordered list", () => { R("- one\n- two"); expect(screen.getAllByRole("listitem")).toHaveLength(2); });
  it("does not inject <script>", () => { R("<script>window.PWNED=1</script>"); expect(document.querySelector("script")).toBeNull(); });
  it("renders a link via SafeLink", () => { R("Visit [Pier](https://example.com)."); expect(screen.getByRole("link", { name: "Pier" })).toBeInTheDocument(); });
  it("renders inline code", () => { const { container } = R("Use `npm test`."); expect(container.querySelector("code")?.textContent).toBe("npm test"); });
});
