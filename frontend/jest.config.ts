import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// jose 6 ships only esm, so jest has to transform it like our own code.
export default async () => {
  const resolved = await createJestConfig(config)();
  resolved.transformIgnorePatterns = [
    "/node_modules/(?!jose/)",
    ...(resolved.transformIgnorePatterns ?? []).filter(
      (pattern: string) => !pattern.startsWith("/node_modules/"),
    ),
  ];
  return resolved;
};
