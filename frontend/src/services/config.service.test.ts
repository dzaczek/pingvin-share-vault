import axios from "axios";
import configService from "./config.service";

jest.mock("axios");
// the whole of axios is mocked, so axios.create has nothing to give the api
// client and its interceptor setup would fail on import
jest.mock("./api.service", () => ({ __esModule: true, default: {} }));

// The admin page offers an update when this repository has a newer release.
// Versions are calendar based (year.month.n), the original project still
// counts 2.x, so its tags must never look newer than ours.

const latestRelease = (tag: string) =>
  (axios.get as jest.Mock).mockResolvedValue({ data: { tag_name: tag } });

beforeEach(() => {
  (axios.get as jest.Mock).mockReset();
  process.env.VERSION = "2026.10.0";
});

describe("isNewReleaseAvailable", () => {
  it("asks this fork, not the original project", async () => {
    latestRelease("v2026.10.0");
    await configService.isNewReleaseAvailable();
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.github.com/repos/dzaczek/pingvin-share-x/releases/latest",
    );
  });

  it("offers a newer release", async () => {
    latestRelease("v2026.10.1");
    expect(await configService.isNewReleaseAvailable()).toBe(true);
  });

  it("offers a release from a later month", async () => {
    latestRelease("v2026.11.0");
    expect(await configService.isNewReleaseAvailable()).toBe(true);
  });

  it("stays quiet on the running release", async () => {
    latestRelease("v2026.10.0");
    expect(await configService.isNewReleaseAvailable()).toBe(false);
  });

  it("stays quiet on an old style 2.x tag", async () => {
    latestRelease("v2.0.0");
    expect(await configService.isNewReleaseAvailable()).toBe(false);
  });

  it("stays quiet on a tag that is not a version", async () => {
    latestRelease("nightly");
    expect(await configService.isNewReleaseAvailable()).toBe(false);
  });
});
