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
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

////ДОБАВЛЕНИЕ ЮЗЕРА/////
server.post('/registration', async (req, res) => {
    let check;//проверка на присутствие данного ящика в базе
    await knex.from('users').where('email', '=', req.body.email)
        .then((user)=>{check = user.length; console.log(check)})//проверка осуществляется путем нахождения длины массива
        .catch((err) => console.log(err));
    if (check > 0){///проверка на присутствие данного ящика
        console.log('user already exist');
    }else{
        const salt = await bcrypt.genSalt(10);//хэшируем пароль
        const ph = await bcrypt.hash(req.body.ph, salt);//хэшируем пароль
        await knex('users').insert({firstname : req.body.fn, email: req.body.email, password_hash : ph})
        .then( () => {knex('users').where('email', '=', req.body.email)
        .then(async (user)=> {console.log(user[0].id)});})
        .then((rows) => {res.sendStatus(200);})
        .catch((err) => { console.log( err); throw err });
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
    let email;//хранить емэйл из базы
    let pass;//хранить пассворд хэш из базы
    let userID;//хранить юзерАЙДИ из базы
    let token;

    await knex.from('users').where('email', '=', req.body.email)
    .then((user)=>
     {
     email = user[0].email;//вытаскиваем емэйл из базы
     pass = user[0].password_hash;//вытаскиваем пассвордхэш из базы
     userID = user[0].id;//вытаскиваем пассвордхэш из базы
     })
     .catch((err) => console.log(err));

    await console.log('global email ' + email);///дебажим
    await console.log('global pass_hash ' + pass);///дебажим
    await console.log('global USER ID ' + userID);///дебажим
    await console.log('body pass ' +req.body.password);///дебажим

    await bcrypt.compare(req.body.password, pass, function(err, res) {//верифицируем пароли
        if (err){
            console.log('uuuuuups errror ' + err);
        }
        if (res){//если все хорошо генерим токен
            token = jwt.sign(//генерим токен
            {
               sub: userID,//генерим токен
            }, 'secret', {expiresIn: 3600});//генерим токен

        //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
        //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
        //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
            console.log('woila');//типа все хорошо
            } else {
        // response is OutgoingMessage object that server response http request
            console.log('passwords dont match');//ПАРОЛИ НЕ СОВПАДАЮТ
        // return response.json({success: false, message: 'passwords do not match'});
        }
    });

    await knex('users').where('id','=',userID).update({JWT : token});//записываем токен в базу(НАДО ЛИ)

    next();
    }, (req, res) => {
        res.redirect('/resourse/secret');//как переслать ТОКЕН???????
        }
);

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`)});
