import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryBrowser } from "../LibraryBrowser";
import { LibraryProvider } from "../../../state/LibraryContext";
import { AppProvider } from "../../../state/AppContext";
import type { LibraryClient } from "../../../application/ports";

const baseClient: LibraryClient = {
  fetchCatalog: async () => ({
    catalogSchemaVersion: 1,
    publishedAt: "x",
    tools: [
      {
        id: "a",
        name: "Kill port",
        version: "1.0.0",
        description: "free a port",
        category: "dev",
        tier: "beginner",
        permissions: { network: false, fsRead: [], fsWrite: [] },
        script: "echo",
      },
      {
        id: "b",
        name: "yt-dlp",
        version: "1.0.0",
        description: "download videos",
        category: "media",
        tier: "advanced",
        permissions: { network: true, fsRead: [], fsWrite: [] },
        script: "echo",
      },
    ],
  }),
  installAndPreview: vi.fn(),
  commitAdd: vi.fn(),
};

function renderWith(client: LibraryClient = baseClient) {
  return render(
    <AppProvider>
      <LibraryProvider client={client}>
        <LibraryBrowser />
      </LibraryProvider>
    </AppProvider>
  );
}

describe("LibraryBrowser", () => {
  it("hides advanced tools by default", async () => {
    renderWith();
    expect(await screen.findByText(/kill port/i)).toBeInTheDocument();
    expect(screen.queryByText(/yt-dlp/i)).toBeNull();
  });

  it("shows advanced when toggle is on", async () => {
    renderWith();
    await screen.findByText(/kill port/i);
    fireEvent.click(screen.getByLabelText(/show advanced/i));
    expect(screen.getByText(/yt-dlp/i)).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    renderWith();
    await screen.findByText(/kill port/i);
    fireEvent.click(screen.getByLabelText(/show advanced/i));
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "video" } });
    expect(screen.queryByText(/kill port/i)).toBeNull();
    expect(screen.getByText(/yt-dlp/i)).toBeInTheDocument();
  });
});
