import { renderHook } from "@testing-library/react";
import { ReactNode } from "react";
import { withProviders } from "../test/renderWithProviders";
import useHomeHref from "./homeHref.hook";

// Where "go home" links point. Linking to / when the start page is off sent
// people through the home page and its redirect.

const homeHref = (config: Record<string, string>, user: any = null) =>
  renderHook(() => useHomeHref(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      withProviders(<>{children}</>, { config, user }),
  }).result.current;

describe("useHomeHref", () => {
  it("goes to upload for someone signed in", () => {
    expect(homeHref({ "general.showHomePage": "true" }, { id: "u" })).toBe(
      "/upload",
    );
  });

  it("goes to the start page while it is on", () => {
    expect(homeHref({ "general.showHomePage": "true" })).toBe("/");
  });

  it("goes to upload or sign in while it is off", () => {
    expect(
      homeHref({
        "general.showHomePage": "false",
        "security.allowUnauthenticatedShares": "true",
      }),
    ).toBe("/upload");
    expect(
      homeHref({
        "general.showHomePage": "false",
        "security.allowUnauthenticatedShares": "false",
      }),
    ).toBe("/auth/signIn");
  });
});
