const express = require('express');
const mysql = require('mysql');

const PORT = process.env.PORT || 3015;
const app = express();

const client = mysql.createConnection({
host: '35.204.124.30',
port: '3306',
user: 'root',
password: 'admin',
database: 'test',
});

var query = client.query('INSERT INTO users SET ?', client.user, function(err, result) {
    console.log(err);
    console.log(result);
});



app.listen(PORT, () => {console.log(`server is started on ${PORT}`)});

