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
const jwtDecode = require('jwt-decode');

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
//        console.log(req.file);
        await knex.from('users').where('id','=', req.body.id)
            .update({avatar: req.file.filename})
            .then((rows) => res.json(rows))
            .catch((err) => { console.log( err); throw err });
    }else{
        let check;//проверка на присутствие данного ящика в базе
  //      console.log(req.body);
        await knex.from('users').where('email', '=', req.body.email)
            .then((user)=>{check = user.length; console.log(check)})//проверка осуществляется путем нахождения длины массива
            .catch((err) => console.log(err));
        if (check > 0){///проверка на присутствие данного ящика
    //        console.log('user already exist');
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
//    console.log(req.body);
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
        let firstname;

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
                firstname = user[0].firstname;
            })
            .catch((err) => console.log(err));
        // await console.log('email из базы ' + email + '\n ');///дебажим
        // await console.log('pass_hash из базы ' + pass  + '\n ');///дебажим
        //  await console.log('USER ID из базы ' + userID  + '\n ');///дебажим
        // await console.log('body pass из формы ' +req.body.password  + '\n ');///дебажим
       await bcrypt.compare(req.body.password, pass, (err, resp) => {//верифицируем пароли
            if (err){
  //              console.log('uuuuuups errror ' + err);
            }
            if (resp){
                //если все хорошо генерим токен
                token = jwt.sign(//генерим токен
                    {
                        userID: userID,
                        name: firstname, //генерим токен
                    }, 'secret', {expiresIn: "3 hours"});//генерим токен
                res
                  .status(200)
                  .send({token: token});

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


// //EVENTS////
// //ADD///////
// server.post('/events/add', async (req, res) => {
// //<<<<<<< HEAD
//     console.log(req.body);
//     await knex.from('events').insert({
//         title: req.body.title, description: req.body.description,
//         // date_creation: req.body.date_creation,
//         date_exe: req.body.date_exe,
// <<<<<<< HEAD
//         duration: req.body.duration}).then(() => {
// res.sendStatus(200)}).catch((err) => {console.log(err)});
//         console.log(req.body.title);
// //    console.log(req.body.date_creation);
// //    await knex.from('events').insert({
//   //      title: req.body.title, description: req.body.description,
//         // date_creation: req.body.date_creation,
//     //    date_exe: req.body.date_exe, duration: req.body.duration,
// //>>>>>>> a1249dd85c825818ef49586ad8acebba108fcdf1
//         //      author_id: req.body.user_id})
// //            .then((rows) => res.sendStatus(200))
//   //        .catch((err) => { console.log( err); throw err });
//    // })
// =======
//         duration: req.body.duration})
//         .then( () => {
//             res.sendStatus(200)
//         });
//         console.log(req.body.title);
//     console.log(req.body.date_creation);
//     // await knex.from('events').insert({
//     //     title: req.body.title, description: req.body.description,
//     //     // date_creation: req.body.date_creation,
//     //     date_exe: req.body.date_exe, duration: req.body.duration,
// //>>>>>>> a1249dd85c825818ef49586ad8acebba108fcdf1
//         //      author_id: req.body.user_id})
//         //    .then((rows) => res.json(rows))
//         //  .catch((err) => { console.log( err); throw err });
//     // })
// >>>>>>> 9cc4f3585508d51dd5e531c2b8d6e7afc6a3a54c
// });


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
//<<<<<<< HEAD
//      var y = 4;
     await knex.from('events')
          // .where('author_id','=', y)
         .then((rows) => res.json(rows))
         .catch((err) => { console.log( err); throw err });

    // await knex.from('events_members')
    //     .where('user_id','=', y)////DOES NOT WORK
    //     .then((rows) => res.json(rows))////DOES NOT WORK
    //     .catch((err) => { console.log( err); throw err });////DOES NOT WORK
//=======
    // var y = 4;
   // await knex.from('events')
     //    .where('author_id','=', y)
       // .then((rows) => res.json(rows))
      //  .catch((err) => { console.log( err); throw err });

    // await knex.from('events_members').where('user_id','=', y)
    //     .then((rows) => res.json(rows))////DOES NOT WORK
    //     .catch((err) => { console.log( err); throw err });
//>>>>>>> a1249dd85c825818ef49586ad8acebba108fcdf1
});

//EVENTS////
//ONE///////
//<<<<<<< HEAD
//server.get('/events/:id', async (req, res) => {
  //  await knex.from('events').where('id','=', req.params.id)
//=======
server.get('/events/:event_id', async (req, res) => {
    await knex.from('events').where('id','=', req.params.event_id)
///>>>>>>> a1249dd85c825818ef49586ad8acebba108fcdf1
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
server.post('/group/join/:group_id', async (req, res) => {
   await knex.from('groups_members').insert({group_id: req.params.group_id, user_id: jwtDecode(req.headers.authorization.slice(7)).userID})
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
    let requestArray = [];
    let responseArray = [];
    let subscribed = [];
    await knex.from('groups')
        .then(async (rows) => {
          requestArray = rows;
          await knex.from('groups_members').where('user_id', '=', jwtDecode(req.headers.authorization.slice(7)).userID)
            .then(rows => subscribed = rows )
            .catch((err) => { console.log( err); throw err });
          responseArray = requestArray.map(item => {
            let newitem = {};
              Object.assign(newitem, item);
              newitem.isSubscribed = subscribed.some((some) => some.group_id === item.id);
              return newitem;
          });
          res.json(responseArray);
        })
        .catch((err) => { console.log( err); throw err });
});


//////GROUPS////
//////ONE///////
server.get('/groups/:group_id', async (req, res) => {
  let response = {};
  let subscribed = [];
  let subscribers = [];
  let posts = [];
  let allUsers = await knex.from('users');
    let likesCounter = [];
    await knex.from('groups').where('id','=', req.params.group_id)
        .then(async (rows) => {
          await knex.from('groups_members').where('user_id', '=', jwtDecode(req.headers.authorization.slice(7)).userID)
            .then(rows => subscribed = rows )
            .catch((err) => { console.log( err); throw err });
          Object.assign(response, rows[0]);
          response.isSubscribed = subscribed.some((some) => some.group_id === rows[0].id);
          subscribers = await knex.from('groups_members').where('group_id', '=', req.params.group_id).then(rows => rows.map(item => item.user_id));
            await knex.from('posts_in_groups').where('group_id', '=', req.params.group_id)
              .then( async (rows) => {
                let likedPosts = await knex.from('likes_to_posts').where('author_id', '=', jwtDecode(req.headers.authorization.slice(7)).userID);
                 likesCounter =  await knex.from('likes_to_posts');
                posts = await rows.map(item => {
                    let newPost = {};
                     Object.assign(newPost, item);
                    newPost.likesCounter = likesCounter.filter( fil => fil.post_id === item.id).length;
                    newPost.isLiked = !!likedPosts.some((some) => some.post_id === item.id);
                  newPost.author = allUsers.filter((user) => user.id === item.author_id)[0];
                  return newPost;
                });
              })

              .catch((err) => { console.log( err); throw err });
          response.subscribers = subscribers;
          response.subCounter = subscribers.length;
          response.posts = posts.sort((a,b) => new Date(b.date) - new Date(a.date));
          res.json(response)
        })
        .catch((err) => { console.log( err); throw err });
});

// server.get('/test', async (req, res) => {
//         // await knex.from('likes_to_posts').then(rows => res.json(rows)).catch((err) => { console.log( err); throw err });
//      await knex.from('posts_in_groups').then(rows => res.json(rows)).catch((err) => { console.log( err); throw err });
// });

//добавить пост в группу
server.post('/groups/:group_id', async (req, res) => {
   await knex.from('posts_in_groups').insert({
       group_id: req.params.group_id,
       post: req.body.post,
       date: new Date(),
       author_id: jwtDecode(req.headers.authorization.slice(7)).userID })
       .then((rows) => res.sendStatus(200))
       .catch((err) => { console.log( err); throw err });
});

//добавить лайк к посту
server.post('/posts/:post_id', async (req, res) => {
    await knex.from('likes_to_posts').insert({
        post_id: req.params.post_id,
        author_id: jwtDecode(req.headers.authorization.slice(7)).userID })
        .then((rows) => res.sendStatus(200))
        .catch((err) => { console.log( err); throw err });
});

//убрать лайк
server.delete('/posts/:post_id', async (req, res) => {
    await knex.from('likes_to_posts').delete().where({
        post_id: req.params.post_id,
        author_id: jwtDecode(req.headers.authorization.slice(7)).userID })
        .then((rows) => res.sendStatus(200))
        .catch((err) => { console.log( err); throw err });
});

//получить ленту новостей
server.get('/feed', async (req, res) => {
  let groupsArray = await knex.from('groups_members').where('user_id', '=', jwtDecode(req.headers.authorization.slice(7)).userID);
  let allPosts = await knex.from('posts_in_groups');
  let allUsers = await knex.from('users');
  let likesCounter =  await knex.from('likes_to_posts');
  let likedPosts = await knex.from('likes_to_posts').where('author_id', '=', jwtDecode(req.headers.authorization.slice(7)).userID);
  let result = allPosts.filter( (post) => {
    let postData ={};
   if(groupsArray.some( group => group.group_id === post.group_id)){
     postData.isLiked = !!likedPosts.some((some) => some.post_id === post.id);
     postData.likesCounter = likesCounter.filter( fil => fil.post_id === post.id).length;
     postData.author = allUsers.filter((user) => user.id === post.author_id)[0];
     Object.assign(post, postData);
     return postData;
   }
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
  res.json(result);
});

server.listen(PORT, ()=> {console.log(`server just starting on ${PORT} port`  + '\n ')});
