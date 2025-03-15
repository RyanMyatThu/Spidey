import express from "express";
import { preProcessText, removePunctuation } from "../utility/helpers.js";
import sqlOperations from "../utility/sqlOperations.js";
import { getDocumentLength } from "../utility/helpers.js";
const router = (options) => {
  const { totalDocuments, termCache } = options || {};
  const searchRouter = express.Router();

  const AVG_DOC_LENGTH = 331;
  const K1 = 1.2;
  const B = 0.75;
  const TITLE_BOOST = 0.3;
  const DESC_BOOST = 0.2;
  const KEYWORD_BOOST = 0.25;
  const PHRASE_BOOST = 0.1;

  searchRouter.get("/", async (req, res) => {
    const startTime = performance.now();
    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    try {
      const results = await search(query);
      const latency = performance.now() - startTime;
      console.log(`Query "${query}" processed in ${latency.toFixed(2)}ms`);
      res.json({ results, latency: latency.toFixed(2) });
    } catch (error) {
      console.error("Search error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  async function search(query) {
    const queryArr = removePunctuation(query).split(" ");
    const processedQuery = preProcessText(queryArr);
    const allTerms = [...new Set([...queryArr, ...processedQuery])];
    const queryVector = await buildQueryVector(allTerms);
    const similarities = await calculateSimilarity(queryVector, queryArr);
    const ranked = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((result) => ({
        documentId: result.documentId,
        url: result.url,
        title: result.title || "Untitled",
        similarity: result.score.toFixed(4),
      }));
    console.log("Top 10 results:", ranked);
    return ranked;
  }

  async function buildQueryVector(processedQuery) {
    const termsInQuery = processedQuery.filter((term) => term);
    const termCounts = {};
    termsInQuery.forEach(
      (term) => (termCounts[term] = (termCounts[term] || 0) + 1),
    );
    const queryVector = {};
    for (const term of Object.keys(termCounts)) {
      const termData = termCache[term];
      if (termData) {
        const tf = termCounts[term];
        const idf = Math.log10(
          (totalDocuments + 1) / (termData.documentFrequency + 1),
        );
        queryVector[termData.termId] = { tf, idf };
      }
    }
    return queryVector;
  }

  async function calculateSimilarity(queryVector, originalQuery) {
    const termIds = Object.keys(queryVector).map(Number);
    const tfidfRecords = await sqlOperations.tf_idf_table.findAll({
      where: { termId: termIds },
      attributes: ["termId", "documentId", "tfidf"],
      limit: 10000,
    });

    const docScores = {};
    const docTermMatches = {};
    tfidfRecords.forEach((record) => {
      const { termId, documentId, tfidf } = record;
      docScores[documentId] = docScores[documentId] || { bm25: 0 };
      docTermMatches[documentId] = docTermMatches[documentId] || new Set();
      if (queryVector[termId]) {
        const queryTf = queryVector[termId].tf;
        const idf = queryVector[termId].idf;
        const docTf = tfidf / idf;
        const docLength = 331;
        const bm25 =
          idf *
          ((docTf * (K1 + 1)) /
            (docTf + K1 * (1 - B + B * (docLength / AVG_DOC_LENGTH))));
        docScores[documentId].bm25 += bm25;
        docTermMatches[documentId].add(termId);
      }
    });

    const documentIds = Object.keys(docScores);
    const documents = await sqlOperations.crawled_content.findAll({
      where: { id: documentIds },
      attributes: ["id", "url", "title", "metadata"],
    });

    const queryTermCount = termIds.length;
    const queryStr = originalQuery.join(" ").toLowerCase();
    return documents.map((doc) => {
      const docId = doc.id;
      const bm25Score = docScores[docId]?.bm25 || 0;

      let description = "";
      let keywords = "";
      try {
        const metaObj = JSON.parse(doc.metadata);
        description = (metaObj.description || "").toLowerCase();
        keywords = (metaObj.keywords || "").toLowerCase();
      } catch (e) {
        console.error(`Failed to parse metadata for doc ${docId}:`, e);
      }

      const title = (doc.title || "").toLowerCase();
      const titleMatches = originalQuery.filter((term) =>
        title.includes(term.toLowerCase()),
      ).length;
      const descMatches = originalQuery.filter((term) =>
        description.includes(term.toLowerCase()),
      ).length;
      const keyMatches = originalQuery.filter((term) =>
        keywords.includes(term.toLowerCase()),
      ).length;

      const titleBoost = (titleMatches / queryTermCount) * TITLE_BOOST;
      const descBoost = (descMatches / queryTermCount) * DESC_BOOST;
      const keyBoost =
        keywords !== "no keywords available"
          ? (keyMatches / queryTermCount) * KEYWORD_BOOST
          : 0;
      const phraseBoost =
        title.includes(queryStr) ||
        description.includes(queryStr) ||
        keywords.includes(queryStr)
          ? PHRASE_BOOST
          : 0;

      const score =
        bm25Score * (1 + titleBoost + descBoost + keyBoost + phraseBoost);
      return { documentId: docId, title: doc.title, url: doc.url, score };
    });
  }

  return searchRouter;
};

export default router;
