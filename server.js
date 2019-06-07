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
const fetch = require("node-fetch");
const multer = require('multer');

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        cb(null, 'ZDES_BUDET_USER_ID' + file.originalname)
    }
});

const upload = multer({storage: storage });

server.use(morgan('short'));
server.use(express.static('./public'));
server.use(express.static('./uploads'));
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

////test JWT////
////////////////
server.get('/resource', (req, res) => {
    res
        .status(200)
        .send('Public resource');
});

//////test JWT////////
//////////////////////
server.get('/resource/secret',jwtCheck, (req, res) => {
   res
       .status(200)
       .send('Secret resource you should be login');
    console.log('we are logined');
    console.log('FROM PAGE TOKEN IS ' + res.headers);
});


////ПОИСК ПО АЙДИ////////
server.get('/users/:id', (req, res) => {
    knex.from('users').select("*").where('id','=',req.params.id)
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

////РЕГИСТРАЦИЯ ЮЗЕРА/////
server.post('/registration', upload.single('userpic'), async (req, res) => {
    if (req.file){
        console.log(req.file);
        await knex.from('users').where('id','=', req.body.id)
            .update({avatar: req.file.filename})
            .then((rows) => res.json(rows))
            .catch((err) => { console.log( err); throw err });
    }else{
        let check;//проверка на присутствие данного ящика в базе
        console.log(req.body);
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
                // .then((rows) => {res.sendStatus(200);})
                .then(async () => {
                    let userID;
                    await knex.from('users').where('email', '=', req.body.email)
                        .then((user)=>
                        {
                            userID = user[0].id;//вытаскиваем юзерайди из базы
                        })
                        .catch((err) => console.log(err));
                    let token = jwt.sign(//генерим токен
                            {
                                userID: userID,//генерим токен
                            }, 'secret', {expiresIn: 3600});
                    res.send({token: token});
                    // res.sendStatus(200);
                })
                .catch((err) => { console.log( err); throw err });
        }
    }
});

////ОБНОВЛЕНИЕ ЮЗЕРА/////
server.post('/user/update', (req, res) => {
    console.log(req.body);
    knex('users').where('id','=', req.body.id)
        .update({firstname: req.body.firstname, email: req.body.email, password_hash: req.body.password_hash})
        .then((rows) => {
                res.sendStatus(200);
                })
        .catch((err) => { console.log( err); res.send(err) });
});

////ПОИСК ЮЗЕРА//////////
server.get('/users/find/:fn', (req, res) => {
    knex.from('users').select('*').where('firstname','=', req.params.fn)
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
});

////ОБЩИЙ СПИСОК ЮЗЕРОВ//////
server.get('/users', (req, res) => {
    knex.from('users').select("*")
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
        // .finally(() => {
        //     knex.destroy();
        // });
});

//////LOGIN////
server.post('/login', async (req, res) => {
        let email;//хранить емэйл из базы
        let pass;//хранить пассворд хэш из базы
        let userID;//хранить юзерАЙДИ из базы
        let token;//хранить токен из базы

        if (!req.body.email || !req.body.password){  //проверка на корректность запроса
            console.log('WRONG REQUEST');                                  //проверка на корректность запроса
            return;                                                        //проверка на корректность запроса
        }                                                                  //проверка на корректность запроса
        await knex.from('users').where('email', '=', req.body.email)
            .then((user)=>
            {
                email = user[0].email;//вытаскиваем емэйл из базы
                pass = user[0].password_hash;//вытаскиваем пассвордхэш из базы
                userID = user[0].id;//вытаскиваем юзерайди из базы
            })
            .catch((err) => console.log(err));
        // await console.log('email из базы ' + email + '\n ');///дебажим
        // await console.log('pass_hash из базы ' + pass  + '\n ');///дебажим
        //  await console.log('USER ID из базы ' + userID  + '\n ');///дебажим
        // await console.log('body pass из формы ' +req.body.password  + '\n ');///дебажим
       await bcrypt.compare(req.body.password, pass, (err, resp) => {//верифицируем пароли
            if (err){
                console.log('uuuuuups errror ' + err);
            }
            if (resp){
                //если все хорошо генерим токен
                token = jwt.sign(//генерим токен
                    {
                        userID: userID,//генерим токен
                    }, 'secret', {expiresIn: 3600});//генерим токен
                res.send({token: token});

                 // console.log('its ok pass');

                //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
                //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
                //ПЕРЕСЫЛКА JWT НЕ РЕАЛИЗОВАННА
                // console.log('woila'  + '\n ');//типа все хорошо
                // fetch('http://localhost:3020/resource/secret', {
                //     "headers": {
                //         "Content-Type": "application/json",
                //         "Authorization": "Bearer " + token ,
                //     }
                // }
                // ).then(res=>console.log(res));
              //  return res.send(token);
            } else {
                console.log('passwords does not match'  + '\n ');//ПАРОЛИ НЕ СОВПАДАЮТ
                res.sendStatus(401);
            }

        });

    });


//EVENTS////
//ADD///////
server.post('/events/add', async (req, res) => {
    console.log(req.body.name);
    console.log(req.body.date_creation);
    await knex.from('events').insert({title: req.body.name, description: req.body.description,
        date_creation: req.body.date_creation, date_exe: req.body.date_exe, duration: req.body.duration,
        author_id: req.body.user_id})
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

//EVENTS////
//UPDATE////
server.post('/events/update', async (req, res) => {
    console.log(req.body.date_creation);
    await knex.from('events').where('id','=',req.body.event_id)
        .update({title: req.body.name, description: req.body.description, date_creation: req.body.date_creation,
            date_exe: req.body.date_exe, duration: req.body.duration , author_id: req.body.user_id})
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

//EVENT////
//JOIN/////
server.post('/event/join', async (req, res) => {
    await knex.from('events_members').insert({user_id: req.body.user_id, event_id: req.body.event_id})
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

//EVENTS////
//LIST//////
// server.post('/events/list', async (req, res) => {
//     await knex.from('events').where('author_id','=', req.body.id)
//         .then((rows) => res.json(rows))
//         .catch((err) => { console.log( err); throw err });
//
//     await knex.from('events_members').where('user_id','=', req.body.id)////DOES NOT WORK
//         .then((rows) => res.json(rows))////DOES NOT WORK
//         .catch((err) => { console.log( err); throw err });////DOES NOT WORK
// });

server.get('/events/list', async (req, res) => {
    // var y = 4;
    await knex.from('events')
        // .where('author_id','=', y)
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });

    await knex.from('events_members').where('user_id','=', y)////DOES NOT WORK
        .then((rows) => res.json(rows))////DOES NOT WORK
        .catch((err) => { console.log( err); throw err });////DOES NOT WORK
});

//EVENTS////
//ONE///////
server.post('/event/one', async (req, res) => {
    await knex.from('events').where('id','=', req.body.group_id)
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

//GROUPS////
//ADD///////
server.post('/groups/add', async (req, res) => {
    let is_open = 1;
    if (req.body.is_open === 'closed'){
        is_open = 0;
    }
    console.log(req.body);
    await knex.from('groups').insert({name: req.body.name, description: req.body.description, is_open: is_open ,admin_id: parseInt(req.body.user_id)})
        .then((rows) => res.sendStatus(200))
        .catch((err) => { console.log( err); throw err });
});

//GROUPS////
//JOIN///////
server.post('/group/join/', async (req, res) => {
   await knex.from('groups_members').insert({group_id: req.body.group_id, user_id: req.body.user_id})
       .then(rows => res.json(rows))
       .catch(err => { console.log( err); throw err });
});

//GROUPS////
//LIST//////
// server.post('/groups/list', async (req, res) => {
//     await knex.from('groups').where('admin_id','=', req.body.id)
//         .then((rows) => res.json(rows))
//         .catch((err) => { console.log( err); throw err });
// });
server.get('/groups/list', async (req, res) => {
    // var x = 7;
    await knex.from('groups')
        // .where('admin_id','=', x)
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});


//////GROUPS////
//////ONE///////
server.get('/groups/:group_id', async (req, res) => {
    console.log(req.params);
    await knex.from('groups').where('id','=', req.params.group_id)
        .then((rows) => res.json(rows))
        .catch((err) => { console.log( err); throw err });
});

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`  + '\n ')});
