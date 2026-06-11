/**
 * T-072 helper: verify SoFi + Amex reachability with production credentials.
 * Usage: PLAID_CLIENT_ID=... PLAID_SECRET=... npx tsx scripts/check-institutions.mts
 *   (pull production creds via: vercel env pull /tmp/prod.env --environment production)
 */
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid";

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV ?? "sandbox"],
  baseOptions: { headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID, "PLAID-SECRET": process.env.PLAID_SECRET } },
}));

async function check(id: string, label: string) {
  try {
    const r = await client.institutionsGetById({ institution_id: id, country_codes: [CountryCode.Us], options: { include_optional_metadata: true } });
    const i = r.data.institution;
    console.log(label, "->", JSON.stringify({ name: i.name, oauth: i.oauth, products: i.products }));
  } catch (e) {
    const d = (e as { response?: { data?: { error_code?: string; error_message?: string } } }).response?.data;
    console.log(label, "-> ERROR", d?.error_code, d?.error_message);
  }
}

async function search(q: string) {
  try {
    const r = await client.institutionsSearch({ query: q, country_codes: [CountryCode.Us], products: null });
    console.log("search:", q, "->", JSON.stringify(r.data.institutions.slice(0, 3).map((i) => ({ id: i.institution_id, name: i.name, oauth: i.oauth }))));
  } catch (e) {
    const d = (e as { response?: { data?: { error_code?: string; error_message?: string } } }).response?.data;
    console.log("search:", q, "-> ERROR", d?.error_code, d?.error_message);
  }
}

await check("ins_126339", "SoFi (ins_126339)");
await check("ins_10", "Amex (ins_10)");
await search("SoFi");
await search("American Express");
