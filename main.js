import axios from "axios";
import * as cheerio from "cheerio";
import canCrawl from "./utility/crawlCheck.js";
import sqlOperation from "./utility/sqlOperations.js";
import pLimit from "p-limit";
import natural from "natural";

const startURLs = [
"https://www.cnn.com",
"https://www.bbc.com",
"https://www.techcrunch.com",
"https://www.medium.com",
"https://www.wikihow.com",
"https://www.geeksforgeeks.org",
"https://www.wikipedia.org/wiki/Main_Page",
"https://www.goal.com/en",
"https://ww3.tinyzone.org/",
"https://aniwatchtv.to/"

]

const limit = 100000;
const visited = new Set();
const queue = [];
const maxDepth = 3; 
const limitConcurrency = pLimit(10);
const stemmer = natural.PorterStemmer();

const preProcessText = (textArray) => {
    textArray.map((text) => 
        text
            .toLowerCase() 
            .split(/\s+/) 
            .map(word => stemmer.stem(word)) 
            .join(" ") 
    )
}

async function crawl(url, depth){
    if(visited.size >= limit || depth >= maxDepth) return;
    if(visited.has(url)) return;
    if(!canCrawl(url)) return;

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


        $("a[href]").each((_, element) => {
            let link = $(element).attr('href');
            if (!link) return;
            let absLink = new URL(link, url).href;
            if (absLink.includes("#")) {
                return;
            }
            if (absLink.includes("Wikipedia:") || absLink.includes("community") || absLink.includes("user") || absLink.includes("post") || absLink.includes("users") || absLink.includes("Help:") || absLink.includes("Template:") || absLink.includes("User_Talk:") || absLink.includes("oldid=") || absLink.includes("/wiki/Talk:") || absLink.includes("/wiki/User:") || absLink.includes("/wiki/File:")) {
                return;
            }
            const matchedPortion = absLink.match(/\/([a-z]{2,})\./);
            if (!absLink.startsWith("http")) return;
           if(matchedPortion != null){
            if(matchedPortion[1] == "aniwatchtv" || matchedPortion[1] == "ww3" || matchedPortion[1] == "www" || matchedPortion[1] == "en"){
            if(!visited.has(absLink && !queue.some(item => item.url === absLink))) {
                queue.push({url : absLink, depth : depth + 1});
            }
        }
        }
        

        })
        console.log("Visited : " + url + "\n" + "Depth : " + depth + " Queue Size : " + queue.length)

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
        await Promise.all(crawlPromises);
    }
}

main();



