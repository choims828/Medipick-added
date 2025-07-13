import useHospitalsFromSheet from "./Hooks/useHospitalsFromSheet";
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

const sheetUrl = "https://docs.google.com/spreadsheets/d/1oL7RKKOMTw0f_pR9xhbkE8bA2VjzTvqIPKvO9Nddrnk/export?format=csv";
const { hospitals, loading } = useHospitalsFromSheet(sheetUrl);


  const calculateTimeScore = (text) => {
    if (!text) return 1;
    const lower = text.toLowerCase();
    if (lower.includes("야간") && lower.includes("주말")) return 5;
    if (lower.includes("주말")) return 4;
    if (lower.includes("야간")) return 3;
    if (lower.includes("평일")) return 2;
    return 1;
  };

 // 🔥 회송 점수 정규화 함수
const calculateReferralScore = (count) => {
  const min = 0;
  const max = 374;
  const normalized = (count - min) / (max - min);
  return 1 + normalized * 4;
};

// 🔍 초음파 비용 점수 (저렴할수록 높음)
const calculateUltrasoundScore = (price, minPrice, maxPrice) => {
  if (typeof price !== "number" || isNaN(price)) {
    console.warn(`초음파 가격 정보 누락 또는 잘못된 값: ${price}`);
    return 3;
  }
  const normalized = (maxPrice - price) / (maxPrice - minPrice);
  return 1 + normalized * 4;
};

// 🏥 치료 가능 여부 점수
const calculateTreatmentScore = (hospital, diseaseType) => {
  const mammotome = hospital.hasMammotome === true;
  const rfa = hospital.hasThyroidRFA === true;

  if (diseaseType === "breast") return mammotome ? 5 : 3;
  if (diseaseType === "thyroid") return rfa ? 5 : 3;
  if (diseaseType === "both") {
    if (mammotome && rfa) return 5;
    if (mammotome || rfa) return 4;
    return 3;
  }
  return 3;
};

// 🚗 주차 가능 여부 점수
const calculateParkingScore = (hasParking) => {
  return hasParking === 1 || hasParking === true ? 5 : 1;
};

// 👩‍⚕️ 여의사 여부 점수
const calculateFemaleDoctorScore = (hasFemaleDoctor) => {
  return hasFemaleDoctor === 1 || hasFemaleDoctor === true ? 5 : 1;
};

// 🩺 질환 유형과 병원 진료과 일치 여부
const diseaseMatches = (userType, hospitalTypeRaw) => {
  const hospitalType = (hospitalTypeRaw || "").replace(/\s/g, "").toLowerCase(); // 공백 제거 후 소문자화

  if (userType === "both") return true;
  if (userType === "breast") return hospitalType.includes("유방");
  if (userType === "thyroid") return hospitalType.includes("갑상선");
  return false;
};

  const getRouteInfo = async (startLat, startLng, endLat, endLng) => {
  const url = `/naver-directions?start=${startLng},${startLat}&goal=${endLng},${endLat}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    // ✅ API 에러 응답 확인
    if (data.error) {
      console.warn("⚠️ API 에러 응답:", data.error);
      return null;
    }

    // ✅ 요약 정보 유효성 체크
    const summary = data?.route?.traoptimal?.[0]?.summary;
    if (!summary || summary.distance == null || summary.duration == null) {
      console.warn("⚠️ 요약 정보 없음:", data);
      return null;
    }

    // ✅ 요약 정보 추출해서 반환
    return {
      distance: summary.distance / 1000, // → km 단위 변환
      time: summary.duration / 60000     // → 분 단위 변환
    };
  } catch (error) {
    console.error("경로 정보 요청 실패:", error, { startLat, startLng, endLat, endLng });
    return null;
  }
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
  if (loading || !hospitals.length) {
    alert("병원 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  console.log("📦 병원 전체 개수:", hospitals.length);

  // 🧪 병원 데이터 구조 확인용 로그
  console.log("🧪 샘플 병원 데이터:", hospitals[0]);
  
  hospitals.slice(0, 10).forEach((h, i) => {
    console.log(`🏥 병원 ${i + 1}: ${h.name}, type: "${h.type}"`);
  });


  // 🎯 선호도 벡터 정규화
  const normPref = Object.values(preferences);
  const normSum = normPref.reduce((a, b) => a + b, 0);
  const prefVector = normPref.map((v) => v / normSum);
  console.log("🧮 정규화된 선호도 벡터:", prefVector);

  // ✅ 병원 필터링 먼저
  const filteredHospitals = hospitals
    .filter(h =>
  diseaseMatches(diseaseType, h.type) &&
  h.lat && h.lng && !isNaN(h.lat) && !isNaN(h.lng)
)
    .slice(0, 10); // 최대 10개 병원만 테스트

  console.log("✅ 필터링된 병원 수:", filteredHospitals.length);
  if (filteredHospitals.length === 0) {
    alert("해당 조건에 맞는 병원이 없습니다.");
    return;
  }

  // 📉 초음파 비용 정규화용 min/max 계산
  const ultrasoundPrices = filteredHospitals
    .map(h => {
      if (diseaseType === "breast") return h.breastUltrasoundPrice;
      if (diseaseType === "thyroid") return h.thyroidUltrasoundPrice;
      return Math.max(h.breastUltrasoundPrice ?? 0, h.thyroidUltrasoundPrice ?? 0);
    })
    .filter(p => typeof p === "number" && !isNaN(p));

  let minPrice = 100000, maxPrice = 100000;
  if (ultrasoundPrices.length > 0) {
    minPrice = Math.min(...ultrasoundPrices);
    maxPrice = Math.max(...ultrasoundPrices);
  }
  console.log("💰 초음파 가격 범위:", { minPrice, maxPrice });

  const scored = [];

  for (const h of filteredHospitals) {
  console.log("📍 병원 처리 중:", h.name);
  console.log("병원 좌표 확인:", h.name, h.lat, h.lng);

  // 🔧 좌표 없으면 주소로 변환 시도
  if (!h.lat || !h.lng) {
    try {
      const geo = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(h.address)}`, {
        headers: {
          Authorization: `KakaoAK 8ec7876fa13e6d7a7023181cb9759d32`,
        },
      }).then(res => res.json());

      if (geo.documents && geo.documents.length > 0) {
        h.lat = parseFloat(geo.documents[0].y);
        h.lng = parseFloat(geo.documents[0].x);
        console.log(`📍 주소 → 좌표 변환 성공: ${h.name} →`, h.lat, h.lng);
      } else {
        console.warn("📌 병원 주소 변환 실패 → 제외:", h.name);
        continue;
      }
    } catch (err) {
      console.error("❌ 병원 좌표 변환 중 오류:", h.name, err);
      continue;
    }
  }

  // ✅ 이 시점에서 h.lat, h.lng는 존재
  const route = await getRouteInfo(coordinates.lat, coordinates.lng, h.lat, h.lng);

  if (
    !route ||
    route.distance == null ||
    route.time == null ||
    isNaN(route.distance) ||
    isNaN(route.time)
  ) {
    console.warn("❌ 경로 정보 누락 또는 오류:", h.name, route);
    continue;
  }

    // 초음파 비용
    let ultrasoundPrice;
    if (diseaseType === "breast") {
      ultrasoundPrice = h.breastUltrasoundPrice;
    } else if (diseaseType === "thyroid") {
      ultrasoundPrice = h.thyroidUltrasoundPrice;
    } else {
      const prices = [h.breastUltrasoundPrice, h.thyroidUltrasoundPrice]
        .filter(p => typeof p === "number");
      ultrasoundPrice = prices.length ? Math.max(...prices) : null;
    }

    // 점수 벡터
    const vector = [
      5 - route.distance,
      5 - Math.min(route.time / 10, 5),
      calculateReferralScore(h.referralCount),
      calculateUltrasoundScore(ultrasoundPrice, minPrice, maxPrice),
      h.hasMammotome || h.hasThyroidRFA ? 5 : 1,
      h.hasParking ? 5 : 1,
      h.hasFemaleDoctor ? 5 : 1,
    ];

    const score = vector.reduce((sum, val, i) => sum + val * prefVector[i], 0);

    console.log(`✅ ${h.name} 점수 계산 완료: ${score.toFixed(2)}`);

    scored.push({
      ...h,
      distance: route.distance.toFixed(1),
      time: route.time.toFixed(0),
      score: score.toFixed(2),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  console.log("🏁 최종 상위 5개 병원:", scored.slice(0, 5));

  setResults(scored.slice(0, 5));
};
const copyHospitalInfo = (res, idx) => {
  const text = `[${idx + 1}위] ${res.name}
주소: ${res.address}
전화번호: ${res.phone}
홈페이지: ${res.homepage}`;
  navigator.clipboard.writeText(text)
    .then(() => alert("병원 정보가 복사되었습니다."))
    .catch(err => alert("복사 실패: " + err));
};

useEffect(() => {
  console.log("병원 데이터:", hospitals);
}, [hospitals]);

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
      <strong>
        <a href="https://map.naver.com/v5/search/${encodeURIComponent(res.name)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline; color:#0077cc;">
          ${res.name}
        </a>
      </strong><br />
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
    <strong>
      <a
        href={`https://map.naver.com/v5/search/${encodeURIComponent(res.name)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "underline", color: "#0077cc" }}
      >
        {idx + 1}위: {res.name}
      </a>
    </strong>
    <button
      onClick={() => {
        const text = `[${idx + 1}위] ${res.name}
주소: ${res.address}
전화번호: ${res.phone}
홈페이지: ${res.homepage}`;
        navigator.clipboard.writeText(text);
      }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        fontSize: "14px",
        color: "#555",
      }}
      title="복사"
    >
      📋 복사
    </button>
    <p>점수: {res.score}</p>
    <p>거리: {res.distance}km</p>
    <p>소요 시간: {res.time}분</p>
    <p><strong>주소:</strong> {res.address}</p>
    <p><strong>전화번호:</strong> {res.phone}</p>
    <p>
      <strong>홈페이지:</strong>{" "}
      <a href={res.homepage} target="_blank" rel="noopener noreferrer">
        {res.homepage}
      </a>
    </p>
  </div>
))}
          <div id="map" ref={mapRef} style={{ width: "100%", height: "400px", marginTop: "20px" }}></div>
        </div>
      )}
    </div>
  );
}
