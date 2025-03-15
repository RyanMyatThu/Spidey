import sqlOperations from "../utility/sqlOperations.js";
import pLimit from "p-limit";
import { saveState, loadState } from "../utility/helpers.js";
// import { Lock } from "../utility/threadSafety.js";

const limitConcurrency = pLimit(500);
const saveFile = "./SavedStates/tf_idfState.json";
const corpusLength = 21634;

let shutDownRequested = false;
let terms = [];

async function calculate() {
  await sqlOperations.startConnectionTermTable();
  await sqlOperations.startConnectionTermDocumentMappingTable();
  await sqlOperations.startConnectionTfIdfTable();
  const allData = await sqlOperations.getUniqueTerms();
  let state = await loadState(saveFile, true);
  if (state.terms.length === 0) {
    allData.forEach((termSet) => {
      terms.push({
        termId: termSet.termId,
        term: termSet.term,
        documentFrequency: termSet.documentFrequency,
      });
    });
  } else {
    terms = state.terms;
  }
  await handle(terms);
}

async function handle(terms) {
  while (terms.length > 0 && !shutDownRequested) {
    const currentBatch = terms.splice(0, 500);
    const work = currentBatch.map((termSet) =>
      limitConcurrency(() =>
        calcTfIdf(termSet.termId, termSet.term, termSet.documentFrequency),
      ),
    );
    console.log("Processed 500 terms remaining : " + terms.length);
    await Promise.allSettled(work);
    await saveState(saveFile, { terms }, true);
  }
  if (shutDownRequested) {
    console.log("Keyboard interrupt detected. Saving State....");
    await saveState(saveFile, { terms }, true);
    process.exit();
  }
}

async function calcTfIdf(termId, term, documentFrequency) {
  const idf = Math.log10(corpusLength / documentFrequency);
  const termDocumentMap = await sqlOperations.getDocumentList(termId);
  let tf_idfMap = [];
  termDocumentMap.forEach((map) => {
    const documentId = map.documentId;
    const tf = map.termFrequency;
    const tfidf = tf * idf;
    tf_idfMap.push({ documentId, tfidf });
  });
  await sqlOperations.insertTfIdfData(termId, term, tf_idfMap);
}

process.on("SIGINT", async () => {
  shutDownRequested = true;
  console.log("\nShutdown requested..." + "  |  State : " + shutDownRequested);
});

calculate();
