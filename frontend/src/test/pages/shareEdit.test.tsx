import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../renderWithProviders";
import Share from "../../pages/share/[shareId]/index";
import shareService from "../../services/share.service";
import showShareInformationsModal from "../../components/share/showShareInformationsModal";

// The edit button shows for the owner and for admins. The share to edit was
// looked up among the signed in user's own shares, so for an admin looking at
// someone else's share, or an anonymous one, the button did nothing.

jest.mock("next/router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), query: {} }),
}));

jest.mock("../../services/share.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getMyShares: jest.fn(),
    list: jest.fn(),
  },
}));

// the edit action is an icon button, the icon is the one thing that tells it apart
jest.mock("react-icons/tb", () => ({
  ...jest.requireActual("react-icons/tb"),
  TbEdit: () => <span data-testid="edit-icon" />,
}));

jest.mock("../../components/share/showShareInformationsModal", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const service = shareService as jest.Mocked<typeof shareService>;

const share = (creator: { id: string } | null) =>
  ({
    id: "abc",
    name: "a share",
    creator,
    files: [],
    expiration: new Date(0),
    hasPassword: false,
  }) as any;

const clickEdit = async () => {
  const icon = await screen.findByTestId("edit-icon");
  fireEvent.click(icon.closest("button")!);
};

beforeEach(() => jest.clearAllMocks());

describe("editing a share from its page", () => {
  it("lets an admin edit an anonymous share", async () => {
    service.get.mockResolvedValue(share(null));
    service.list.mockResolvedValue([{ id: "abc" } as any]);

    renderWithProviders(<Share shareId="abc" />, {
      user: { id: "admin", isAdmin: true } as any,
    });
    await clickEdit();

    await waitFor(() => expect(showShareInformationsModal).toHaveBeenCalled());
    expect(service.list).toHaveBeenCalled();
    expect(service.getMyShares).not.toHaveBeenCalled();
  });

  it("looks among the owner's own shares for the owner", async () => {
    service.get.mockResolvedValue(share({ id: "owner" }));
    service.getMyShares.mockResolvedValue([{ id: "abc" } as any]);

    renderWithProviders(<Share shareId="abc" />, {
      user: { id: "owner", isAdmin: true } as any,
    });
    await clickEdit();

    await waitFor(() => expect(showShareInformationsModal).toHaveBeenCalled());
    expect(service.list).not.toHaveBeenCalled();
  });
});
