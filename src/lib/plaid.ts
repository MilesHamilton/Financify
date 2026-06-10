import "server-only";

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const VALID_ENVS = ["sandbox", "production"] as const;
type PlaidEnv = (typeof VALID_ENVS)[number];

const rawEnv = process.env.PLAID_ENV ?? "sandbox";

if (!(VALID_ENVS as readonly string[]).includes(rawEnv)) {
  throw new Error(
    `Invalid PLAID_ENV "${rawEnv}". Must be one of: ${VALID_ENVS.join(", ")}.`,
  );
}

export const plaidEnv = rawEnv as PlaidEnv;

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

export const plaidClient: PlaidApi = new PlaidApi(configuration);
