const express = require('express');

const router = express.Router();
const auth = require('../../middleware/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const getConnection = require('./dbConnection');
const {check, validationResult} = require('express-validator/check');


router.get('/', async (req, res) => {
   try {
      // getConnection().query()
       res.render('registration');
   } catch (e) {
       console.log("ooops - it was error: " + e.message);
       res.send('FATAL!');
   }
});

router.post('/',
    [
        check("firstname", "Enter the name").exists(),
        check("email", "Enter a valid email").isEmail(),
        check("password", "Pswd is required").exists(),
],
    async (req, res) => {

        console.log(req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log({errors: errors.array()});
            return res.send('FATAL');
        }
        try {
        const {firstname, email, password} = req.body;
        const user = await getConnection().query("SELECT email = (?) FROM users", [email], (error, result) => {
            if (error) {
                console.log(('FATAL SQL' + error.message));
                res.end();
            }
            if (result.length > 0) {
                //  const err = new Error();
                console.log((result));
                //  err.message = "FATAL";
                res.send('USER EXIST');
            }
        });

        await getConnection().query("INSERT INTO users (firstname, email, password) VALUES (?, ?, ?)", [firstname, email, password]);
        res.send('ok');
    } catch (e) {
        console.log("ooops - it was error: " + e.message);
        res.send('FATAL!');
    }
});

module.exports = router;