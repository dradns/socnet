const express = require('express');
const server = express();
const PORT = process.env.PORT || 3020;
const morgan = require('morgan');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const db = require('./db.js');
const dbknex = require('./db.js');
const knex = require('knex')(dbknex);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const expressjwt = require('express-jwt');
const cors = require('cors');

server.use(morgan('short'));
server.use(express.static('./public'));
server.use(bodyParser.urlencoded({extended: false}));
server.use(cors());//библиотека CORS

const jwtCheck = expressjwt({secret: 'secret'});//middleware for jwt

/*function getConnection(){
    return mysql.createConnection(dbknex);
}*/

////КОРНЕВОЙ РОУТ////////
server.get('/', (req, res) => {
    res.send('hello from ROOT');
});

//test JWT
server.get('/resourse', (req, res) => {
    res
        .status(200)
        .send('Public resourse');
});

//test JWT
server.get('/resourse/secret',jwtCheck, (req, res) => {
   res
       .status(200)
       .send('Secret resource you should be login');
});


////ПОИСК ПО АЙДИ////////
server.get('/users/:id', (req, res) => {
    knex.from('users').select("*").where('id','=',req.params.id)
        .then((rows) => res.json(rows)
        ).catch((err) => { console.log( err); throw err });
});

////ДОБАВЛЕНИЕ ЮЗЕРА/////
server.post('/registration', async (req, res) => {
    let check;
    await knex.from('users').where('email', '=', req.body.email)
        .then((user)=>{check = user.length; console.log(check)})
        .catch((err) => console.log(err));
    if (check > 0){///проверка на присутствие данного ящика
        console.log('already exist');
    }else{
        const salt = await bcrypt.genSalt(10);
        const ph = await bcrypt.hash(req.body.ph, salt);
        await knex('users').insert({firstname : req.body.fn, email: req.body.email, password_hash : ph})
            .then( () => {knex('users').where('email', '=', req.body.email).then(async (user)=> {console.log(user[0].id)});})
            .then((rows) => {
                    res.sendStatus(200);
                }
            ).catch((err) => { console.log( err); throw err });
    }
});

////ОБНОВЛЕНИЕ ЮЗЕРА/////
server.post('/user/update', (req, res) => {
    knex('users').where('id','=',req.body.id)
        .update({firstname : req.body.fn, email: req.body.ln, password_hash : req.body.ph})
        .then((rows) => {
                res.sendStatus(500);
            }
        ).catch((err) => { console.log( err); throw err });
});

////ПОИСК ЮЗЕРА//////////
server.get('/users/find/:fn', (req, res) => {
    knex.from('users').select('*').where('firstname','=', req.params.fn)
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
});

////ОБЩИЙ СПИСОК ЮЗЕРОВ//
server.get('/users', (req, res) => {
    knex.from('users').select("*")
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
        // .finally(() => {
        //     knex.destroy();
        // });
});

//LOGIN////
server.post('/login', async (req, res, next) => {
    let userID;
    await knex.from('users').where('email','=',req.body.email)
        .then( (user) => {console.log('its a user email: ' + user[0].email); return user[0].id; })
        .then((userEmail) =>
        {
            console.log('its a user ID: ' + userEmail);
            userID =  userEmail;
        })
        .catch((err) => { console.log( err); throw err });

    const token = jwt.sign(
        {
            sub: userID,
        }, 'secret', {expiresIn: 3600});

    await knex('users').where('id','=',userID).update({JWT : token});

    console.log('its a userID from token: ' + userID);
    next();
    }, (req, res) => {
        res.redirect('/resourse/secret');
        }
);

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`)});
