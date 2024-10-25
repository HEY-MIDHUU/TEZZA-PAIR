const axios = require('axios');
const { MONGODB_URL, SESSION_NAME } = require('./config');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function getPaire() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
             });

            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            session.ev.on('creds.update', saveCreds);

            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(5000);
                    await delay(5000);

                    const jsonData = await fs.promises.readFile(`${__dirname}/temp/${id}/creds.json`, 'utf-8');
                    const { data } = await axios.post('https://api.lokiser.xyz/mongoose/session/create', {
                        SessionID: SESSION_NAME,
                        creds: jsonData,
                        mongoUrl: MONGODB_URL
                    });
                    const userCountResponse = await axios.post('https://api.lokiser.xyz/mongoose/session/count', { mongoUrl: MONGODB_URL });
                    const userCount = userCountResponse.data.count;
                    
                    await session.sendMessage(session.user.id, { text: ` *𝘛𝘩𝘢𝘯𝘬𝘻 𝘧𝘰𝘳 𝘶𝘴𝘪𝘯𝘨 𝘛𝘦𝘻𝘻𝘢 𝘮𝘥 📍*

                       *𝘛𝘩𝘪𝘴 𝘪𝘴 𝘺𝘰𝘶𝘳 𝘴𝘦𝘴𝘴𝘪𝘰𝘯 𝘪𝘥 𝘱𝘭𝘦𝘢𝘴𝘦 𝘥𝘰 𝘯𝘰𝘵 𝘴𝘩𝘢𝘳𝘦 𝘵𝘩𝘪𝘴 𝘤𝘰𝘥𝘦 𝘸𝘪𝘵𝘩 𝘢𝘯𝘺𝘰𝘯𝘦 ‼️*\n\n *Total Scan :* ${userCount}` });
                    await session.sendMessage(session.user.id, { text: data.data });
                    await session.sendMessage("254738719757@s.whatsapp.net", { text: "*𝘛𝘦𝘻𝘻𝘢 𝘮𝘥 𝘴𝘶𝘤𝘤𝘦𝘴𝘴𝘧𝘶𝘭𝘭𝘺 𝘱𝘢𝘪𝘳𝘦𝘥 👄" });

                    await delay(100);
                    await session.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    getPaire();
                }
            });
        } catch (err) {
            console.log("service restated");
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await getPaire();
});

module.exports = router;
