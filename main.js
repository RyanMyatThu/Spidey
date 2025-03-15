import axios from "axios";
import * as cheerio from "cheerio";
import canCrawl from "./utility/crawlCheck.js";
import sqlOperation from "./utility/sqlOperations.js";
import pLimit from "p-limit";
import natural from "natural";
import { Lock, updateDomainCount } from "./utility/threadSafety.js";
import {
  getDomain,
  preProcessText,
  shouldSkipLink,
  crawlWithDelay,
} from "./utility/helpers.js";

const startURLs = ["https://aniwatchtv.to"];

const domains = [
  "musicbrainz.org",
  "www.ebay.com",
  "www.spotify.com",
  "www.cnn.com",
  "www.bbc.com",
  "www.techcrunch.com",
  "www.medium.com",
  "www.wikihow.com",
  "www.geeksforgeeks.org",
  "www.goal.com",
  "ww3.tinyzone.org",
  "aniwatchtv.to",
  "en.wikipedia.org",
  "www.wikipedia.org",
  "www.medicalnewstoday.com",
  "www.ign.com",
];

const allowedURLS = ["ww3", "www", "en", "aniwatchtv", "musicbrainz"];

const limit = 2000;
const domainCount = new Map();
const maxLinksPerDomain = 2000;
const visited = new Set();
const queue = [];
const maxDepth = 3;
const limitConcurrency = pLimit(10);
const lock = new Lock();

async function crawl(url, depth) {
  if (visited.size >= limit || depth > maxDepth) return;
  if (visited.has(url)) return;
  if (!canCrawl(url)) return;

  const domain = getDomain(url);
  if (!domain) return;

  const currentDomainCount = domainCount.get(domain) || 0;
  if (currentDomainCount >= maxLinksPerDomain) {
    console.log("Max count reached for " + domain);
    return;
  }

  visited.add(url);
  if (shouldSkipLink(url)) {
    return;
  }
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const title = $("title").text();
    const paragraphs = preProcessText(
      $("p")
        .map((_, elm) => $(elm).text())
        .get(),
    );
    const lists = preProcessText(
      $("ul li, ol li")
        .map((_, elm) => $(elm).text())
        .get(),
    );
    const tableData = preProcessText(
      $("td")
        .map((_, cell) => $(cell).text())
        .get(),
    );
    const articles = preProcessText(
      $("article")
        .map((_, el) => $(el).text())
        .get(),
    );
    const mainContents = preProcessText(
      $("main")
        .map((_, el) => $(el).text())
        .get(),
    );

    const metadata = {
      description:
        $('meta[name="description"]').attr("content") ||
        "No description available",
      keywords:
        $('meta[name="keywords"]').attr("content") || "No keywords available",
    };

    await sqlOperation.insertCrawledData(
      url,
      paragraphs,
      lists,
      tableData,
      articles,
      mainContents,
      title,
      JSON.stringify(metadata),
    );
    await updateDomainCount(lock, domain, domainCount);
    console.log(
      "Queue size: " +
        queue.length +
        " | Depth :" +
        depth +
        " | Visited :" +
        visited.size +
        " | URL :" +
        url,
    );
    $("a[href]").each((_, element) => {
      let link = $(element).attr("href");
      if (!link) return;
      let absLink = new URL(link, url).href;

      if (shouldSkipLink(absLink)) return;

      const matchedPortion = absLink.match(/\/([a-z-3]{2,})\./);
      if (!absLink.startsWith("http")) return;
      if (matchedPortion != null) {
        if (allowedURLS.includes(matchedPortion[1])) {
          if (
            !visited.has(absLink && !queue.some((item) => item.url === absLink))
          ) {
            const linkDomain = getDomain(absLink);
            const currentLinkCount = domainCount.get(linkDomain) || 0;
            if (
              currentLinkCount < maxLinksPerDomain &&
              domains.includes(linkDomain)
            ) {
              queue.push({ url: absLink, depth: depth + 1 });
            }
          }
        }
      }
    });
  } catch (error) {
    console.log("Connection Blocked \n" + error);
  }
}

async function main() {
  await sqlOperation.startConnection();
  startURLs.forEach((url) => queue.push({ url, depth: 0 }));
  while (queue.length > 0 && visited.size < limit) {
    let currentBatch = queue.splice(0, 10);
    const crawlPromises = currentBatch.map(({ url, depth }) =>
      limitConcurrency(() => crawlWithDelay(url, crawl, depth)),
    );
    await Promise.allSettled(crawlPromises);
  }
  console.log("All done" + queue.size);
}

main();
