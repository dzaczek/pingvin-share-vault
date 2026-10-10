import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import Header from "./Header";

// Written against the previous implementation first, so the refactor that
// follows has to keep these true.
//
// The header marks the link for the page you are on. Mantine merges the base
// and active styles into one generated class name, so what a test can see is
// that the name differs between a link whose route is current and one whose
// route is not.

let pathname = "/upload";

jest.mock("next/router", () => ({
  useRouter: () => ({ pathname, push: jest.fn(), replace: jest.fn() }),
}));

const signedIn = { id: "u1", username: "someone" } as any;

const uploadLinkClass = (route: string) => {
  pathname = route;
  const { unmount } = renderWithProviders(<Header />, { user: signedIn });
  const className = screen.getByRole("link", { name: "Upload" }).className;
  unmount();
  return className;
};

describe("Header", () => {
  it("styles the upload link differently while on the upload page", () => {
    expect(uploadLinkClass("/upload")).not.toBe(
      uploadLinkClass("/somewhere-else"),
    );
  });

  it("styles it the same on any page that is not its own", () => {
    expect(uploadLinkClass("/somewhere-else")).toBe(
      uploadLinkClass("/account/shares"),
    );
  });

  it("still marks it after navigating to it", () => {
    const away = uploadLinkClass("/account/shares");
    const back = uploadLinkClass("/upload");

    expect(back).not.toBe(away);
  });
});

// Recipients of a share or an upload link are often outside the company and
// have no account to sign in with. An admin can hide the buttons there.
describe("Header auth buttons for guests", () => {
  const authLinks = (route: string, config: Record<string, string>) => {
    pathname = route;
    const { unmount } = renderWithProviders(<Header />, {
      user: null,
      config: { "security.allowRegistration": "true", ...config },
    });
    const names = ["Sign in", "Sign up"].filter(
      (name) => screen.queryAllByRole("link", { name }).length > 0,
    );
    unmount();
    return names;
  };

  it("shows them by default", () => {
    expect(authLinks("/share/[shareId]", {})).toEqual(["Sign in", "Sign up"]);
  });

  it("hides them on a share page when switched off", () => {
    expect(
      authLinks("/share/[shareId]", { "general.showAuthButtons": "false" }),
    ).toEqual([]);
  });

  it("hides them on a reverse share upload page when switched off", () => {
    expect(
      authLinks("/upload/[reverseShareToken]", {
        "general.showAuthButtons": "false",
      }),
    ).toEqual([]);
  });

  it("keeps them everywhere else", () => {
    expect(authLinks("/", { "general.showAuthButtons": "false" })).toEqual([
      "Sign in",
      "Sign up",
    ]);
  });
});
