require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { graphqlHTTP } = require('express-graphql');
const bodyParser = require('body-parser');
const schema = require('./schema/index')
const multer = require('multer');
const db = require("./database/db");
const { eventEmitter } = require('./emitter');
const  nodemailer = require('nodemailer');
const port = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(`${__dirname}/public`));
app.use(express.json({ limit: '10mb' }));
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASSWORD,
    },
});
app.use(async (req, res, next) => {
    try {
        // Extract JWT token from request header
        const token = req.headers.authorization;

        if (token) {
            const user = await new Promise((resolve, reject) => {
                jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
                    if (err) {
                        reject(new Error('Token verification failed'));
                        return;
                    }
                    resolve(decoded);
                });
            });

            // Verify if user exists in the database
            const userFromDB = await new Promise((resolve, reject) => {
                db.query(
                    `SELECT * FROM users WHERE email = '${user.email}' and password = '${user.password}'`,
                    (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (!rows[0]) {
                            reject(new Error('User not found'));
                            return;
                        }
                        resolve(rows[0]);
                    }
                );
            });

            // Attach user email to the request object

            req.user = userFromDB.email;
        }
    } catch (error) {
        console.error(error);
        return res.sendStatus(403);
    }
    next();
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/files')

    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})
const upload = multer({ storage:storage });


// Registering to myEvent
eventEmitter.on('notification', (msg) => {

    const mailData = {
        from: 'aalhad.a20@iiits.in',  // sender address
        to: msg.email,
        subject: 'You are added to a journal entry',
        text: `Hey user${msg.id}!`,
        html: '<div style="background-color: #f4f4f4; padding: 20px; text-align: center;">\n' +
            '            <h1 style="color: #333;">Journal Entry Notification</h1>\n' +
            '            <p style="color: #777;">Hello user,</p>\n' +
            '            <p style="color: #777;">You have been tagged in a journal entry!</p>\n' +
            '            <p style="color: #777;">Click the link below to view the post:</p>\n' +
            '            <a href="URL_TO_JOURNAL_ENTRY" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none;">View Journal Entry</a>\n' +
            '            <p style="color: #777;">Best regards,</p>\n' +
            '            <p style="color: #777;">Your Team</p>\n' +
            '        </div>',
    };
    transporter.sendMail(mailData, function (err, info) {
        if(err)
            console.log(err)
        else
            console.log(msg + ' user notified');
    });

});



app.use('/graphql', graphqlHTTP((req,res,graphQLParams)=>{

    return{
        graphiql:process.env.NODE_ENV === 'development',
        schema,
        context:{
            user:req.user
        },

    }

}));

app.post("/uploadFile", upload.single("myFile"), async (req, res) => {
    const url = "http://localhost:3000/files/" + req.file?.filename
    if(!req.file){
        //add file in attachments table
        if(req.body?.type == 'url') {
            const result = await new Promise((resolve, reject) => {
                db.query(
                    `INSERT INTO attachments (journal_id, type, url) VALUES ('${req.body?.journal_id}','${req.body?.type}','${req.body?.url}')`,
                    (err, rows, fields) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(rows);
                    }
                );
            })


            if (result) {
                res.send({message: "URL Uploaded Successfully"}).status(200);
            }
        }

    }
    else
    {
        //add file in attachments table
        const result =  await new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO attachments (journal_id, type, url) VALUES ('${req.body.journal_id}','${req.body.type}','${url}')`,
                (err, rows, fields) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows);
                }
            );
        })

        if(result){
            res.send({message:"File Uploaded Successfully"}).status(200);
        }
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
