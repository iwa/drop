import dotenv from 'dotenv';
dotenv.config();

import { totp } from 'speakeasy';
import { Storage } from '@google-cloud/storage';
import express from 'express';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import cookieParser from 'cookie-parser';
const app = express();
const port = process.env.PORT || 8080;

const storage = new Storage({ keyFilename: './google-cloud-key.json' });
const bucketName = process.env.BUCKETNAME;

app.use(express.static(`${process.env.DIRPATH}public`));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({ createParentPath: true }));
app.use(cookieParser(process.env.COOKIESECRET));

process.on('uncaughtException', exception => {
    console.error(exception);
});


app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');

    let connected = false;

    if(req.signedCookies.token)
        connected = true;

    res.render('main.ejs', { connected });
    res.status(200);
});

app.post('/up', async (req, res) => {
    if(req.signedCookies.token) {
        try {
            if(!req.files || Object.keys(req.files).length === 0) {
                res.send({
                    status: false,
                    message: 'No file uploaded'
                });
            } else {
                let file: any = req.files.file;

                file.mv(`./upload/${file.name}`);
                await storage.bucket(bucketName).upload(`upload/${file.name}`, { destination: `drop/${file.name}`, private: true });

                res.send({
                    status: true,
                    message: 'File is uploaded',
                    data: {
                        name: file.name,
                        mimetype: file.mimetype,
                        size: file.size
                    }
                });
            }
        } catch (err) {
            res.status(500).send(err);
        }
    } else
        res.redirect('/');
});

app.post('/co', (req, res) => {
    if (!req.body.token) return res.sendStatus(400);

    let token = req.body.token;
    let resToken = verifyToken(token, process.env.BASE32_TOKEN) || false;

    if(resToken)
        res.cookie('token', token, { maxAge: 2 * 60 * 1000, httpOnly: true, signed: true, secure: false });

    res.redirect('/');
});

app.use((req, res) => {
    res.sendStatus(404);
});

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});


function verifyToken (userToken: string, serverSecret: string) {
    const verified = totp.verify({
        secret: serverSecret,
        encoding: 'base32',
        token: userToken
    });
    return verified;
}