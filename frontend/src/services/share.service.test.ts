import shareService from "./share.service";

jest.mock("./api.service", () => ({ __esModule: true, default: {} }));

// Download all in the files mode fetches each file on its own. Pointing the
// window at one file after the other would cancel all but the last, so each
// gets its own hidden iframe, one after the other.

const frames = () =>
  [...document.querySelectorAll("iframe")].map((f) => f.getAttribute("src"));

beforeEach(() => jest.useFakeTimers());

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

describe("downloadFiles", () => {
  it("downloads every file through its own hidden frame, spaced out", () => {
    shareService.downloadFiles("share-id", ["one", "two"]);

    jest.advanceTimersByTime(0);
    expect(frames()).toEqual([
      "http://localhost/api/shares/share-id/files/one?download=true",
    ]);

    jest.advanceTimersByTime(1000);
    expect(frames()).toEqual([
      "http://localhost/api/shares/share-id/files/one?download=true",
      "http://localhost/api/shares/share-id/files/two?download=true",
    ]);
    expect(
      [...document.querySelectorAll("iframe")].every(
        (f) => f.style.display === "none",
      ),
    ).toBe(true);
  });

  it("passes the recipient along", () => {
    shareService.downloadFiles("share-id", ["one"], "r 1");
    jest.advanceTimersByTime(0);
    expect(frames()).toEqual([
      "http://localhost/api/shares/share-id/files/one?download=true&recipient=r%201",
    ]);
  });

  it("removes the frames once the downloads had time to start", () => {
    shareService.downloadFiles("share-id", ["one"]);
    jest.advanceTimersByTime(61_000);
    expect(frames()).toEqual([]);
  });
});
