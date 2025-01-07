const express = require('express')
const app = express()
const tf_idf = require('./routes/tf_idf.js');

app.use('/', tf_idf);

app.listen(3000)