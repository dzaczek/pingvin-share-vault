import { SiDiscord, SiGithub, SiGoogle, SiOpenid } from "react-icons/si";
import { FaMicrosoft } from "react-icons/fa";
import React from "react";
import api from "../services/api.service";

// These send the user back to whichever allowed host the sign in started on.
// GitHub and Discord only accept the one callback URL on general.appUrl.
const ALTERNATIVE_HOST_PROVIDERS = ["oidc", "google", "microsoft"];

// On a host listed in oauth.allowedHosts the flow stays on that host. Anywhere
// else it runs on general.appUrl as before, because the state cookie has to be
// set on the host the provider sends the user back to.
const getOAuthUrl = (
  provider: string,
  get: (key: string, returnDefault?: boolean) => any,
  location: { host: string; origin: string } = window.location,
) => {
  const allowedHosts = String(get("oauth.allowedHosts") ?? "")
    .toLowerCase()
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  if (
    ALTERNATIVE_HOST_PROVIDERS.includes(provider) &&
    allowedHosts.includes(location.host.toLowerCase())
  ) {
    return `/api/oauth/auth/${provider}`;
  }

  const origin: string =
    get("general.appUrl") !== get("general.appUrl", true)
      ? get("general.appUrl")
      : location.origin;
  return `${origin}/api/oauth/auth/${provider}`;
};

const getOAuthIcon = (provider: string) => {
  return {
    google: <SiGoogle />,
    microsoft: <FaMicrosoft />,
    github: <SiGithub />,
    discord: <SiDiscord />,
    oidc: <SiOpenid />,
  }[provider];
};

const unlinkOAuth = (provider: string) => {
  return api.post(`/oauth/unlink/${provider}`);
};

export { getOAuthUrl, getOAuthIcon, unlinkOAuth };
