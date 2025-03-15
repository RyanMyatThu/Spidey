import sqlOperations from "../utility/sqlOperations.js";

async function calculate() {
  const allDocs = await sqlOperations.getBatch();
  let sumLength = 0;
  for (const document of allDocs) {
    const d = await sqlOperations.getDocumentLength(document.id);
    const length = JSON.parse(d.dataValues.paragraphs)
      .join(" ")
      .split(" ").length;
    sumLength += length;
  }
  console.log(sumLength / 21634);
}

calculate();
