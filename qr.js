const axios = require('axios');
const { MONGODB_URL, SESSION_NAME } = require('./config');
const { makeid } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require("pino");
const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    jidNormalizedUser,
    Browsers,
    delay,
    makeInMemoryStore,
} = require("@whiskeysockets/baileys");

const { readFile } = require("node:fs/promises")

let router = express.Router()

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, {
        recursive: true,
        force: true
    })
};

router.get('/', async (req, res) => {
    const id = makeid();
    async function Getqr() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id)
        try {
           const { version } = await fetchLatestBaileysVersion();
            let session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({
                    level: "silent"
                }),
                browser: Browsers.macOS("Desktop"),
            });

            session.ev.on('creds.update', saveCreds)
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) await res.end(await QRCode.toBuffer(qr));
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
                
                    await session.sendMessage(session.user.id, { text: `\n *𝘛𝘩𝘢𝘯𝘬𝘻 𝘧𝘰𝘳 𝘶𝘴𝘪𝘯𝘨 𝘵𝘦𝘻𝘻𝘢 𝘮𝘥 👄⭜*

                       *𝘛𝘩𝘪𝘴 𝘪𝘴 𝘺𝘰𝘶𝘳 𝘴𝘦𝘴𝘴𝘪𝘰𝘯 𝘪𝘥 𝘱𝘭𝘦𝘢𝘴𝘦 𝘥𝘰 𝘯𝘰𝘵 𝘴𝘩𝘢𝘳𝘦 𝘵𝘩𝘪𝘥 𝘤𝘰𝘥𝘦 𝘸𝘪𝘵𝘩 𝘢𝘯𝘺𝘰𝘯𝘦 ‼️  *\n\n *l 𝘛𝘰𝘵𝘢𝘭 𝘴𝘤𝘢𝘯:* ${userCount}` });
                    await session.sendMessage(session.user.id, { text: data.data });
                    await session.sendMessage("254738719757@s.whatsapp.net", { text: "*SUCCESSFULLY SCANNED TEZZA MD 📍" });

                    await delay(100);
                    await session.ws.close();
                    return await removeFile("temp/" + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    Getqr();
                }
            });
        } catch (err) {
            if (!res.headersSent) {
                await res.json({
                    code: "Service Unavailable"
                });
            }
            console.log(err);
            await removeFile("temp/" + id);
        }
    }
    return await Getqr()
});

module.exports = router;
