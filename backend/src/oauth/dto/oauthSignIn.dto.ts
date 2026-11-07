export interface OAuthSignInDto {
  provider: "github" | "google" | "microsoft" | "discord" | "oidc";
  providerId: string;
  providerUsername: string;
  email: string;
  // the provider says the address belongs to this user, so it counts as
  // confirmed for share recipients without a verification mail
  emailVerified?: boolean;
  isAdmin?: boolean;
  idToken?: string;
}
