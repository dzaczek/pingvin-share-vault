import { EmailService } from "./email.service";

// Mail templates get {creator}, {name} and friends filled in. Part of what
// goes in is typed by users (a share description, a display name), so it
// must land in the mail as text and never be expanded as a template itself.

const settings: Record<string, unknown> = {
  "share.enableShareEmailRecipients": true,
  "general.appUrl": "https://share.example.com",
  "general.appName": "Share",
  "general.defaultLanguage": "en-US",
  "email.sendHtmlEmails": false,
  "email.shareRecipientsReplyToCreator": false,
  "email.shareRecipientsSubject": "Files from {creator}",
  "email.shareRecipientsMessage":
    "Hey {name}!\\n{creator} shared: {desc}\\n{shareUrl}",
  "smtp.email": "noreply@example.com",
};

const build = () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const service = new EmailService(
    { get: (key: string) => settings[key] } as any,
    { t: (key: string) => key, translate: () => "en" } as any,
  );
  jest.spyOn(service, "getTransporter").mockReturnValue({ sendMail } as any);
  return { service, sendMail };
};

const creator = {
  username: "jacek",
  displayName: "Jacek Załęski",
  email: "jacek@example.com",
} as any;

describe("share recipient mail", () => {
  it("fills in the display names", async () => {
    const { service, sendMail } = build();

    await service.sendMailToShareRecipients(
      "anna@example.com",
      "r1",
      "abc",
      creator,
      "Quarterly report",
      new Date(Date.now() + 86_400_000),
      "Anna Nowak",
    );

    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Files from Jacek Załęski");
    expect(mail.text).toBe(
      "Hey Anna Nowak!\nJacek Załęski shared: Quarterly report\nhttps://share.example.com/s/abc?recipient=r1",
    );
    expect(mail.to).toEqual({ name: "Anna Nowak", address: "anna@example.com" });
  });

  it("falls back to the username without a display name", async () => {
    const { service, sendMail } = build();

    await service.sendMailToShareRecipients(
      "anna@example.com",
      "r1",
      "abc",
      { ...creator, displayName: null },
      "x",
      new Date(Date.now() + 86_400_000),
    );

    expect(sendMail.mock.calls[0][0].subject).toBe("Files from jacek");
  });

  it("does not expand placeholders that come from the description", async () => {
    const { service, sendMail } = build();

    await service.sendMailToShareRecipients(
      "anna@example.com",
      "r1",
      "abc",
      creator,
      "see {shareUrl}, {creatorEmail} and {expires}",
      new Date(Date.now() + 86_400_000),
      "Anna Nowak",
    );

    expect(sendMail.mock.calls[0][0].text).toContain(
      "shared: see {shareUrl}, {creatorEmail} and {expires}",
    );
  });
});
