import english from "./en-US";
import polish from "./pl-PL";

// Polish is what this instance runs in. A placeholder lost in translation
// shows up as a raw {maxSize} or an empty gap in the page, and Crowdin
// updates arrive without anyone reading them line by line.

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Polish translation", () => {
  it("keeps every placeholder of the English text", () => {
    const broken = Object.keys(polish).filter(
      (key) =>
        key in english &&
        placeholders(polish[key as keyof typeof polish]).join() !==
          placeholders(english[key as keyof typeof english]).join(),
    );
    expect(broken).toEqual([]);
  });

  it("has no key the English file no longer knows", () => {
    const stale = Object.keys(polish).filter((key) => !(key in english));
    expect(stale).toEqual([]);
  });
});
