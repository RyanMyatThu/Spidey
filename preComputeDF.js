import sqlOperation from "./utility/sqlOperations.js";
import pLimit from "p-limit";
import { Lock, insertDF } from "./utility/threadSafety.js";

const limitConcurrency = pLimit(50); 
const lock = new Lock();

async function calculate() {
    const syncDone = await sqlOperation.startConnectionDF();
    const allData = await sqlOperation.getBatch(); 

    let corpus = [];
    allData.forEach(document => {
        let p = JSON.parse(document.paragraphs).join(" ");
        corpus.push(p);
    });

    if (syncDone) {
        await handle(corpus, allData);
    }
}

async function handle(corpus, allData) {
    while (corpus.length > 0) {
        const currentBatch = corpus.splice(0, 10);
        const work = currentBatch.map(document =>
            limitConcurrency(() => calcDF(document, allData))
        );
        await Promise.allSettled(work);
    }
}

async function calcDF(document, allData) {
    const textList = new Set(document.split(" "));
    const work = Array.from(textList).map(term =>
        limitConcurrency(() => df(term, allData))
    );
    await Promise.allSettled(work);
}

async function df(term, allData) {
    for (const document of allData) {
        const p = JSON.parse(document.paragraphs).join(" ");
        const id = JSON.parse(document.id);

        if (p.includes(term)) {
            console.log("Inserting  " + term + " id: " + id);
            await insertDF(lock, term, id, sqlOperation.insertDfData);
        }
    }
}

calculate();
