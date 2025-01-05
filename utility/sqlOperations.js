const Sequelize = require("sequelize");
const DataTypes = require("sequelize");
require('dotenv').config()


const sequelize = new Sequelize('mydb', 'root', process.env.WORD, {
    host: 'localhost',
    dialect: 'mysql'
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
            type: DataTypes.TEXT("long"),
            allowNull: false
        },
        lists: {
            type: DataTypes.TEXT("long"),
        },
        tableData: {
            type: DataTypes.TEXT("long"),
        },
        articles: {
            type: DataTypes.TEXT("long"),
        },
        mainContents: {
            type: DataTypes.TEXT("long"),
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
    console.log('CrawledContent table has been synced successfully.');
    } catch(error){
        console.error('Error syncing database:' + error);
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
    insertCrawledData
};