import { fireEvent, screen, waitFor } from "@testing-library/react";
import ResetPassword from "../../pages/auth/resetPassword/[resetPasswordToken]";
import { renderWithProviders } from "../renderWithProviders";

// The new password is checked against the configured policy before it is
// sent, the same rules the server applies, instead of a fixed 8.

const resetPassword = jest.fn();

jest.mock("../../services/auth.service", () => ({
  __esModule: true,
  default: {
    resetPassword: (...args: unknown[]) => resetPassword(...args),
  },
}));

jest.mock("next/router", () => ({
  useRouter: () => ({ query: { resetPasswordToken: "tok" }, push: jest.fn() }),
}));

const submit = (password: string) => {
  fireEvent.change(screen.getByLabelText(/new password/i), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
};

beforeEach(() => resetPassword.mockReset().mockResolvedValue(undefined));

describe("reset password page", () => {
  it("asks for 8 characters with the policy off", async () => {
    renderWithProviders(<ResetPassword />);

    submit("1234567");

    expect(
      await screen.findByText("Must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("follows the custom policy", async () => {
    renderWithProviders(<ResetPassword />, {
      config: {
        "security.customPasswordPolicy": "true",
        "security.minLength": "12",
        "security.requireNumber": "true",
      },
    });

    submit("abcdefghi1");
    expect(
      await screen.findByText("Must be at least 12 characters"),
    ).toBeInTheDocument();

    submit("abcdefghijkl");
    expect(
      await screen.findByText("Password must contain at least one number"),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();

    submit("abcdefghijk1");
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith("tok", "abcdefghijk1"),
    );
  });
});
