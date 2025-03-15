import sqlOperation from "../utility/sqlOperations.js";
import pLimit from "p-limit";
import {
  Lock,
  insertIntoTermTable,
  insertIntoTerm_DocumentMapTable,
} from "../utility/threadSafety.js";
import { saveState, loadState, removePunctuation } from "../utility/helpers.js";

const saveFile = "./SavedStates/state.json";
const limitConcurrency = pLimit(500);
const lock = new Lock();
let processedTerms = new Set();
let corpus = [];
let shutDownRequested = false;

async function calculate() {
  await sqlOperation.startConnectionTermTable();
  await sqlOperation.startConnectionTermDocumentMappingTable();
  const allData = await sqlOperation.getBatch();
  let state = await loadState(saveFile, false);
  if (state.corpus.length === 0) {
    allData.forEach((document) => {
      let p = JSON.parse(document.paragraphs).join(" ");
      corpus.push(p);
    });
  } else {
    corpus = state.corpus;
    processedTerms = state.processedTerms;
  }
  await handle(corpus, allData);
}

async function handle(corpus, allData) {
  while (corpus.length > 0 && !shutDownRequested) {
    const currentBatch = corpus.splice(0, 500);
    const work = currentBatch.map((document) =>
      limitConcurrency(() => calcDF(document, allData)),
    );
    console.log("Processed 500 documents remaining : " + corpus.length);
    await Promise.allSettled(work);
    await saveState(saveFile, { corpus, processedTerms }, false);
  }
  if (shutDownRequested) {
    console.log("Keyboard interrupt detected. Saving State....");
    await saveState(saveFile, { corpus, processedTerms }, false);
    process.exit();
  }
}

async function calcDF(document, allData) {
  const removedPunctuation = removePunctuation(document);
  const textList = Array.from(new Set(removedPunctuation.split(" ")));
  for (const word of textList) {
    await df(word, allData);
  }
}

function calcTf(term, document) {
  let termFrequency = 0;
  const words = document.split(" ");
  for (const word of words) {
    if (word === term) {
      termFrequency++;
    }
  }
  return termFrequency / words.length;
}

async function df(term, allData) {
  if (processedTerms.has(term)) return;
  let documentWithTerm = 0;
  let termFrequenciesAndDocumentIds = [];

  for (const document of allData) {
    const p = removePunctuation(JSON.parse(document.paragraphs).join(" "));
    const id = JSON.parse(document.id);
    if (p.includes(term)) {
      let tf = calcTf(term, p);
      termFrequenciesAndDocumentIds.push({ documentId: id, termFrequency: tf });
      documentWithTerm++;
    }
  }
  processedTerms.add(term);
  const termId = await insertIntoTermTable(
    lock,
    term,
    documentWithTerm,
    sqlOperation.insertTermData,
  );

  await insertIntoTerm_DocumentMapTable(
    lock,
    termId,
    termFrequenciesAndDocumentIds,
    sqlOperation.insertTermDocumentMappingData,
  );
}

process.on("SIGINT", async () => {
  shutDownRequested = true;
  console.log("\nShutdown requested..." + "  |  State : " + shutDownRequested);
});

calculate();
