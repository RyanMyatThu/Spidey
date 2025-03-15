const robotsParser = require("robots-parser");
const axios = require("axios");


async function canCrawl(url){

    try{
        const domain = new URL(url).origin;
        const res = await axios.get(`${domain}/robots.txt`)
        const robots = robotsParser(`${domain}/robots.txt`, res.data)
        const isCrawlable = robots.isAllowed(url, '*')
        return isCrawlable;
    } catch (error){
        console.log("Error fetching or parsing robots.txt : " + error)
    }
    
}
module.exports = canCrawl 