import { useState, useEffect } from "react";
import Papa from "papaparse";

export default function useHospitalsFromSheet(sheetUrl) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Boolean 유틸 함수 개선: 다양한 표현 허용
    const parseBoolean = (val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val !== 0;
      if (typeof val === "string") {
        const normalized = val.trim().toLowerCase();
        return ["y", "yes", "true", "1", "가능", "있음"].includes(normalized);
      }
      return false;
    };

    // ✅ Price 유틸 함수 개선: 숫자 외 문자를 제거하고 숫자로 변환
    const parsePrice = (val) => {
      if (typeof val === "number") return val;
      const num = Number(String(val).replace(/[^0-9]/g, ""));
      return isNaN(num) ? null : num;
    };

    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleaned = results.data.map((row) => ({
          name: row["병원명"],
          type: row["진료과목"],
          level: row["병원구분"],
          address: row["주소"],
          phone: row["전화번호"],
          homepage: row["홈페이지주소"],
          lat: parseFloat(row["위도"]),
          lng: parseFloat(row["경도"]),
          timeText: row["영업시간"],
          availability: row["영업시간"],

          // ✅ Boolean 처리
          hasParking: parseBoolean(row["주차가능"]),
          hasFemaleDoctor: parseBoolean(row["여의사진료여부"]),
          hasMammotome: parseBoolean(row["맘모톰(VABE)"]),
          hasThyroidRFA: parseBoolean(row["갑상선고주파열치료"]),
          hasBreastBiopsy: parseBoolean(row["유방조직검사"]),          
          hasThyroidBiopsy: parseBoolean(row["갑상선조직검사"]),

          // ✅ Price 처리
          breastUltrasoundPrice: parsePrice(row["유방초음파가격"]),
          thyroidUltrasoundPrice: parsePrice(row["갑상선초음파가격"]),

          referralCount: parseInt(row["회송이력"]) || 0,
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