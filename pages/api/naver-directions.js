import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";

export default async function handler(req, res) {
  const { start, goal } = req.query;

  const url = `https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${start}&goal=${goal}`;

  const CLIENT_ID ="oqvjth21cz";
  const CLIENT_SECRET = "0HbkVan5DXmAPe7IoFa3iB1kMvWYMDhrwoxZBpHO";

  try {
    const response = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": "oqvjth21cz",
        "X-NCP-APIGW-API-KEY": "0HbkVan5DXmAPe7IoFa3iB1kMvWYMDhrwoxZBpHO"
      }
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Naver API 호출 실패:", error);
    res.status(500).json({ error: "Naver API 호출 실패" });
  }
}