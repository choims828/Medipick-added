import { useState, useEffect } from "react";
import Papa from "papaparse";

export default function useHospitalsFromSheet(sheetUrl) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleaned = results.data.map((row) => ({
  name: row["병원명"],
  type: row["진료과목"], // 추천 필터 기준
  level: row["병원구분"], // 의원, 병원 등 구분
  address: row["주소"],
  phone: row["전화번호"],
  homepage: row["홈페이지주소"],
  lat: parseFloat(row["위도"]),
  lng: parseFloat(row["경도"]),
  timeText: row["야간,주말(6pm이후)"],
  hasParking: row["주차가능"] === "Y",
  hasFemaleDoctor: row["여의사진료여부"] === "Y",
  hasMammotome: row["맘모톰(VABB)"] === "Y",
  hasThyroidRFA: row["갑상선 고주파열치료"] === "Y",
  breastUltrasoundPrice: parseInt((row["유방초음파가격"] ?? "").replace(/[^0-9]/g, "")) || null,
  thyroidUltrasoundPrice: parseInt((row["갑상선초음파가격"] ?? "").replace(/[^0-9]/g, "")) || null,
  referralCount: parseInt(row["회송실적"]) || 0,
}));
        setHospitals(cleaned);
        setLoading(false);
      },
      error: (err) => {
        console.error("CSV 파싱 에러:", err);
        setLoading(false);
      },
    });
  }, [sheetUrl]);

  return { hospitals, loading };
}
