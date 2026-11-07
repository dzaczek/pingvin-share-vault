import useConfig from "./config.hook";
import useUser from "./user.hook";

// Where "go home" links (logo, buttons, ...) point, checked in this order:
// - /upload for someone signed in
// - / while the start page is on
// - /upload while it is off and anonymous shares are allowed
// - /auth/signIn otherwise
// It is the same answer the middleware gives for /, so a link does not have
// to go through the start page and its redirect first.
const useHomeHref = (): string => {
  const config = useConfig();
  const { user } = useUser();

  try {
    if (user) return "/upload";
    if (config.get("general.showHomePage")) return "/";
    if (config.get("security.allowUnauthenticatedShares")) return "/upload";
    return "/auth/signIn";
  } catch {
    return "/";
  }
};

export default useHomeHref;
