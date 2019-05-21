const express = require('express');
const server = express();
const PORT = 3020;
const morgan = require('morgan');
const mysql = require('mysql');
const bodyParser = require('body-parser');

server.use(morgan('short'));
server.use(express.static('./public'));
server.use(bodyParser.urlencoded({extended: false}));

function getConnection(){
    return mysql.createConnection({
        host: '35.204.124.30',
        user: 'root',
        password: 'admin',
        table: 'users',
    });
}

/////////////////////////
////КОРНЕВОЙ РОУТ////////
/////////////////////////
server.get('/', (req, res) => {
    res.send('hello from ROOT');
});

/////////////////////////
////ПОИСК ПО АЙДИ////////
/////////////////////////
server.get('/users/:id', (req, res) => {

    const connection = getConnection();

    const userId = req.params.id;
    const queryString = 'SELECT * FROM users.users WHERE id = ?';

    connection.query(queryString, [userId],(err, rows, fields) =>{
        if (err){
            console.log(' >>>>>>>Fuck MYSQL<<<<<<<< ' + err);
            res.sendStatus(500);
            return;
        }
        console.log('I think everething is ok');
        res.json(rows);
    });
});

/////////////////////////
////ДОБАВЛЕНИЕ ЮЗЕРА/////
/////////////////////////
server.post('/user/add', (req, res) => {
    console.log('Body of request: ' + req.body.fn + ' ' + req.body.ln +  ' ' + req.body.ph);
    let fn = req.body.fn;
    let ln = req.body.ln;
    let ph = req.body.ph;

    const queryString = "INSERT INTO users.users (firstname, email, password_hash) VALUES (?, ?, ?)";
    getConnection().query(queryString, [fn, ln, ph], (err, results, fields) => {
        if(err) {
            console.log('Failed to insert in new user DB: ' + err);
            res.sendStatus(500);
            return;
        }

        console.log('Nice inserting of user', fn + ln + ph);
    });
});

/////////////////////////
////ОБНОВЛЕНИЕ ЮЗЕРА/////
/////////////////////////
server.post('/user/update', (req, res) => {
    console.log('Update for user with ID '+ req.body.id +' Body of request: ' + req.body.fn + ' ' + req.body.ln +  ' ' + req.body.ph);
    let id = req.body.id;
    let fn = req.body.fn;
    let ln = req.body.ln;
    let ph = req.body.ph;

    const queryString = "UPDATE users.users SET firstname = ?, email = ?, password_hash = ? WHERE id = ?";
    getConnection().query(queryString, [fn, ln, ph, id], (err, results, fields) => {
        if(err) {
            console.log('Failed to update user DB: ' + err);
            res.sendStatus(500);
            return;
        }

        console.log('Nice update of user', fn + ln + ph);
    });
});

/////////////////////////
////ПОИСК ЮЗЕРА//////////
/////////////////////////
server.get('/user/find/:fn', (req, res) => {
    console.log('Body of request: ' + req.params.fn);
    let fn = req.params.fn;

    const queryString = 'SELECT * FROM users.users WHERE firstname = ?';
    getConnection().query(queryString, [fn], (err, rows, fields) => {
        console.log(fn);
        if(err) {
            console.log('Failed to find user DB: ' + err);
            res.sendStatus(500);
            return;
        }
        console.log('Nice search of user', fn);
        res.json(rows);
    });
});

/////////////////////////
////ОБЩИЙ СПИСОК ЮЗЕРОВ//
/////////////////////////
server.get('/users', (req, res) => {
    const connection = getConnection();

    const queryString = 'SELECT * FROM users.users';

    connection.query(queryString, (err, rows, fields) =>{
        if (err){
            console.log(' >>>>>>>Fuck MYSQL<<<<<<<< ' + err);
            res.sendStatus(500);
            return;
        }
        console.log('I think everething is ok');
        res.json(rows);
    });
});

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`)});