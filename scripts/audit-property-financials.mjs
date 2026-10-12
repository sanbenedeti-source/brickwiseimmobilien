import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3005";
const expected = new Map([
  ["sal-rei-boa-vista-b1-residences-ap1", [265366, 250, 26]],
  ["edmonton-windsor-park-8712-120-st", [1008000, 1000, 26.25]],
  ["toronto-midtown-condo", [735000, 250, 27]],
  ["vancouver-kitsilano-suite", [895000, 500, 27.5]],
  ["calgary-beltline-rental", [428000, 100, 28]],
  ["ottawa-centretown-duplex", [690000, 250, 27.25]],
  ["montreal-plateau-triplex", [815000, 500, 26.75]],
]);
const money = (value, digits = 2) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits,
}).format(value);
const percent = (value) => `${value.toFixed(2)}%`;
const close = (actual, wanted, label) => assert.ok(Math.abs(actual - wanted) < 1e-7, `${label}: ${actual} vs ${wanted}`);

async function get(route) {
  const response = await fetch(new URL(route, base), {
    headers: { cookie: "brickwise-locale=en; brickwise-locale-manual=1", "accept-language": "en" },
    signal: AbortSignal.timeout(45000),
  });
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  return response;
}
function visibleText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ");
}
const text = async (route) => visibleText(await (await get(route)).text());
const includes = (content, value, context) => assert.ok(content.includes(value), `${context}: missing ${value}`);
const noForeignMoney = (content, context) => assert.doesNotMatch(content, /\bCAD\b|C\$|\$\s*\d/, context);

const api = await (await get("/api/properties")).json();
assert.equal(api.properties.length, expected.size, "All visible listings must be audited");
const listing = await text("/properties?lang=en");
noForeignMoney(listing, "Property listing currency");
const rows = await Promise.all(api.properties.map(async (property) => {
  const [price, sharePrice, rate] = expected.get(property.slug);
  const label = property.slug;
  assert.equal(property.currency, "EUR", label);
  assert.equal(property.price, price, label);
  assert.equal(property.sharePrice, sharePrice, label);
  assert.equal(property.totalShares, Math.floor(price / sharePrice), `${label}: whole share supply`);
  assert.equal(property.availableShares + property.blockedShares, property.totalShares, label);
  close(property.fundedPercent, property.blockedShares / property.totalShares * 100, label);
  const model = property.financials;
  assert.equal(model.targetPeriod, "annual", label);
  assert.equal(model.annualRate, rate, label);
  close(model.annualPerShare, sharePrice * rate / 100, label);
  close(model.monthlyPerShare, model.annualPerShare / 12, label);
  close(model.propertyAnnual, price * rate / 100, label);
  close(model.propertyMonthly, model.propertyAnnual / 12, label);
  const breakdown = property.targetReturnBreakdown;
  close(breakdown.rental + breakdown.vacationPoint + breakdown.appreciation, rate, label);
  assert.deepEqual(breakdown, { rental: 19, vacationPoint: 2.5, appreciation: rate - 21.5 }, `${label}: target components`);
  const page = await text(`/properties/${label}?lang=en`);
  noForeignMoney(page, label);
  for (const value of [
    `Target annual return ${percent(rate)}`,
    property.rentalModel ? `Estimated net rent / month / share ${money((property.monthlyRent - property.monthlyExpenses) / property.totalShares)}` : `Modelled monthly return / share ${money(model.monthlyPerShare)}`,
    property.rentalModel ? `Estimated net rent / year / share ${money((property.monthlyRent - property.monthlyExpenses) * 12 / property.totalShares)}` : `Modelled annual return / share ${money(model.annualPerShare)}`,
    property.rentalModel ? `Property net rent / month ${money(property.monthlyRent - property.monthlyExpenses)}` : `Property monthly target ${money(model.propertyMonthly)}`,
    property.rentalModel ? `Property net rent / year ${money((property.monthlyRent - property.monthlyExpenses) * 12)}` : `Property annual target ${money(model.propertyAnnual)}`,
    `Available shares ${property.availableShares.toLocaleString("en-CA")}`,
    `Modelled annual return · ${percent(rate)} ${money(2000 * rate / 100)}`,
    property.rentalModel ? `Your estimated monthly net rent ${money((property.monthlyRent - property.monthlyExpenses) * 2000 / price)}` : `Modelled monthly return ${money(2000 * rate / 100 / 12)}`,
  ]) includes(page, value, label);
  includes(listing, `${money(model.monthlyPerShare)} Modelled monthly return / share`, label);
  includes(listing, `${money(model.annualPerShare)} Modelled annual return / share`, label);
  includes(listing, `${percent(rate)} Target annual return`, label);
  const contact = await text(`/contact?projekt=${label}&shares=${2000 / sharePrice}&lang=en`);
  noForeignMoney(contact, `${label}: contact`);
  includes(contact, `Modelled annual return: ${money(2000 * rate / 100)}`, `${label}: contact`);
  includes(contact, `Modelled monthly return: ${money(2000 * rate / 100 / 12)}`, `${label}: contact`);
  return { property: label, valueEUR: price, annualTarget: rate, monthlyPerShareEUR: Number(model.monthlyPerShare.toFixed(2)), annualFor2000EUR: Number((2000 * rate / 100).toFixed(2)), monthlyFor2000EUR: Number((2000 * rate / 100 / 12).toFixed(2)), availableShares: property.availableShares };
}));
const homepage = await text("/?lang=en");
noForeignMoney(homepage, "Homepage");
for (const property of api.properties.slice(1, 4)) {
  includes(homepage, `Available shares ${property.availableShares.toLocaleString("en-CA")}`, "Homepage supply");
  includes(homepage, percent(property.financials.annualRate), "Homepage annual target");
}
for (const route of ["/mortgage?lang=en", "/mortgage-calculator?lang=en", "/real-estate-investing?lang=en", "/investor-policy?lang=en"]) {
  noForeignMoney(await text(route), route);
}
console.table(rows);
console.log(`PASS: ${rows.length} EUR properties, detail/calculator/contact projections, share supply, homepage, listing, mortgage pages and explanatory pages.`);
