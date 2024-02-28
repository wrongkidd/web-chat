const express = require('express');
const admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const cors = require('cors');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());

var key = process.env.P_KEY;

admin.initializeApp({
    credential: admin.credential.cert({
        "private_key": key.replace(/\\n/g, '\n'),
        "client_email": process.env.CLIETNT_EMAIL,
        "project_id": process.env.PID
    })
})

const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};
const httpsServer = https.createServer(options, app);

const io = require('socket.io')(httpsServer);
const path = require('path');

const port = 3000;

app.use(express.static(path.join(__dirname, "./public")));

app.get("/", (req, res) => {
    res.sendFile("index.html");
});

app.get("/test", (req, res) => {
    res.send(`<h1>API Test complete</h1>`);
});

app.get('/logout', (req, res) => {
    res.clearCookie('__session');
    res.redirect('/');
});

app.get('/success', checkCookie, (req, res) => {
    console.log("UID of Signed in User is"
        + req.decodedClaims.uid);
    res.sendFile(__dirname + '/public/home.html');
});

app.get('/savecookie', (req, res) => {
    const Idtoken = req.query.idToken;
    savecookie(Idtoken, res);
});

function savecookie(idtoken, res) {

    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    admin.auth().createSessionCookie(idtoken, { expiresIn })
        .then((sessionCookie) => {
            const options = { maxAge: expiresIn, httpOnly: true, secure: true };
            res.cookie('__session', sessionCookie, options);
            admin.auth().verifyIdToken(idtoken).then(function (decodedClaims) {
                res.redirect('/success');
            });

        }, error => {
            console.log(error);
            res.status(401).send("UnAuthorised Request");
        });
}

function checkCookie(req, res, next) {
    const sessionCookie = req.cookies.__session || '';
    admin.auth().verifySessionCookie(
        sessionCookie, true).then((decodedClaims) => {
            req.decodedClaims = decodedClaims;
            next();
        })
        .catch(error => {
            res.redirect('/');
        });
}

var users = {};
io.on("connection", socket => {
    socket.on('join-chat', (username, email, photo) => {
        const existingUser = users.hasOwnProperty(socket.id);

        if (!existingUser) {
            const userDetails = { 'name': username, 'email': email, 'photo': photo };
            users[socket.id] = userDetails;
            const singleUserDetails = {};
            singleUserDetails[socket.id] = userDetails;

            socket.broadcast.emit("update-user-list", {
                users: [socket.id],
                userDetails: singleUserDetails,
            });
            let userListEpxect = {};
            userListEpxect = Object.keys(users).filter(id => id !== socket.id);

            const allUserDetails = {};

            userListEpxect.forEach(socketId => {
                if (users.hasOwnProperty(socketId)) {
                    allUserDetails[socketId] = users[socketId];
                }
            });
            socket.emit("update-user-list", {
                users: userListEpxect,
                userDetails: allUserDetails,
            });
        } else {
            console.log("Exisiting user");
        }
    });

    socket.on('chat message', (msg) => {
        const username = users[socket.id]['name'];
        io.emit('chat message', { username, msg }); // Broadcast message to all
    });
    socket.on("call-user", (data) => {
        socket.to(data.to).emit("call-made", {
            offer: data.offer,
            socket: socket.id,
            userdata: users[socket.id]
        });
    });
    socket.on("make-answer", data => {
        socket.to(data.to).emit("answer-made", {
            socket: socket.id,
            answer: data.answer
        });
    });
    socket.on("reject-call", data => {
        socket.to(data.from).emit("call-rejected", {
            socket: socket.id,
            userdata: users[socket.id]
        });
    });
    socket.on("disconnect", () => {
        let socketIdToRemove = {};
        socketIdToRemove = Object.keys(users).filter(id => id !== socket.id);
        const remSocketIdDetails = {};

        socketIdToRemove.forEach(socketId => {
            if (users.hasOwnProperty(socketId)) {
                remSocketIdDetails[socketId] = users[socketId];
            }
        });
        users = remSocketIdDetails;
        socket.broadcast.emit("remove-user", {
            socketId: socket.id
        });
    });
});

httpsServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// https.createServer(options, app).listen(port, () => {
//     console.log(`Server listening on port ${port}`);
// });
