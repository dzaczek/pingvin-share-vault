import { fireEvent, screen, waitFor } from "@testing-library/react";
import Account from "../../pages/account";
import User from "../../types/user.type";
import { renderWithProviders } from "../renderWithProviders";

// Password resets go to the account's address, so the server only changes it
// together with the current password. The form asks for it when needed.

const updateCurrentUser = jest.fn();

jest.mock("../../services/user.service", () => ({
  __esModule: true,
  default: {
    updateCurrentUser: (...args: unknown[]) => updateCurrentUser(...args),
  },
}));

jest.mock("../../services/auth.service", () => ({
  __esModule: true,
  default: {
    getAvailableOAuth: async () => ({ data: [] }),
    getOAuthStatus: async () => ({ data: {} }),
  },
}));

// they need ResizeObserver, which jsdom lacks, and are not under test here
jest.mock("../../components/account/ThemeSwitcher", () => () => null);
jest.mock("../../components/account/LanguagePicker", () => () => null);

const anna = {
  id: "u1",
  username: "anna",
  email: "anna@example.com",
  displayName: "Anna",
  isAdmin: false,
  isLdap: false,
  totpVerified: false,
  hasPassword: true,
} as unknown as User;

// the 2FA card has a "Password" field of its own
const passwordField = () =>
  document.querySelector<HTMLInputElement>(
    'input[autocomplete="current-password"]',
  );

beforeEach(() => updateCurrentUser.mockReset().mockResolvedValue(anna));

describe("account page", () => {
  it("asks for the password only once the address changes", async () => {
    renderWithProviders(<Account />, { user: anna });
    expect(passwordField()).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: "anna@new.example" },
    });
    fireEvent.change(passwordField()!, { target: { value: "secret" } });
    fireEvent.click(screen.getAllByRole("button", { name: /save/i })[0]);

    await waitFor(() =>
      expect(updateCurrentUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "anna@new.example",
          currentPassword: "secret",
        }),
      ),
    );
  });

  it("sends no password for other changes", async () => {
    renderWithProviders(<Account />, { user: anna });

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Anna K" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /save/i })[0]);

    await waitFor(() => expect(updateCurrentUser).toHaveBeenCalled());
    expect(updateCurrentUser.mock.calls[0][0]).not.toHaveProperty(
      "currentPassword",
    );
  });

  it("does not ask an account without a password", () => {
    renderWithProviders(<Account />, { user: { ...anna, hasPassword: false } });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: "anna@new.example" },
    });
    expect(passwordField()).not.toBeInTheDocument();
  });
});
