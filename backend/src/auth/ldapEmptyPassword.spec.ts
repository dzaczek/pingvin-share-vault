import { LdapService } from "./ldap.service";

// An empty password used to reach the user bind. Many directories treat a DN
// with an empty password as an unauthenticated bind and answer with success,
// which signed the user in without a password.

const search = jest.fn(async () => ({
  searchEntries: [{ dn: "uid=alice,dc=test" }],
}));
const bind = jest.fn(async () => undefined);

jest.mock("ldapts", () => {
  const actual = jest.requireActual("ldapts");
  return {
    ...actual,
    Client: jest.fn().mockImplementation(() => ({
      search,
      bind,
      unbind: jest.fn(async () => undefined),
    })),
  };
});

const config = {
  get: (key: string) =>
    ({
      "ldap.url": "ldap://127.0.0.1:1",
      "ldap.bindDn": "",
      "ldap.bindPassword": "",
      "ldap.searchBase": "dc=test",
      "ldap.searchQuery": "(uid=%username%)",
    })[key],
} as any;

describe("LDAP sign in", () => {
  beforeEach(() => {
    search.mockClear();
    bind.mockClear();
  });

  it("refuses an empty password without binding, even if the directory would accept it", async () => {
    const result = await new LdapService(config).authenticateUser("alice", "");

    expect(result).toBeNull();
    expect(bind).not.toHaveBeenCalled();
  });

  it("still binds as the user when a password is given", async () => {
    const result = await new LdapService(config).authenticateUser(
      "alice",
      "secret",
    );

    expect(bind).toHaveBeenCalledWith("uid=alice,dc=test", "secret");
    expect(result).toMatchObject({ dn: "uid=alice,dc=test" });
  });
});
