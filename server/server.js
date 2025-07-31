import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const CLIENT_ID = "oqvjth21cz";
const CLIENT_SECRET = "0HbkVan5DXmAPe7IoFa3iB1kMvWYMDhrwoxZBpHO";

app.get("/naver-directions", async (req, res) => {
  const { start, goal } = req.query;
  const url = `https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${start}&goal=${goal}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": "oqvjth21cz",
        "X-NCP-APIGW-API-KEY": "0HbkVan5DXmAPe7IoFa3iB1kMvWYMDhrwoxZBpHO",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ 네이버 API 오류 [${response.status}]:`, text);
      return res.status(response.status).json({ error: "네이버 API 응답 실패", detail: text });
    }

    // ✅ 네이버 API 에러 응답 처리 추가
if (data.error) {
  console.warn("📛 네이버 API 에러 응답:", data.error.message);
  return res.status(400).json({ error: data.error.message });
}

console.log("📦 네이버 API 응답:", JSON.stringify(data, null, 2));
res.json(data);
  } catch (error) {
    console.error("Naver API 호출 실패:", error);
    res.status(500).json({ error: "Naver API 호출 실패" });
  }
});

app.listen(3000, () => {
  console.log("🚀 백엔드 서버 실행 중: http://localhost:3000");
});