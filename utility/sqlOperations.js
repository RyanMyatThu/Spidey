const Sequelize = require("sequelize");
const DataTypes = require("sequelize");
const { FORCE } = require("sequelize/lib/index-hints");
require('dotenv').config()


const sequelize = new Sequelize('mydb', 'root', process.env.WORD, {
    host: 'localhost',
    dialect: 'mysql',
    logging: console.log
  });

const crawled_content = sequelize.define(
    'crawled_content',
    {
        url : { 
            type : DataTypes.STRING,
            allowNull : false,
            unique : true
        },

        paragraphs: {
            type:  DataTypes.JSON,
            allowNull: false
        },
        lists: {
            type:  DataTypes.JSON,
        },
        tableData: {
            type:  DataTypes.JSON,
        },
        articles: {
            type:  DataTypes.JSON,
        },
        mainContents: {
            type:  DataTypes.JSON,
        },
        title : {
            type : DataTypes.STRING,

        },

        metadata : {
            type : DataTypes.JSON,
        }
    },
    {
        timestamps : true
    }

)


const document_table = sequelize.define(
    'document_table',
    {
        term: {
            type: DataTypes.STRING,
            allowNull: false,
            
        },
        documentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        timestamps: false,
        primaryKey : false,
        tableName: 'document_table',
        indexes: [
            {
                unique: true,
                fields: ['term' ,'documentId'], 
            },
        ],
    }
);



async function insertDfData(term, documentID) {
    try {
        await document_table.create({
            term: term,
            documentId: documentID,
        });
      
        console.log(`Inserted successfully: ${term}, DocID: ${documentID}`);
        return true;
    } catch (error) {
        console.error(`Error inserting DF data for ${term}:`, error);
    }
}

async function startConnectionDF(){
    try{
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        return syncDocumentTable();
    }catch(error){
        console.log(error)
    }
}

async function syncDocumentTable(){
    try{
    await document_table.sync();
    console.log('document_table has been synced successfully.');
    return true;
    } catch(error){
        console.error('Error syncing database:' + error);
    }
}

async function startConnection(){
    try{
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        syncDatabase();
    }catch(error){
        console.log(error)
    }
}

async function syncDatabase(){
    try{
    await crawled_content.sync();
    console.log('crawled_content has been synced successfully.');
    } catch(error){
        console.error('Error syncing database:' + error);
    }
}
async function getBatch(){
    //const batchSize = 10;
   // const offset = batchIndex * batchSize;
    try { 
    const currentBatch = await crawled_content.findAll({
        attributes : [
            'id',
            'paragraphs',
        ],
       // limit : 2,
      //  offset : 0,
        order : [['id', "ASC"]]
    })
   /* if (currentBatch.length === 0) {
        console.log(`Batch ${batchIndex} is empty.`);
    } */
 
    return currentBatch;
} catch(error) {
    console.log(error)


}
}


async function insertCrawledData(url, paragraphs, lists, tableData, articles, mainContents, title, metadata) {
    try {
        await crawled_content.create({
            url,
            paragraphs: JSON.stringify(paragraphs),
            lists: JSON.stringify(lists),
            tableData: JSON.stringify(tableData),
            articles: JSON.stringify(articles),
            mainContents: JSON.stringify(mainContents),
            title,
            metadata
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
    insertDfData,
    startConnectionDF,
    
};