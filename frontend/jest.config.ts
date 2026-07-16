import type { Config } from "jest";
const config: Config = { testEnvironment:"jsdom", transform:{"^.+\\.(ts|tsx)$":["ts-jest",{tsconfig:"tsconfig.test.json"}]}, moduleNameMapper:{"^@/(.*)$":"<rootDir>/src/$1"} };
export default config;
