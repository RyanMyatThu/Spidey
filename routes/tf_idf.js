import express from "express";
import natural from "natural";

const Router = express.Router();
const stopWords = natural.stopwords;

Router.get("/calcIdf", (req, res) => {
    const prompt = req.query;
    prompt
    .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '')
    .split(" ")
    .filter((word) => word && !stopWords.includes(word))
    .map((word) => natural.PorterStemmer.stem(word))
    .join(" ")
})

module.exports = Router;