import { fireEvent, screen } from "@testing-library/react";
import { UiStyleContext } from "../../hooks/uiStyle.hook";
import { renderWithProviders } from "../../test/renderWithProviders";
import ThemeSwitcher from "./ThemeSwitcher";

// the segmented control measures itself, which jsdom cannot do
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Each user picks their own style next to the color scheme, whatever the
// admin set as the default.

describe("ThemeSwitcher style choice", () => {
  it("passes the picked style on", () => {
    const setPreference = jest.fn();
    renderWithProviders(
      <UiStyleContext.Provider
        value={{
          name: "standard",
          glass: null,
          preference: "default",
          setPreference,
        }}
      >
        <ThemeSwitcher />
      </UiStyleContext.Provider>,
    );

    fireEvent.click(screen.getByText("Glass"));
    expect(setPreference).toHaveBeenCalledWith("glass");
  });

  it("offers the instance default and every style", () => {
    renderWithProviders(<ThemeSwitcher />);
    for (const label of ["Instance default", "Standard", "Glass", "Precision"])
      expect(screen.getByText(label)).toBeInTheDocument();
  });
});
