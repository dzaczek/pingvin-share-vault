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
          glassPreferences: {},
          setGlassPreference: jest.fn(),
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

describe("ThemeSwitcher glass options", () => {
  const renderWith = (name: string, glassPreferences = {}) => {
    const setGlassPreference = jest.fn();
    renderWithProviders(
      <UiStyleContext.Provider
        value={{
          name,
          glass: null,
          preference: name,
          setPreference: jest.fn(),
          glassPreferences,
          setGlassPreference,
        }}
      >
        <ThemeSwitcher />
      </UiStyleContext.Provider>,
    );
    return setGlassPreference;
  };

  it("shows them only while glass is the look", () => {
    renderWith("standard");
    expect(screen.queryByText("Glass variant")).not.toBeInTheDocument();
  });

  it("passes the picked option on", () => {
    const setGlassPreference = renderWith("glass");
    fireEvent.click(screen.getByText("Clear"));
    expect(setGlassPreference).toHaveBeenCalledWith("glassVariant", "clear");
  });

  it("offers built in wallpapers only, with nothing to upload", () => {
    renderWith("glass", {
      glassBackground: "image",
      glassWallpaper: "/wallpapers/dunes.svg",
    });
    expect(screen.getByText("Dunes (built in)")).toBeInTheDocument();
    expect(screen.queryByText("Upload an image")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("https://")).not.toBeInTheDocument();
  });
});
