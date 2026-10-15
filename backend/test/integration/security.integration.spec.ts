import { randomBytes } from "crypto";
import {
  Jar,
  RUN_ID,
  api,
  createShareWithFile,
  deleteAccount,
  removeShare,
  signIn,
  signUp,
} from "./helpers/api";

// Access rules between users who should not be able to reach each other's
// data. Each case here was an actual hole at some point.

const ADMIN_EMAIL = process.env.INTEGRATION_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.INTEGRATION_ADMIN_PASSWORD;
const describeAdmin = ADMIN_EMAIL && ADMIN_PASSWORD ? describe : describe.skip;

// SMTP the instance can reach, needed to complete a share with recipients.
// The default is the mailpit container of the local test stack.
const SMTP_HOST = process.env.INTEGRATION_SMTP_HOST ?? "mailpit";
const SMTP_PORT = process.env.INTEGRATION_SMTP_PORT ?? "1025";

// Sets config values and hands back a function that puts the old ones back.
// The update endpoint wants real booleans and numbers, not strings.
async function withConfig(adminJar: Jar, values: Record<string, string>) {
  const typed = (type: string, value: string) =>
    type === "boolean" ? value === "true" : type === "number" ? Number(value) : value;

  const next: { key: string; value: unknown }[] = [];
  const previous: { key: string; value: unknown }[] = [];
  for (const [key, value] of Object.entries(values)) {
    const category = key.split(".")[0];
    const res = await api<any[]>(`/configs/admin/${category}`, {
      jar: adminJar,
    });
    const entry = res.data.find((c) => c.key === key);
    next.push({ key, value: typed(entry.type, value) });
    // an unset value comes back empty, which the endpoint refuses
    if (entry.value !== "") {
      previous.push({ key, value: typed(entry.type, entry.value) });
    }
  }

  const set = await api("/configs/admin", {
    method: "PATCH",
    jar: adminJar,
    body: next,
  });
  if (set.status !== 200) {
    throw new Error(`config update failed: ${set.status} ${set.body}`);
  }

  return async () => {
    await api("/configs/admin", {
      method: "PATCH",
      jar: adminJar,
      body: previous,
    });
  };
}

describe("files belong to their share", () => {
  let alice: Awaited<ReturnType<typeof signUp>>;
  let bob: Awaited<ReturnType<typeof signUp>>;
  const aliceShare = `${RUN_ID}-alice`;
  const bobShare = `${RUN_ID}-bob`;
  let aliceFile: string;

  beforeAll(async () => {
    alice = await signUp("alice");
    bob = await signUp("bob");
    ({ fileId: aliceFile } = await createShareWithFile(
      alice.jar,
      aliceShare,
      randomBytes(1024),
    ));
    await createShareWithFile(bob.jar, bobShare, randomBytes(1024));
  });

  afterAll(async () => {
    await removeShare(alice.jar, aliceShare);
    await removeShare(bob.jar, bobShare);
    await deleteAccount(alice.jar);
    await deleteAccount(bob.jar);
  });

  it("does not serve a file through another share", async () => {
    const res = await api(`/shares/${bobShare}/files/${aliceFile}`, {
      jar: bob.jar,
    });
    expect(res.status).toBe(404);
  });

  it("does not delete a file through another share", async () => {
    const res = await api(`/shares/${bobShare}/files/${aliceFile}`, {
      method: "DELETE",
      jar: bob.jar,
    });
    expect(res.status).toBe(404);

    const still = await api(`/shares/${aliceShare}/files/${aliceFile}`, {
      jar: alice.jar,
    });
    expect(still.status).toBe(200);
  });
});

describeAdmin("with an administrator", () => {
  let adminJar: Jar;

  beforeAll(async () => {
    const signedIn = await signIn(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    if (signedIn.res.status !== 200) {
      throw new Error(`could not sign the admin in: ${signedIn.res.status}`);
    }
    adminJar = signedIn.jar;
  });

  describe("received shares", () => {
    let owner: Awaited<ReturnType<typeof signUp>>;
    let recipient: Awaited<ReturnType<typeof signUp>>;
    let stranger: Awaited<ReturnType<typeof signUp>>;
    const shareId = `${RUN_ID}-received`;
    const restrictedId = `${RUN_ID}-restricted`;
    // a recipient address nobody has an account for yet
    const unclaimed = `${RUN_ID}-unclaimed@integration.invalid`;
    let restore: () => Promise<void>;

    beforeAll(async () => {
      // Recipients are only matched by a confirmed address. Accounts made
      // before verification was switched on count as confirmed, which is the
      // only way to get one here without following a mail link.
      owner = await signUp("sender");
      recipient = await signUp("receiver");
      stranger = await signUp("stranger");
      restore = await withConfig(adminJar, {
        "share.enableUserRecipients": "true",
        "share.enableShareEmailRecipients": "true",
        "security.enableEmailVerification": "true",
        "smtp.enabled": "true",
        "smtp.host": SMTP_HOST,
        "smtp.port": SMTP_PORT,
        "smtp.email": "noreply@integration.invalid",
      });
      await createShareWithFile(owner.jar, shareId, randomBytes(512), {
        recipients: [recipient.email],
        security: { password: "share password" },
      });
      // a password and the recipient restriction exclude each other
      await createShareWithFile(owner.jar, restrictedId, randomBytes(512), {
        recipients: [recipient.email, unclaimed],
        security: { restrictToRecipients: true },
      });
    });

    afterAll(async () => {
      await removeShare(owner.jar, shareId);
      await removeShare(owner.jar, restrictedId);
      await deleteAccount(owner.jar);
      await deleteAccount(recipient.jar);
      await deleteAccount(stranger.jar);
      await restore();
    });

    it("still asks the recipient for the share password", async () => {
      const res = await api(`/shares/${shareId}`, { jar: recipient.jar });
      expect(res.status).toBe(403);
      expect(res.body.toString("utf8")).toContain("share_password_required");
    });

    it("does not let anyone in by renaming their account to a recipient", async () => {
      const renamed = await api("/users/me", {
        method: "PATCH",
        jar: stranger.jar,
        body: { email: unclaimed },
      });
      expect(renamed.status).toBe(200);

      const res = await api(`/shares/${restrictedId}`, { jar: stranger.jar });
      expect(res.status).toBe(403);
      expect(res.body.toString("utf8")).toContain(
        "share_restricted_to_recipients",
      );
    });

    it("lists the share for the recipient", async () => {
      const res = await api<any[]>("/shares/received", { jar: recipient.jar });
      expect(res.status).toBe(200);
      const entry = res.data.find((r) => r.share.id === shareId);
      expect(entry.share.creator.username).toBe(owner.username);
    });

    it("does not hand out the sender's account or the share password", async () => {
      const res = await api("/shares/received", { jar: recipient.jar });
      const body = res.body.toString("utf8");
      expect(body).not.toContain("argon2");
      expect(body).not.toContain("totpSecret");
      expect(body).not.toContain("password");
      expect(body).not.toContain(owner.email);
    });
  });

  describe("anonymous shares once uploaded", () => {
    const shareId = `${RUN_ID}-anon`;
    let fileId: string;
    let restore: () => Promise<void>;
    const stranger: Jar = {};

    beforeAll(async () => {
      restore = await withConfig(adminJar, {
        "security.allowUnauthenticatedShares": "true",
      });
      ({ fileId } = await createShareWithFile({}, shareId, randomBytes(512)));
    });

    afterAll(async () => {
      await api(`/shares/${shareId}`, { method: "DELETE", jar: adminJar });
      await restore();
    });

    it("cannot be reopened by whoever has the link", async () => {
      const res = await api(`/shares/${shareId}/complete`, {
        method: "DELETE",
        jar: stranger,
      });
      expect(res.status).toBe(403);
    });

    it("keeps its files out of reach of whoever has the link", async () => {
      const res = await api(`/shares/${shareId}/files/${fileId}`, {
        method: "DELETE",
        jar: stranger,
      });
      expect(res.status).toBe(403);

      const still = await api(`/shares/${shareId}/files/${fileId}`);
      expect(still.status).toBe(200);
    });

    it("does not show the owner view to whoever has the link", async () => {
      const res = await api(`/shares/${shareId}/from-owner`, { jar: stranger });
      expect(res.status).toBe(403);
    });
  });

  describe("private reverse shares", () => {
    let creator: Awaited<ReturnType<typeof signUp>>;
    const shareId = `${RUN_ID}-reverse`;
    let fileId: string;

    beforeAll(async () => {
      creator = await signUp("collector");
      const reverse = await api("/reverseShares", {
        method: "POST",
        jar: creator.jar,
        body: {
          sendEmailNotification: false,
          maxShareSize: "1000000",
          shareExpiration: "1-days",
          maxUseCount: 1,
          simplified: false,
          publicAccess: false,
        },
      });
      if (reverse.status !== 201) {
        throw new Error(`reverse share failed: ${reverse.status} ${reverse.body}`);
      }
      const uploader: Jar = { reverse_share_token: reverse.data.token };
      ({ fileId } = await createShareWithFile(uploader, shareId, randomBytes(512)));
    });

    afterAll(async () => {
      await api(`/shares/${shareId}`, { method: "DELETE", jar: adminJar });
      await deleteAccount(creator.jar);
    });

    it("lets the reverse share creator download the file", async () => {
      const res = await api(`/shares/${shareId}/files/${fileId}`, {
        jar: creator.jar,
      });
      expect(res.status).toBe(200);
    });

    it("does not let a stranger download the file directly", async () => {
      const res = await api(`/shares/${shareId}/files/${fileId}`);
      expect(res.status).toBe(403);
    });
  });
});
