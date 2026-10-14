import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import PrecisionShell from "./PrecisionShell";

// the sidebar scroll area measures itself, which jsdom cannot do
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

let asPath = "/admin/users";

jest.mock("next/router", () => ({
  useRouter: () => ({
    asPath,
    pathname: asPath,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

const render = (user: any) =>
  renderWithProviders(
    <PrecisionShell>
      <p>page</p>
    </PrecisionShell>,
    { user },
  );

describe("PrecisionShell", () => {
  it("shows the admin section and a breadcrumb to admins", () => {
    asPath = "/admin/users";
    render({ id: "u1", username: "admin", isAdmin: true });

    expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(crumbs).toHaveTextContent("Administration");
    expect(crumbs).toHaveTextContent("User management");
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("keeps admin links away from everyone else", () => {
    asPath = "/account/shares";
    render({ id: "u2", username: "someone", isAdmin: false });

    expect(screen.getByRole("link", { name: "My shares" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit log" })).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumbs" }),
    ).toBeNull();
  });

  it("hides upload from users who may not share", () => {
    asPath = "/account";
    render({ id: "u3", username: "viewer", allowShare: false });

    expect(screen.queryByRole("link", { name: "Upload" })).toBeNull();
  });
});
