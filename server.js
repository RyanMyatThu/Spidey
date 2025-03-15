import express from "express";
import sqlOperations from "./utility/sqlOperations.js";
import searchRouter from "./routes/search.js";

const app = express();

app.use(express.json()); // Keep for potential JSON requests

let totalDocuments = null;
let termCache = null;

async function initialize() {
  try {
    await sqlOperations.startConnection();
    totalDocuments = await sqlOperations.getTotalDocumentCount();
    const terms = await sqlOperations.getUniqueTerms();
    termCache = {};
    terms.forEach((term) => {
      termCache[term.term] = {
        termId: term.termId,
        documentFrequency: term.documentFrequency,
      };
    });
    console.log(`Cached ${Object.keys(termCache).length} terms`);
    console.log(
      `Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    );
  } catch (error) {
    console.error("Initialization failed:", error);
    process.exit(1);
  }
}

// Minimal root route to confirm server is running
app.get("/", (req, res) => {
  res.json({
    message: "Search server is running. Use /search?q=query to search.",
  });
});

initialize().then(() => {
  app.use("/search", searchRouter({ totalDocuments, termCache }));
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
});
