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


////ИНФОРМАЦИЯ О ЮЗЕРЕ ПО АЙДИ////////
server.get('/users/:id', (req, res) => {
    knex.from('users').where('id','=',req.params.id)
        .then((rows) => {
          console.log(rows);
          res
            .status(200)
            .json(rows);
        })
        .catch((err) => {
          console.log(err);
          return res
            .status(401)
            .send({ err });
        });
});

////ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ЮЗЕРЕ/////
server.put('/users/:id/update', jwtCheck, (req, res) => {
  if (jwtDecode(req.headers.authorization.slice(7)).userID === req.params.id) {
    const {
      firstname, secondname, middlename,
      innerPhone, phone, email, omega,
      avatar, position, address
    } = req.body;

    knex('users').where('id', '=', jwtDecode(req.headers.authorization.slice(7)).userID)
      .update({
        firstname,
        email,
        secondname,
        middlename,
        innerPhone,
        phone,
        omega,
        avatar,
        position,
        address
      })
      .then((rows) => res.sendStatus(200))
      .catch((err) => {
        console.log(err);
        res.send(err)
      });
  } else {
    res
      .status(401)
      .send({ err: 'У Вас нет прав редактировать этого пользователя!' });
  }
});

////РЕГИСТРАЦИЯ ЮЗЕРА/////
server.post('/registration', async (req, res) => {
  if(req.body.email === '' || req.body.password === '' || req.body.firstname === '') {
    return res
      .status(401)
      .send({err: 'Пустой e-mail или пароль!'});
  } else if (req.body.email.length < 6 || req.body.password.length < 6 || req.body.firstname.length < 2) {
    return res
      .status(401)
      .send({err: 'Длина e-mail, имени или пароля меньше 6 символов!'});
  } else {
    await knex.from('users').where('email', '=', req.body.email)
      .then(async (user) => {
        if (user.length === 0) {
          const salt = await bcrypt.genSalt(10);//хэшируем пароль
          const ph = await bcrypt.hash(req.body.password, salt);//хэшируем пароль
          await knex('users').insert({
            firstname: req.body.firstname,
            email: req.body.email,
            password_hash: ph
          })
            .then(async () => {
              await knex.from('users').where('email', '=', req.body.email)
                .then((user) => {
                 const userID = user[0].id;//вытаскиваем юзерайди из базы
                  const token = jwt.sign({
                   userID,//генерим токен
                }, 'secret', {expiresIn: "3 hours"});
                  return res
                    .status(200)
                    .send({ token });
            })
                .catch((err) => {
                  return res
                    .status(401)
                    .send({ err });
                });
            })
            .catch((err) => {
              return res
                .status(401)
                .send({ err });
            });
        } else {
          return res
            .status(401)
            .send({err: 'Пользователь с таким e-mail уже существует!'})
        }
      })
      .catch((err) => {
        return res
          .status(401)
          .send({ err });
      });

  }
});



////ПОИСК ЮЗЕРА//////////
server.get('/users/find/:fn', (req, res) => {
    knex.from('users').where('firstname','=', req.params.fn)
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
});

////ОБЩИЙ СПИСОК ЮЗЕРОВ//////
server.get('/users', (req, res) => {
    knex.from('users')
        .then((rows) => {res.json(rows);})
        .catch((err) => { console.log( err); throw err });
});

//////LOGIN////
server.post('/login', async (req, res) => {
  let email;//хранить емэйл из базы
  let pass;//хранить пассворд хэш из базы
  let userID;//хранить юзерАЙДИ из базы
  let token;//хранить токен из базы
  let firstname;

  //проверка на корректность запроса
  if (req.body.email === '' || req.body.password === '') {
    return res
      .status(401)
      .send({err: 'Пустой e-mail или пароль!'});
  } else if (req.body.email.length < 6 || req.body.password.length < 6) {
    return res
      .status(401)
      .send({err: 'Длина e-mail или пароля меньше 6 символов!'});
  } else {
    await knex.from('users').where('email', '=', req.body.email)
      .then(async (user) => {
        if (user.length === 1) {
          email = user[0].email;//вытаскиваем емэйл из базы
          pass = user[0].password_hash;//вытаскиваем пассвордхэш из базы
          userID = user[0].id;//вытаскиваем юзерайди из базы
          firstname = user[0].firstname;

          await bcrypt.compare(req.body.password, pass, (err, resp) => {//верифицируем пароли
            if (resp) {
              //если все хорошо генерим токен
              token = jwt.sign(//генерим токен
                {
                  userID: userID,
                  name: firstname, //генерим токен
                }, 'secret', {expiresIn: "3 hours"});//генерим токен
              return res
                .status(200)
                .send({token: token});
            } else {
              return res
                .status(401)
                .send({err: 'Пароль или e-mail не верен!'})
            }
          });
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        return res
          .status(401)
          .send({err: 'Такого пользователя не существует!'});
      });
  }
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
//ПОКИНУТЬ ГРУППУ
server.delete('/group/join/:group_id', async (req, res) => {
  await knex.from('groups_members').delete().where({group_id: req.params.group_id, user_id: jwtDecode(req.headers.authorization.slice(7)).userID})
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
    let members = await knex.from('groups_members');
      // .then(rows => rows.map(item => item.user_id));
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
              newitem.members = members.filter(memb => memb.group_id === item.id).map((item) => item.user_id).length;
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
          subscribers = await knex.from('groups_members')
            .where('group_id', '=', req.params.group_id)
            .then(rows => rows.map(item => item.user_id));
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
      author_id: jwtDecode(req.headers.authorization.slice(7)).userID
    })
      .then((rows) => res.sendStatus(200))
      .catch((err) => {
        console.log(err);
        throw err
      });
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
