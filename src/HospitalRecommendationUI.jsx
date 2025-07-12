import { useState, useEffect, useRef } from "react";

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
  const mapRef = useRef(null);

  const hospitals = [
    {
      name: "서울내외의원",
      type: "유방&갑상선",
      lat: 37.5396,
      lng: 127.0939,
      timeText: "주말",
      attributes: {
        referral: 3,
        cost: 4,
        treatment: 4,
        parking: 1,
        femaleDoctor: 0,
      },
    },
    {
      name: "가상병원 A",
      type: "유방",
      lat: 37.49,
      lng: 127.12,
      timeText: "야간,주말",
      attributes: {
        referral: 5,
        cost: 3,
        treatment: 3,
        parking: 1,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 B",
      type: "갑상선",
      lat: 37.5,
      lng: 127.1,
      timeText: "평일",
      attributes: {
        referral: 4,
        cost: 5,
        treatment: 3,
        parking: 0,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 C",
      type: "유방&갑상선",
      lat: 37.52,
      lng: 127.11,
      timeText: "야간,주말",
      attributes: {
        referral: 2,
        cost: 4,
        treatment: 4,
        parking: 1,
        femaleDoctor: 1,
      },
    },
    {
      name: "가상병원 D",
      type: "갑상선",
      lat: 37.53,
      lng: 127.13,
      timeText: "야간",
      attributes: {
        referral: 3,
        cost: 3,
        treatment: 2,
        parking: 1,
        femaleDoctor: 0,
      },
    },
  ];

  const calculateTimeScore = (text) => {
    if (!text) return 1;
    const lower = text.toLowerCase();
    if (lower.includes("야간") && lower.includes("주말")) return 5;
    if (lower.includes("주말")) return 4;
    if (lower.includes("야간")) return 3;
    if (lower.includes("평일")) return 2;
    return 1;
  };

  // 🔥 회송 점수 정규화 함수 추가
  const calculateReferralScore = (count) => {
    const min = 0;
    const max = 374;
    const normalized = (count - min) / (max - min);
    return 1 + normalized * 4;
  };

  const diseaseMatches = (userType, hospitalType) => {
    if (userType === "both") return true;
    if (userType === "breast") return hospitalType === "유방" || hospitalType === "유방&갑상선";
    if (userType === "thyroid") return hospitalType === "갑상선" || hospitalType === "유방&갑상선";
    return false;
  };

  const getRouteInfo = async (startLat, startLng, endLat, endLng) => {
    const url = `https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${startLng},${startLat}&goal=${endLng},${endLat}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": "oqvjth21cz",
        "X-NCP-APIGW-API-KEY": "0HbkVan5DXmAPe7IoFa3iB1kMvWYMDhrwoxZBpHO",
      },
    });
    const data = await response.json();
    if (data.route && data.route.traoptimal) {
      const { distance, duration } = data.route.traoptimal[0].summary;
      return {
        distance: (distance / 1000).toFixed(2),
        time: Math.round(duration / 60),
      };
    }
    return null;
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

  const handleSubmit = async () => {
    const normPref = Object.values(preferences);
    const normSum = normPref.reduce((a, b) => a + b, 0);
    const prefVector = normPref.map((v) => v / normSum);

    const filteredHospitals = hospitals.filter(h => diseaseMatches(diseaseType, h.type));
    const scored = [];

    for (const h of filteredHospitals) {
      const route = await getRouteInfo(coordinates.lat, coordinates.lng, h.lat, h.lng);
      if (!route) continue;

      const timeScore = calculateTimeScore(h.timeText);

      // 🔥 회송 실적 점수 정규화 (임시로 40건 적용)
      const referralScore = calculateReferralScore(40);

      const attrVector = [
        5 - Math.min(5, route.distance),
        5 - Math.min(5, route.time / 10),
        timeScore,
        referralScore,
        h.attributes.cost,
        h.attributes.treatment,
        h.attributes.parking * 5,
        h.attributes.femaleDoctor * 5,
      ];

      const attrSum = attrVector.reduce((a, b) => a + b, 0);
      const normalizedAttr = attrVector.map((v) => v / attrSum);
      const score = prefVector.reduce((sum, p, i) => sum + p * normalizedAttr[i], 0);

      scored.push({
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        score: score.toFixed(3),
        distance: route.distance,
        time: route.time,
      });
    }

    setResults(scored.sort((a, b) => b.score - a.score));
  };

  useEffect(() => {
    const { naver } = window;
    if (!naver || !mapRef.current || results.length === 0) return;

    const map = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(results[0].lat, results[0].lng),
      zoom: 12,
    });

    results.forEach((res) => {
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(res.lat, res.lng),
        map,
        title: res.name,
      });

      const infoWindow = new naver.maps.InfoWindow({
        content: `
          <div style="padding:10px; font-size:14px;">
            <strong>${res.name}</strong><br />
            점수: ${res.score}<br />
            거리: ${res.distance}km<br />
            시간: ${res.time}분
          </div>
        `,
      });

      naver.maps.Event.addListener(marker, "click", () => {
        infoWindow.open(map, marker);
      });
    });
  }, [results]);

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
              <p>소요 시간: {res.time}분</p>
            </div>
          ))}
          <div id="map" ref={mapRef} style={{ width: "100%", height: "400px", marginTop: "20px" }}></div>
        </div>
      )}
    </div>
  );
}
