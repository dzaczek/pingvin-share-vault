import { useModals } from "@mantine/modals";
import { screen } from "@testing-library/react";
import { useEffect } from "react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import showCreateReverseShareModal from "./showCreateReverseShareModal";

// The modal remembers the last choice for simple mode and public access in
// cookies. A cookie holds the text "false", which read as true, and simple
// mode was never taken from the cookie at all.

const Open = () => {
  const modals = useModals();
  useEffect(() => {
    showCreateReverseShareModal(
      modals,
      false,
      { value: 0, unit: "days" },
      { value: 7, unit: "days" },
      false,
      "http://localhost:3000",
      "http://localhost:3000",
      1_000_000,
      () => undefined,
    );
  }, []);
  return null;
};

const switchFor = (label: string) =>
  screen.findByRole("checkbox", { name: new RegExp(label) });

const setCookies = (cookies: Record<string, string>) => {
  for (const [name, value] of Object.entries(cookies)) {
    document.cookie = `${name}=${value}; path=/`;
  }
};

afterEach(() => {
  for (const name of [
    "reverse-share.simplified",
    "reverse-share.public-access",
  ])
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

describe("create reverse share modal", () => {
  it("takes the remembered choices from the cookies", async () => {
    setCookies({
      "reverse-share.simplified": "true",
      "reverse-share.public-access": "false",
    });
    renderWithProviders(<Open />);

    expect(await switchFor("Simple mode")).toBeChecked();
    expect(await switchFor("Public access")).not.toBeChecked();
  });

  it("starts with public access on and simple mode off", async () => {
    renderWithProviders(<Open />);

    expect(await switchFor("Simple mode")).not.toBeChecked();
    expect(await switchFor("Public access")).toBeChecked();
  });
});
