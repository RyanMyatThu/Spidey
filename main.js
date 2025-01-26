import axios from "axios";
import * as cheerio from "cheerio";
import canCrawl from "./utility/crawlCheck.js";
import sqlOperation from "./utility/sqlOperations.js";
import pLimit from "p-limit";
import natural from "natural";
import {Lock, updateDomainCount} from "./utility/threadSafety.js";

const startURLs = [
"https://www.ebay.com"

]

const domains = [
   "www.ebay.com",
    "www.amazon.com",
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
    "www.ign.com"
]



const limit = 100000;
const domainCount = new Map();
const maxLinksPerDomain = 2000;
const visited = new Set();
const queue = [];
const maxDepth = 3; 
const limitConcurrency = pLimit(10);
const stopWords = natural.stopwords;
const lock = new Lock();


const preProcessText = (textArray) => {
   const res = textArray.map((text) => 
            text
            .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '')
            .toLowerCase() 
            .split(/\s+/) 
            .filter(word => word && !stopWords.includes(word))
            .map(word => natural.PorterStemmer.stem(word)) 
            .join(" ") 
    )
    return res;
}

const getDomain = (url) => {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

async function crawl(url, depth){
    if(visited.size >= limit || depth >= maxDepth) return;
    if(visited.has(url)) return;
    if(!canCrawl(url)) return;
    
    const domain = getDomain(url);
    if (!domain) return;

    console.log(domain)
    const currentDomainCount = domainCount.get(domain) || 0;
    if(currentDomainCount >= maxLinksPerDomain) {
        console.log("Max count reached for " + domain )
        return;
    };
    console.log(domain + " count : " + currentDomainCount)


    
    visited.add(url)
    if (url.includes("oldid=") || url.includes("/wiki/Talk:") || url.includes("/wiki/User:") || url.includes("/wiki/File:")) {
        return;
    }
    try{
        
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const title = $("title").text();
        const paragraphs =  preProcessText($("p").map((_, elm) => $(elm).text()).get());
        const lists = preProcessText($('ul li, ol li').map((_, elm) => $(elm).text()).get());
        const tableData = preProcessText($('td').map((_, cell) => $(cell).text()).get());
        const articles = preProcessText($('article').map((_, el) => $(el).text()).get());
        const mainContents = preProcessText($('main').map((_, el) => $(el).text()).get());

        const metadata = {
            description: $('meta[name="description"]').attr('content') || 'No description available',
            keywords: $('meta[name="keywords"]').attr('content') || 'No keywords available',
        };

       
        await sqlOperation.insertCrawledData(url, paragraphs, lists, tableData, articles, mainContents, title, JSON.stringify(metadata))
        await updateDomainCount(lock, domain, domainCount);
        
        $("a[href]").each((_, element) => {
            let link = $(element).attr('href');
            if (!link) return;
            let absLink = new URL(link, url).href;

            if (absLink.includes("#")) {
                return;
            }
            if (absLink.includes("tinyzone.org/country/") ||  absLink.includes("Special:") || absLink.includes("Portal:") || absLink.includes("www.geeksforgeeks.org/quizzes") || absLink.includes("www.geeksforgeeks.org/puzzles") || absLink.includes("Wikipedia:") || absLink.includes("community") || absLink.includes("user") || absLink.includes("post") || absLink.includes("users") || absLink.includes("Help:") || absLink.includes("Template:") || absLink.includes("User_talk:") || absLink.includes("oldid=") || absLink.includes("/wiki/Talk:") || absLink.includes("/wiki/User:") || absLink.includes("/wiki/File:")) {
                return;
            }
            const matchedPortion = absLink.match(/\/([a-z-3]{2,})\./);
            if (!absLink.startsWith("http")) return;
           if(matchedPortion != null){
            
            if(matchedPortion[1] == "aniwatchtv" || matchedPortion[1] == "ww3" || matchedPortion[1] == "www" || matchedPortion[1] == "en"){
                
            if(!visited.has(absLink && !queue.some(item => item.url === absLink))) {
                const linkDomain = getDomain(absLink);
                const currentLinkCount = domainCount.get(linkDomain) || 0;
                if(currentLinkCount < maxLinksPerDomain && domains.includes(linkDomain)){
                queue.push({url : absLink, depth : depth + 1});
                }
            }
        }
        }
        })

    } catch (error){
        console.log("Connection Blocked \n" + error)
    }
}

async function main(){
    await sqlOperation.startConnection();
    startURLs.forEach((url) => queue.push({ url, depth: 0 }));
    while(queue.length  > 0 && visited.size < limit){      
        let currentBatch = queue.splice(0, 10);      
        const crawlPromises = currentBatch.map(( {url, depth} ) => limitConcurrency(() => crawl(url, depth)))
        await Promise.allSettled(crawlPromises);
    }
}

main();



