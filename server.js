const express = require('express');
const server = express();
const PORT = process.env.PORT || 3020;
const morgan = require('morgan');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const db = require('./db.js');
const dbknex = require('./db.js');
const knex = require('knex')(dbknex);

server.use(morgan('short'));
server.use(express.static('./public'));
server.use(bodyParser.urlencoded({extended: false}));

function getConnection(){
    return mysql.createConnection(dbknex);
}

////КОРНЕВОЙ РОУТ////////
server.get('/', (req, res) => {
    res.send('hello from ROOT');
});

////ПОИСК ПО АЙДИ////////
server.get('/users/:id', (req, res) => {
    knex.from('users').select("*").where('id','=',req.params.id)
        .then((rows) => {
                res.json(rows);
            }
        ).catch((err) => { console.log( err); throw err });
});

////ДОБАВЛЕНИЕ ЮЗЕРА/////
server.post('/user/add', (req, res) => {
    knex('users').insert({firstname : req.body.fn, email: req.body.ln, password_hash : req.body.ph})
        .then((rows) => {
                res.sendStatus(500);
            }
        ).catch((err) => { console.log( err); throw err });
});

////ОБНОВЛЕНИЕ ЮЗЕРА/////
server.post('/user/update', (req, res) => {
    knex('users').where('id','=',req.body.id).update({firstname : req.body.fn, email: req.body.ln, password_hash : req.body.ph})
        .then((rows) => {
                res.sendStatus(500);
            }
        ).catch((err) => { console.log( err); throw err });
});

////ПОИСК ЮЗЕРА//////////
server.get('/user/find/:fn', (req, res) => {
    knex.from('users').select('*').where('firstname','=', req.params.fn)
        .then((rows) => {
            res.json(rows);
        }
    ).catch((err) => { console.log( err); throw err });
});

////ОБЩИЙ СПИСОК ЮЗЕРОВ//
server.get('/users', (req, res) =>
{
    knex.from('users').select("*")
        .then((rows) => {
                res.json(rows);
        }
        ).catch((err) => { console.log( err); throw err });
        // .finally(() => {
        //     knex.destroy();
        // });
});

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`)});