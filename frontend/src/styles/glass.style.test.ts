import { joinComponents } from "./glass.style";

// The standard theme already styles the modal title, and the glass theme
// styles the modal itself. Neither should lose its part.

describe("joinComponents", () => {
  it("keeps the parts both sets style", () => {
    const joined = joinComponents(
      { Modal: { styles: () => ({ title: { fontWeight: 700 } }) } },
      { Modal: { styles: { content: { borderRadius: 24 } } } },
    );
    const styles = (joined.Modal.styles as any)({}, {}, {});
    expect(styles).toEqual({
      title: { fontWeight: 700 },
      content: { borderRadius: 24 },
    });
  });

  it("leaves a component styled by one set alone", () => {
    const button = { styles: { root: { borderRadius: 999 } } };
    expect(joinComponents({}, { Button: button }).Button).toBe(button);
  });
});
