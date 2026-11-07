import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../renderWithProviders";
import Home from "../../pages/index";

// Lives here rather than beside the page: anything under src/pages is a route
// as far as next is concerned, and it tries to build a test file as one.
//
// Written against the previous implementation first, so the refactor that
// follows has to keep these true.
//
// The home page decides two things from config and session: where the get
// started button points, and whether someone already signed in belongs here
// at all.

const replace = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({ replace, pathname: "/" }),
}));

beforeEach(() => replace.mockClear());

const getStarted = () => screen.getByRole("link", { name: /get started/i });

describe("home page", () => {
  it("sends people to sign up when registration is open", async () => {
    renderWithProviders(<Home />, {
      config: { "security.allowRegistration": "true" },
    });

    await waitFor(() =>
      expect(getStarted()).toHaveAttribute("href", "/auth/signUp"),
    );
  });

  it("sends people to sign in when registration is closed", async () => {
    renderWithProviders(<Home />, {
      config: { "security.allowRegistration": "false" },
    });

    await waitFor(() =>
      expect(getStarted()).toHaveAttribute("href", "/auth/signIn"),
    );
  });

  it("leaves a signed out visitor on the page", async () => {
    renderWithProviders(<Home />);
    await waitFor(() => expect(getStarted()).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it("moves someone already signed in to the upload page", async () => {
    renderWithProviders(<Home />, {
      user: { id: "u1", username: "someone" } as any,
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/upload"));
  });
});

// With the start page turned off the page used to render for a moment before
// the redirect, so the home page flashed up. It now renders nothing and goes
// straight to where the visitor belongs.
describe("home page turned off", () => {
  it("sends a signed out visitor to sign in without showing the page", async () => {
    renderWithProviders(<Home />, {
      config: {
        "general.showHomePage": "false",
        "security.allowUnauthenticatedShares": "false",
      },
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/signIn"));
    expect(screen.queryByRole("link", { name: /get started/i })).toBeNull();
  });

  it("sends a signed out visitor to upload when anonymous shares are allowed", async () => {
    renderWithProviders(<Home />, {
      config: {
        "general.showHomePage": "false",
        "security.allowUnauthenticatedShares": "true",
      },
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/upload"));
    expect(screen.queryByRole("link", { name: /get started/i })).toBeNull();
  });
});
