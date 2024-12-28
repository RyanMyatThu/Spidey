const axios = require("axios");
const cheerio = require("cheerio");
const canCrawl = require("./crawlCheck");

const startURLs = [
"https://www.wikipedia.org",
"https://www.cnn.com",
"https://www.bbc.com",
"https://www.techcrunch.com",
"https://www.medium.com",
]

const limit = 200;
const visited = new Set();
const queue = [];


async function crawl(url){
    if(visited.size >= limit) return;
    if(visited.has(url)) return;
    if(!canCrawl(url)) return;

    visited.add(url)
    try{
        
        const res = await axios.get(url, {timeout : 1000});
        const $ = cheerio.load(res.data);

        $("a[href]").each((_, element) => {
            let link = $(element).attr('href');
            if (!link) return;
            let absLink = new URL(link, url).href;
            if (!absLink.startsWith("http")) return;
            if(!visited.has(absLink)) {
                queue.push(absLink);
            }

        })
        console.log("Visited : " + url + "\n")

    } catch (error){
        console.log("Connection blocked\n")
    }
}

async function main(){
    queue.push(...startURLs);
    while(queue.length  > 0 && visited.size < limit){
        let current = queue.shift();
        await crawl(current)
    }
}

main();