import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import NodeCache from "node-cache";
dotenv.config();

const app = express();
const cache = new NodeCache();
const port = process.env.PORT || 3000;

async function getToken() {
  if (cache.has("token")) return cache.get("token");

  const auth = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString("base64");
  const res = await axios.post("https://api.insee.fr/token", "grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
  });

  const token = res.data.access_token;
  cache.set("token", token, 3600); // 1h
  return token;
}

app.get("/api/verifier", async (req, res) => {
  const siren = req.query.siren;
  if (!/^[0-9]{9}$/.test(siren)) {
    return res.status(400).json({ error: "SIREN invalide" });
  }

  try {
    const token = await getToken();
    const inseeRes = await axios.get(
      `https://api.insee.fr/entreprises/sirene/V3/unites_legales/${siren}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const unite = inseeRes.data.unite_legale;
    const cle = (12 + 3 * (parseInt(siren) % 97)) % 97;
    const tva = "FR" + cle.toString().padStart(2, "0") + siren;

    res.json({ siren, tva, unite_legale: unite });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log("✅ API SIREN backend prêt sur port " + port);
});
