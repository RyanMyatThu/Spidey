const Sequelize = require("sequelize");
const DataTypes = require("sequelize");
require("dotenv").config();


const crawled_content = sequelize.define(
  "crawled_content",
  {
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    paragraphs: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    lists: {
      type: DataTypes.JSON,
    },
    tableData: {
      type: DataTypes.JSON,
    },
    articles: {
      type: DataTypes.JSON,
    },
    mainContents: {
      type: DataTypes.JSON,
    },
    title: {
      type: DataTypes.STRING,
    },

    metadata: {
      type: DataTypes.JSON,
    },
  },
  {
    timestamps: true,
  },
);

const term_table = sequelize.define(
  "term_table",
  {
    termId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    term: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    documentFrequency: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: false,
    tableName: "term_table",
  },
);

const term_documentMapping = sequelize.define(
  "term_documentMapping",
  {
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: term_table,
        key: "termId",
      },
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: crawled_content,
        key: "id",
      },
    },
    termFrequency: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
    },
  },
  {
    timestamps: false,
    primaryKey: false,
    indexes: [
      {
        unique: true,
        fields: ["termId", "documentId"],
      },
    ],
  },
);

const tf_idf_table = sequelize.define(
  "tf_idf_table",
  {
    termId: {
      type: DataTypes.INTEGER,
      primaryKey: false,
      references: {
        model: term_table,
        key: "termId",
      },
    },
    term: {
      type: DataTypes.STRING,
      primaryKey: false,
      allowNull: false,
      references: {
        model: term_table,
        key: "term",
      },
    },
    documentId: {
      type: DataTypes.INTEGER,
      primaryKey: false,
      references: {
        model: crawled_content,
        key: "id",
      },
    },
    tfidf: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      primaryKey: false,
    },
  },
  {
    timestamps: false,
    tableName: "tf_idf_table",
    primaryKey: false,
    indexes: [
      {
        unique: true,
        fields: ["termId", "documentId"],
      },
    ],
  },
);

async function insertTfIdfData(termId, term, mappings) {
  const values = mappings.map(({ documentId, tfidf }) => ({
    termId,
    term,
    documentId,
    tfidf,
  }));
  try {
    await tf_idf_table.bulkCreate(values);
  } catch (error) {
    console.error(
      `Error inserting tf-idf data for ${termId} and ${documentId}:\n`,
      error,
    );
  }
}

async function insertTermDocumentMappingData(termId, mappings) {
  const values = mappings.map(({ documentId, termFrequency }) => ({
    termId,
    documentId,
    termFrequency,
  }));
  try {
    await term_documentMapping.bulkCreate(values);
  } catch (error) {
    console.error(
      `Error inserting term document mapping data for ${termId} and ${documentId}:`,
      error,
    );
  }
}

async function insertTermData(term, documentFrequency) {
  try {
    const newTerm = await term_table.create({
      term: term,
      documentFrequency: documentFrequency,
    });
    return newTerm.termId;
  } catch (error) {
    console.error(`Error inserting term data for ${term}:`, error);
  }
}

async function syncTfIdfTable() {
  try {
    await tf_idf_table.sync();
    console.log("tf_idf_table has been synced successfully.");
  } catch (error) {
    console.error("Error syncing database:" + error);
  }
}

async function syncTermDocumentMappingTable() {
  try {
    await term_documentMapping.sync();
    console.log("term_documentMapping has been synced successfully.");
  } catch (error) {
    console.error("Error syncing database:" + error);
  }
}

async function syncTermTable() {
  try {
    await term_table.sync();
    console.log("term_table has been synced successfully.");
  } catch (error) {
    console.error("Error syncing database:" + error);
  }
}

async function startConnectionTermTable() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
    syncTermTable();
  } catch (error) {
    console.log("Error syncing database:" + error);
  }
}

async function startConnectionTermDocumentMappingTable() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
    syncTermDocumentMappingTable();
  } catch (error) {
    console.log("Error syncing database:" + error);
  }
}

async function startConnectionTfIdfTable() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
    syncTfIdfTable();
  } catch (error) {
    console.log("Error syncing database:" + error);
  }
}

async function startConnection() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
    syncDatabase();
  } catch (error) {
    console.log(error);
  }
}

async function syncDatabase() {
  try {
    await crawled_content.sync();
    console.log("crawled_content has been synced successfully.");
  } catch (error) {
    console.error("Error syncing database:" + error);
  }
}
async function getBatch() {
  //const batchSize = 10;
  // const offset = batchIndex * batchSize;
  try {
    const currentBatch = await crawled_content.findAll({
      attributes: ["id", "paragraphs"],
      // limit : 2,
      //  offset : 0,
      order: [["id", "ASC"]],
    });
    /* if (currentBatch.length === 0) {
        console.log(`Batch ${batchIndex} is empty.`);
    } */

    return currentBatch;
  } catch (error) {
    console.log(error);
  }
}

async function getUniqueTerms() {
  try {
    const terms = await term_table.findAll({
      attributes: ["termId", "term", "documentFrequency"],
    });
    return terms;
  } catch (error) {
    console.log(error);
  }
}

async function getDocumentList(termId) {
  try {
    const documents = await term_documentMapping.findAll({
      where: { termId: termId },
    });
    return documents;
  } catch (error) {
    console.log(error);
  }
}

async function getTotalDocumentCount() {
  try {
    const count = await crawled_content.count();
    return count;
  } catch (error) {
    console.log(error);
  }
}

async function getTotalTermCount() {
  try {
    const count = await term_table.count();
    return count;
  } catch (error) {
    console.log(error);
  }
}

async function getDocumentLength(documentId) {
  try {
    const document = await crawled_content.findAll({
      where: {
        id: documentId,
      },
      attributes: ["paragraphs"],
    });
    return document[0];
  } catch (error) {
    console.log(error);
  }
}

async function insertCrawledData(
  url,
  paragraphs,
  lists,
  tableData,
  articles,
  mainContents,
  title,
  metadata,
) {
  try {
    await crawled_content.create({
      url,
      paragraphs: JSON.stringify(paragraphs),
      lists: JSON.stringify(lists),
      tableData: JSON.stringify(tableData),
      articles: JSON.stringify(articles),
      mainContents: JSON.stringify(mainContents),
      title,
      metadata,
    });
    console.log(`Data for ${url} inserted successfully.`);
  } catch (error) {
    console.error(`Error inserting data for ${url}:`, error);
  }
}

module.exports = {
  startConnection,
  insertCrawledData,
  getBatch,
  insertTermData,
  startConnectionTermTable,
  startConnectionTermDocumentMappingTable,
  insertTermDocumentMappingData,
  insertTfIdfData,
  startConnectionTfIdfTable,
  getUniqueTerms,
  getDocumentList,
  getTotalDocumentCount,
  getTotalTermCount,
  tf_idf_table,
  crawled_content,
  getDocumentLength,
};
