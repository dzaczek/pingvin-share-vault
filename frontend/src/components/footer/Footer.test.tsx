import { screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import polish from "../../i18n/translations/pl-PL";
import { renderWithProviders } from "../../test/renderWithProviders";
import Footer from "./Footer";

// "Powered by" used to be written into the component, so it stayed English
// whatever language the page was in.

const renderInPolish = (config: Record<string, string> = {}) =>
  renderWithProviders(
    <IntlProvider locale="pl-PL" messages={polish}>
      <Footer />
    </IntlProvider>,
    { config },
  );

describe("Footer", () => {
  it("translates the powered by line", () => {
    renderInPolish();
    expect(screen.getByText(/Działa na/)).toBeInTheDocument();
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument();
  });

  it("translates it next to the legal links too", () => {
    renderInPolish({ "legal.enabled": "true" });
    expect(screen.getByText(/Działa na/)).toBeInTheDocument();
  });

  it.each<Record<string, string>>([{}, { "legal.enabled": "true" }])(
    "links to this fork's repository %j",
    (config) => {
      renderInPolish(config);
      expect(
        screen.getByRole("link", { name: "Pingvin Share X" }),
      ).toHaveAttribute("href", "https://github.com/dzaczek/pingvin-share-x");
    },
  );
});
