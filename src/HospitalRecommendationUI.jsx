import { useState } from "react";

export default function HospitalRecommendationUI() {
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState({ lat: 37.51, lng: 127.12 });
  const [diseaseType, setDiseaseType] = useState("breast");
  const [preferences, setPreferences] = useState({
    distance: 3,
    time: 3,
    referral: 3,
    cost: 3,
    treatment: 3,
    parking: 3,
    femaleDoctor: 3,
  });
  const [results, setResults] = useState([]);

  const hospitals = [
    {
      name: "서울내외의원",
      lat: 37.5396,
      lng: 127.0939,
      attributes: {
        time: 5,
        referral: 3,
        cost: 4,
        treatment: 4,
        parking: 1,
        femaleDoctor: 0,
      },
    },
    {
      name: "가상병원 A",
      lat: 37.4900,
      lng: 127.1200,
      attributes: {
        time: 4,
        referral: 5,
        cost: 3,
        treatment: 3,
        parking: 1,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 B",
      lat: 37.5000,
      lng: 127.1000,
      attributes: {
        time: 3,
        referral: 4,
        cost: 5,
        treatment: 3,
        parking: 0,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 C",
      lat: 37.5200,
      lng: 127.1100,
      attributes: {
        time: 5,
        referral: 2,
        cost: 4,
        treatment: 4,
        parking: 1,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 D",
      lat: 37.5300,
      lng: 127.1300,
      attributes: {
        time: 2,
        referral: 3,
        cost: 3,
        treatment: 2,
        parking: 1,
        femaleDoctor: 0,
      },
    },
  ];

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSliderChange = (key, value) => {
    setPreferences({ ...preferences, [key]: value });
  };

  const geocodeAddress = async () => {
    if (!location.trim()) {
      alert("주소를 입력해주세요.");
      return;
    }

    const REST_API_KEY = "8ec7876fa13e6d7a7023181cb9759d32";
    const query = encodeURIComponent(location);
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${query}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${REST_API_KEY}`,
        },
      });
      const data = await response.json();
      if (data.documents && data.documents.length > 0) {
        const { x, y } = data.documents[0].address;
        setCoordinates({ lat: parseFloat(y), lng: parseFloat(x) });
        alert(`좌표 변환 완료!\n위도: ${y}, 경도: ${x}`);
      } else {
        alert("주소를 찾을 수 없습니다.");
      }
    } catch (error) {
      alert("주소 변환 중 오류 발생: " + error.message);
    }
  };

  const handleSubmit = () => {
    const normPref = Object.values(preferences);
    const normSum = normPref.reduce((a, b) => a + b, 0);
    const prefVector = normPref.map((v) => v / normSum);

    const scored = hospitals.map((h) => {
      const distanceVal = calculateDistance(coordinates.lat, coordinates.lng, h.lat, h.lng);
      const distanceScore = 5 - Math.min(5, distanceVal);
      const attrVector = [
        distanceScore,
        h.attributes.time,
        h.attributes.referral,
        h.attributes.cost,
        h.attributes.treatment,
        h.attributes.parking * 5,
        h.attributes.femaleDoctor * 5,
      ];
      const attrSum = attrVector.reduce((a, b) => a + b, 0);
      const normalizedAttr = attrVector.map((v) => v / attrSum);
      const score = prefVector.reduce((sum, p, i) => sum + p * normalizedAttr[i], 0);

      return {
        name: h.name,
        score: score.toFixed(3),
        distance: distanceVal.toFixed(2),
      };
    });

    setResults(scored.sort((a, b) => b.score - a.score));
  };

  return (
    <div className="container">
      <h2>환자 정보 입력</h2>
      <input
        type="text"
        placeholder="예: 서울시 강남구 테헤란로212"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="input"
      />
      <button onClick={geocodeAddress} className="button">좌표 확인</button>
      <p className="small">📍 좌표 확인됨 → 위도: {coordinates.lat}, 경도: {coordinates.lng}</p>

      <div className="section">
        <strong>질환 선택</strong><br />
        <label><input type="radio" name="disease" value="breast" checked={diseaseType === "breast"} onChange={(e) => setDiseaseType(e.target.value)} /> 유방</label>{" "}
        <label><input type="radio" name="disease" value="thyroid" checked={diseaseType === "thyroid"} onChange={(e) => setDiseaseType(e.target.value)} /> 갑상선</label>{" "}
        <label><input type="radio" name="disease" value="both" checked={diseaseType === "both"} onChange={(e) => setDiseaseType(e.target.value)} /> 유방 & 갑상선</label>
      </div>

      <h3>병원 선택 요인 중요도 평가</h3>
      {["distance", "time", "referral", "cost", "treatment", "parking", "femaleDoctor"].map((key) => {
        const labels = {
          distance: "1. 병원이 집에서 가까운 것이 중요하다",
          time: "2. 평일 저녁이나 주말에도 진료 가능한 병원을 선호한다",
          referral: "3. 진료협력센터에서 회송 실적이 많은 병원일수록 신뢰가 간다",
          cost: "4. 초음파 검사 비용이 저렴한 병원을 선호한다",
          treatment: "5. 단순 검사보다 조직검사나 치료까지 가능한 병원을 선호한다",
          parking: "6. 자가용 이용 시 주차가 가능한 병원을 선호한다",
          femaleDoctor: "7. 여의사가 진료하는 병원을 선호한다",
        };

        return (
          <div key={key} className="slider-group">
  <label className="slider-label">{labels[key]}</label>
  <div className="slider-container">
    <input
      type="range"
      min="1"
      max="5"
      step="1"
      value={preferences[key]}
      onChange={(e) => handleSliderChange(key, parseInt(e.target.value))}
    />
    <div className="slider-labels">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>{n}</span>
      ))}
    </div>
  </div>
</div>
        );
      })}

      <button onClick={handleSubmit} className="submit-button">병원 추천 받기</button>

      {results.length > 0 && (
        <div className="result-section">
          <h3>추천 결과</h3>
          {results.map((res, idx) => (
            <div key={idx} className="result-card">
              <strong>{idx + 1}위: {res.name}</strong>
              <p>점수: {res.score}</p>
              <p>거리: {res.distance}km</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
