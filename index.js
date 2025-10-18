import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GROq_API_KEY = process.env.GROQ_API_KEY;

// ✅ Route pour vérifier le webhook Messenger (obligatoire pour Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook vérifié avec succès !");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ Réception des messages Messenger
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const userMessage = webhookEvent.message.text;
        console.log("💬 Message reçu :", userMessage);

        // 📡 Appel Groq (Llama 3)
        const botReply = await callGroq(userMessage);

        // 💬 Envoi réponse Messenger
        await sendMessage(senderId, botReply);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// ✅ Fonction : Appel Llama 3 via Groq Cloud
async function callGroq(userText) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROq_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "Tu es un assistant utile et clair." },
          { role: "user", content: userText }
        ]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Désolé, je n'ai pas compris.";
  } catch (error) {
    console.error("❌ Erreur Groq :", error);
    return "Erreur du serveur IA 🤖";
  }
}

// ✅ Fonction : envoyer la réponse à Messenger
async function sendMessage(senderId, text) {
  await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text }
    })
  });
}

app.get("/", (_, res) => res.send("✅ Bot Messenger + Groq en ligne !"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur prêt sur port ${PORT}`));
