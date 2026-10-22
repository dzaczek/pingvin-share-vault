import { fireEvent, screen, waitFor } from "@testing-library/react";
import ConfigPage from "../../pages/admin/config/[category]";
import { AdminConfig } from "../../types/config.type";
import { renderWithProviders } from "../renderWithProviders";

const getByCategory = jest.fn();

jest.mock("../../services/config.service", () => ({
  __esModule: true,
  default: {
    getByCategory: (...args: unknown[]) => getByCategory(...args),
    updateMany: jest.fn(),
    get: jest.requireActual("../../services/config.service").default.get,
  },
}));

jest.mock("next/router", () => ({
  useRouter: () => ({ query: { category: "appearance" }, pathname: "/admin" }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

const variable = (key: string, type: string, value: string): AdminConfig =>
  ({
    key,
    name: key.split(".")[1],
    type,
    value,
    defaultValue: value,
    allowEdit: true,
    secret: false,
    description: "",
  }) as unknown as AdminConfig;

beforeEach(() => {
  getByCategory.mockReset();
  getByCategory.mockResolvedValue([
    variable("appearance.themeRadius", "string", "sm"),
    variable("appearance.uiStyle", "string", "standard"),
    variable("appearance.glassTint", "boolean", "true"),
    variable("appearance.customCss", "text", ""),
  ]);
});

// the style sub tabs sit inside a panel that is hidden until it is opened
const tab = (name: string) => screen.getByRole("tab", { name, hidden: true });
const panelOf = (name: string) =>
  screen
    .getAllByRole("tabpanel", { hidden: true })
    .find((panel) => panel.getAttribute("aria-labelledby") === tab(name).id)!;

describe("admin appearance tabs", () => {
  it("puts each setting on its own tab", async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => expect(tab("General")).toBeInTheDocument());

    expect(panelOf("General")).toHaveTextContent("Theme border radius");
    expect(panelOf("General")).not.toHaveTextContent("Custom CSS");
    expect(panelOf("Advanced")).toHaveTextContent("Custom CSS");
    expect(panelOf("Glass")).toHaveTextContent("Tint the main actions");
  });

  it("opens the sub tab of the default style", async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => expect(tab("Style")).toBeInTheDocument());
    fireEvent.click(tab("Style"));

    expect(tab("Standard · default")).toHaveAttribute("aria-selected", "true");
    // the others stay open to the admin, users may pick them
    fireEvent.click(tab("Glass"));
    expect(tab("Glass")).toHaveAttribute("aria-selected", "true");
  });
});
