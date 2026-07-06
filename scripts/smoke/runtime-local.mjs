const baseUrl =
  process.env.UQ_SMOKE_BASE_URL ??
  process.env.SNIP_SMOKE_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  'http://localhost:3000';
const rootUrl = baseUrl.replace(/\/$/, '');

async function fetchPage(pathOrUrl) {
  const url = pathOrUrl.startsWith('http')
    ? `${rootUrl}${new URL(pathOrUrl).pathname}${new URL(pathOrUrl).search}`
    : `${rootUrl}${pathOrUrl}`;
  let response;

  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'accept-language': 'en-US,en;q=0.9',
      },
    });
  } catch (error) {
    throw new Error(`Failed to fetch ${url}. Is the local dev server running? ${error.message}`);
  }

  const body = await response.text();
  return { url, response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRoute(path, expectedText) {
  const { url, response, body } = await fetchPage(path);
  assert(response.ok, `${url} returned ${response.status}`);
  assert(body.includes(expectedText), `${url} did not include expected text: ${expectedText}`);
  return body;
}

function assertMetadata(path, body) {
  assert(body.includes('<title>'), `${path} is missing a title tag`);
  assert(
    /<meta name="description" content="[^"]{20,}"/.test(body),
    `${path} is missing a useful meta description`,
  );
}

const routeChecks = [
  ['/', 'Wooden gifts'],
  ['/catalog', 'Marketplace catalog'],
  ['/banners', 'Banners for stores'],
  ['/catalog/night-lights/personalized', 'Personalized night lights'],
  ['/cart', 'Shopping cart'],
  ['/credits', 'Buy'],
  ['/robots.txt', 'Disallow: /admin'],
  ['/sitemap.xml', '/catalog'],
];

for (const [path, expectedText] of routeChecks) {
  const body = await assertRoute(path, expectedText);
  if (!path.endsWith('.txt') && !path.endsWith('.xml')) assertMetadata(path, body);
}

for (const removedPath of [
  '/create',
  '/create/night-light',
  '/create/laser-cut-2d',
  '/api/generate',
  '/admin/banner-samples',
  '/admin/personalization-models',
  '/personalization',
  '/personalization/night-lights',
]) {
  const { response } = await fetchPage(removedPath);
  assert(response.status === 404, `${removedPath} should return 404, received ${response.status}`);
}

for (const locale of ['en', 'ru', 'am']) {
  for (const path of ['/', '/catalog']) {
    const localizedPath = `/${locale}${path === '/' ? '' : path}`;
    const body = await assertRoute(localizedPath, '<html');
    assertMetadata(localizedPath, body);
  }
}

const sitemap = await fetchPage('/sitemap.xml');
const sitemapUrls = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert(sitemapUrls.length > 0, 'Sitemap does not contain any URLs');

for (const url of sitemapUrls) {
  const { response, body } = await fetchPage(url);
  assert(response.ok, `Sitemap URL ${url} returned ${response.status}`);
  assert(body.includes('<title>'), `Sitemap URL ${url} is missing a title tag`);
}

console.log(
  `Runtime smoke passed: ${routeChecks.length} route checks and ${sitemapUrls.length} sitemap URLs at ${rootUrl}`,
);
