import { Readable } from "stream";
import { AdministratorGuard } from "../auth/guard/isAdmin.guard";
import { FileService } from "./file.service";

// An admin can ask for a file's sha256 so they can look it up on VirusTotal.
// Two things about that are worth holding still.
//
// The digest has to be the real one: a wrong hash does not fail loudly, it
// sends the admin to a VirusTotal page about some other file, or about
// nothing, and looks like an answer either way.
//
// And the route has to stay shut to everyone else. That is not obvious here,
// because JwtGuard in front of it lets an unauthenticated request through
// whenever allowUnauthenticatedShares is on, which this instance has on. The
// only thing standing between an anonymous caller and a loop of full file
// reads is the admin guard, so it is tested directly.

// computeSha256 reaches prisma, the local service and the cache, which are
// the first, second and seventh of eight constructor arguments
const construct = (prisma: unknown, local: unknown, cache: unknown) => {
  const unused = {} as any;
  return new FileService(
    prisma as any,
    local as any,
    unused,
    unused,
    unused,
    { t: (key: string) => key } as any,
    cache as any,
    unused,
  );
};

const memoryCache = () => {
  const store = new Map<string, unknown>();
  return {
    store,
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
};

const prismaReturningLocalShare = {
  share: { findFirst: async () => ({ storageProvider: "LOCAL" }) },
};

describe("computeSha256", () => {
  it("gives the real digest of what the file holds", async () => {
    const local = {
      get: async () => ({ file: Readable.from([Buffer.from("pingvin")]) }),
    };

    const service = construct(prismaReturningLocalShare, local, memoryCache());

    expect(await service.computeSha256("share", "file")).toBe(
      "fe78a1c2f3acfb10de4669a76f6b2e13c8abcf20b1a59e0ab4510f9d6788a798",
    );
  });

  it("hashes the whole file, not just the first chunk it was handed", async () => {
    const local = {
      get: async () => ({
        file: Readable.from([Buffer.from("ping"), Buffer.from("vin")]),
      }),
    };

    const service = construct(prismaReturningLocalShare, local, memoryCache());

    expect(await service.computeSha256("share", "file")).toBe(
      "fe78a1c2f3acfb10de4669a76f6b2e13c8abcf20b1a59e0ab4510f9d6788a798",
    );
  });

  // The reason the cache is here at all: a second look at the same file must
  // not put the disk through the whole thing again.
  it("does not read the file a second time once it knows the answer", async () => {
    let reads = 0;
    const local = {
      get: async () => {
        reads++;
        return { file: Readable.from([Buffer.from("pingvin")]) };
      },
    };

    const service = construct(prismaReturningLocalShare, local, memoryCache());

    await service.computeSha256("share", "file");
    await service.computeSha256("share", "file");

    expect(reads).toBe(1);
  });

  it("keeps two files apart rather than answering for whichever came first", async () => {
    const contents: Record<string, string> = {
      one: "pingvin",
      two: "share",
    };
    const local = {
      get: async (_shareId: string, fileId: string) => ({
        file: Readable.from([Buffer.from(contents[fileId])]),
      }),
    };

    const service = construct(prismaReturningLocalShare, local, memoryCache());

    const first = await service.computeSha256("share", "one");
    const second = await service.computeSha256("share", "two");

    expect(first).not.toBe(second);
  });

  it("says the file is not there rather than hashing nothing", async () => {
    const local = { get: async () => ({ file: undefined }) };

    const service = construct(prismaReturningLocalShare, local, memoryCache());

    await expect(service.computeSha256("share", "file")).rejects.toThrow();
  });
});

describe("the guard in front of it", () => {
  const canActivate = (user: unknown) =>
    new AdministratorGuard().canActivate({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any);

  it("lets an admin through", () => {
    expect(canActivate({ isAdmin: true })).toBe(true);
  });

  it("turns a signed in user who is not an admin away", () => {
    expect(canActivate({ isAdmin: false })).toBe(false);
  });

  // JwtGuard in front of this hands the request on with no user attached when
  // unauthenticated shares are allowed, so this is the case that keeps the
  // route from being open to anyone with the link.
  it("turns away a request that arrived with nobody attached to it", () => {
    expect(canActivate(undefined)).toBe(false);
  });
});
