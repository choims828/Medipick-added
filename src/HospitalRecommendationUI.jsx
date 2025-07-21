import useHospitalsFromSheet from "./Hooks/useHospitalsFromSheet";
import { useState, useEffect, useRef } from "react";
import KakaoHospitalMap from "./KakaoHospitalMap.jsx";

const TMAP_API_KEY = "BfaPB4r0Z4a0HcdNoQK9N17SO6krdhtW2X1b7Vob";

// 자동차
const getCarRouteTmap = async (startLat, startLng, endLat, endLng) => {
  const url = "https://apis.openapi.sk.com/tmap/routes";
  const body = {
    startX: startLng.toString(),
    startY: startLat.toString(),
    endX: endLng.toString(),
    endY: endLat.toString(),
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      appKey: TMAP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const summary = data?.features?.[0]?.properties;
  return {
    time: Math.round(summary?.totalTime / 60),
    distance: (summary?.totalDistance / 1000).toFixed(1),
  };
};

// 도보
const getWalkRouteTmap = async (startLat, startLng, endLat, endLng) => {
  const url = "https://apis.openapi.sk.com/tmap/routes/pedestrian";
  const body = {
    startX: startLng.toString(),
    startY: startLat.toString(),
    endX: endLng.toString(),
    endY: endLat.toString(),
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      appKey: TMAP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const summary = data?.features?.[0]?.properties;
  return {
    time: Math.round(summary?.totalTime / 60),
    distance: (summary?.totalDistance / 1000).toFixed(1),
  };
};

// 대중교통
const getTransitRouteTmap = async (startLat, startLng, endLat, endLng) => {
  const url = "https://apis.openapi.sk.com/transit/routes";
  const body = {
    startX: startLng.toString(),
    startY: startLat.toString(),
    endX: endLng.toString(),
    endY: endLat.toString(),
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    searchDttm: new Date().toISOString().replace(/[-T:\.Z]/g, "").slice(0, 12),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      appKey: TMAP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const meta = data.meta;
  return {
    time: Math.round(meta?.totalTime / 60),
    distance: (meta?.totalDistance / 1000).toFixed(1),
  };
};

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

const getMedian = (arr) => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return arr.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};  
// 중간값 계산 함수 추가
  const getMedianUltrasoundPrice = (hospitalList, diseaseType) => {
  const prices = hospitalList.map(h => {
  if (diseaseType === "breast") return parsePrice(h.breastUltrasoundPrice);
  if (diseaseType === "thyroid") return parsePrice(h.thyroidUltrasoundPrice);
  return Math.max(
    parsePrice(h.breastUltrasoundPrice) ?? 0,
    parsePrice(h.thyroidUltrasoundPrice) ?? 0
  );
}).filter(p => typeof p === "number" && !isNaN(p));

  if (prices.length === 0) return null;

  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];
};

const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

  const calculateTimeScore = (text) => {
    if (!text) return 1;
    const lower = text.toLowerCase();
    if (lower.includes("야간") && lower.includes("주말")) return 5;
    if (lower.includes("주말")) return 4;
    if (lower.includes("야간")) return 3;
    if (lower.includes("평일")) return 2;
    return 1;
  };

  // 📈 초음파 비용 계산 함수 추가 (여기!)
const getUltrasoundPrice = (h, diseaseType, medianBreast, medianThyroid, medianBoth) => {
  const parse = (v) => {
    const num = Number(String(v).replace(/[^0-9]/g, ""));
    return isNaN(num) ? null : num;
  };

  if (diseaseType === "breast") {
    const val = parse(h.breastUltrasoundPrice);
    if (typeof val === "number") return val;
    console.warn(`📌 유방 가격 누락 → 중간값 대체: ${h.name}`);
    return medianBreast ?? 50000;
  }

  if (diseaseType === "thyroid") {
    const val = parse(h.thyroidUltrasoundPrice);
    if (typeof val === "number") return val;
    console.warn(`📌 갑상선 가격 누락 → 중간값 대체: ${h.name}`);
    return medianThyroid ?? 50000;
  }

  const breast = parse(h.breastUltrasoundPrice);
  const thyroid = parse(h.thyroidUltrasoundPrice);
  const hasBreast = typeof breast === "number";
  const hasThyroid = typeof thyroid === "number";

  if (hasBreast && hasThyroid) return breast + thyroid;
  if (hasBreast) return breast + (medianThyroid ?? 50000);
  if (hasThyroid) return thyroid + (medianBreast ?? 50000);

  console.warn(`📌 유방/갑상선 가격 모두 누락 → 전체 중간값 대체: ${h.name}`);
  return medianBoth ?? 100000;
};

 // 🔥 회송 점수 정규화 함수
const calculateReferralScore = (count) => {
  const min = 0;
  const max = 374;
  const normalized = (count - min) / (max - min);
  return 1 + normalized * 4;
};
// 🔧 초음파 가격 숫자 정제 함수 (여기에 넣으세요!)
const parsePrice = (val) => {
  const num = Number(String(val).replace(/[^0-9]/g, ""));
  return isNaN(num) ? null : num;
};
// 🔍 초음파 비용 점수 (저렴할수록 높음)
const calculateUltrasoundScore = (ultrasoundPrice, minPrice, maxPrice) => {
  if (typeof ultrasoundPrice !== "number" || isNaN(ultrasoundPrice)) {
    console.warn(`초음파 가격 정보 누락 또는 잘못된 값: ${ultrasoundPrice}`);
    return 3;
  }
   if (maxPrice === minPrice) {
    return 3; // 변화가 없으면 중립 점수
  }
  const normalized = (maxPrice - ultrasoundPrice) / (maxPrice - minPrice);
  return 1 + normalized * 4;
};

// 🏥 치료 가능 여부 점수
const calculateTreatmentScore = (hospital, diseaseType) => {
  const hasBreastBiopsy = hospital.hasBreastBiopsy === true;     // N열
  const hasMammotome = hospital.hasMammotome === true;           // O열
  const hasThyroidBiopsy = hospital.hasThyroidBiopsy === true;   // Q열
  const hasThyroidRFA = hospital.hasThyroidRFA === true;         // R열

  if (diseaseType === "breast") {
    if (hasMammotome) return 5;
    if (hasBreastBiopsy) return 4;
    return 3;
  }

  if (diseaseType === "thyroid") {
    if (hasThyroidRFA) return 5;
    if (hasThyroidBiopsy) return 4;
    return 3;
  }

  if (diseaseType === "both") {
    const hasAny = hasMammotome || hasBreastBiopsy || hasThyroidRFA || hasThyroidBiopsy;
    const hasAll = hasMammotome && hasThyroidRFA;
    if (hasAll) return 5;
    if (hasAny) return 4;
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
  const distance = Math.random() * 6 + 2; // 2 ~ 8km
  const time = Math.random() * 25 + 10;   // 10 ~ 35분
  return { distance, time };
};let ultrasoundPrice;

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
        const { x, y } = data.documents[0].address || data.documents[0].road_address || {};
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
  .map(h => ({
    ...h,
    tempDistance: calculateDistance(coordinates.lat, coordinates.lng, h.lat, h.lng)
  }))
  .sort((a, b) => a.tempDistance - b.tempDistance) // 🔁 거리순 정렬
  .slice(0, 10); // 📌 가까운 10개만 추림

  console.log("✅ 필터링된 병원 수:", filteredHospitals.length);
  if (filteredHospitals.length === 0) {
    alert("해당 조건에 맞는 병원이 없습니다.");
    return;
  }
const breastPrices = filteredHospitals
  .map(h => parsePrice(h.breastUltrasoundPrice))
  .filter(p => typeof p === "number");

const thyroidPrices = filteredHospitals
  .map(h => parsePrice(h.thyroidUltrasoundPrice))
  .filter(p => typeof p === "number");

const bothPrices = filteredHospitals
  .map(h => {
    const b = parsePrice(h.breastUltrasoundPrice);
    const t = parsePrice(h.thyroidUltrasoundPrice);
    return typeof b === "number" && typeof t === "number" ? b + t : null;
  })
  .filter(p => typeof p === "number");

const medianBreast = getMedian(breastPrices);
const medianThyroid = getMedian(thyroidPrices);
const medianBoth = getMedian(bothPrices);

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
  const medianPrice = getMedianUltrasoundPrice(filteredHospitals, diseaseType);
  console.log("💰 초음파 가격 범위:", { minPrice, maxPrice });

  const scored = [];

   for (const h of filteredHospitals) {
  console.log("📍 병원 처리 중:", h.name);
  console.log("병원 좌표 확인:", h.name, h.lat, h.lng);

    console.log("데이터 확인:", h.name, {
    breastUltrasoundPrice: h.breastUltrasoundPrice,
    hasMammotome: h.hasMammotome,
    hasThyroidRFA: h.hasThyroidRFA,
  });
  const car = await getCarRouteTmap(coordinates.lat, coordinates.lng, h.lat, h.lng);
  const walk = await getWalkRouteTmap(coordinates.lat, coordinates.lng, h.lat, h.lng);
  const transit = await getTransitRouteTmap(coordinates.lat, coordinates.lng, h.lat, h.lng);

  h.timeCar = car?.time ?? 0;
  h.timeWalk = walk?.time ?? 0;
  h.timeTransit = transit?.time ?? 0
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
  const route = {
  distance: calculateDistance(coordinates.lat, coordinates.lng, h.lat, h.lng),
  time: 0 // 시간은 임시 0 처리
};

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
    // 👉 1. 병원별 가격 추출
if (diseaseType === "breast") {
  ultrasoundPrice = parsePrice(h.breastUltrasoundPrice);
} else if (diseaseType === "thyroid") {
  ultrasoundPrice = parsePrice(h.thyroidUltrasoundPrice);
} else {
  const prices = [parsePrice(h.breastUltrasoundPrice), parsePrice(h.thyroidUltrasoundPrice)].filter(p => typeof p === "number");
  ultrasoundPrice = prices.length ? Math.max(...prices) : null;
}

if (typeof ultrasoundPrice !== "number" || isNaN(ultrasoundPrice)) {
  ultrasoundPrice = medianPrice ?? 50000;
  console.warn(`📌 초음파 가격 누락 → 대체값(${ultrasoundPrice}) 사용:`, h.name);
}

const price = Number(ultrasoundPrice);
const safePrice = !isNaN(price) ? price : medianPrice;

const vector = [
  5 - route.distance,
  5 - Math.min(route.time / 10, 5),
  calculateReferralScore(h.referralCount),
  calculateUltrasoundScore(safePrice, minPrice, maxPrice),
  h.hasMammotome || h.hasThyroidRFA ? 5 : 1,
  h.hasParking ? 5 : 1,
  h.hasFemaleDoctor ? 5 : 1,
];

// 👉 2. 유효하지 않으면 중간값으로 대체
if (typeof ultrasoundPrice !== "number" || isNaN(ultrasoundPrice)) {
  if (ultrasoundPrices.length > 0) {
    const sorted = [...ultrasoundPrices].sort((a, b) => a - b);
    const midIdx = Math.floor(sorted.length / 2);
    ultrasoundPrice = sorted.length % 2 === 1
      ? sorted[midIdx]
      : (sorted[midIdx - 1] + sorted[midIdx]) / 2;
    console.warn(`📌 초음파 가격 누락 → 중간값(${ultrasoundPrice}) 사용:`, h.name);
  } else {
    ultrasoundPrice = 50000; // 📌 fallback 기본값
    console.warn(`📌 초음파 가격 전원 누락 → 기본값(${ultrasoundPrice}) 사용:`, h.name);
  }
}

    const score = vector.reduce((sum, val, i) => sum + val * prefVector[i], 0);

    console.log(`✅ ${h.name} 점수 계산 완료: ${score.toFixed(2)}`);

    scored.push({
      ...h,
      distance: route.distance.toFixed(1),
      time: route.time.toFixed(0),
      timeCar: h.timeCar,
    timeWalk: h.timeWalk,
    timeTransit: h.timeTransit,
      score: score.toFixed(2),
       breastUltrasoundPrice: safePrice, 
  hasMammotome: h.hasMammotome,     
  hasThyroidRFA: h.hasThyroidRFA, 
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

  const bounds = new naver.maps.LatLngBounds();

  results.forEach((res) => {
    const position = new naver.maps.LatLng(res.lat, res.lng);
    bounds.extend(position);

    const marker = new naver.maps.Marker({
      position,
      map,
      title: res.name,
    });

    const infoWindow = new naver.maps.InfoWindow({
      content: `
        <div style="padding:10px; font-size:14px; max-width:220px;">
          <strong>
            <a href="https://map.naver.com/v5/search/${encodeURIComponent(res.name)}"
               target="_blank" rel="noopener noreferrer"
               style="text-decoration:underline; color:#0077cc;">
              ${res.name}
            </a>
          </strong><br />
          점수: ${res.score} / 5.00<br />
          거리: ${res.distance}km<br />
          예상 소요 시간: ${res.time}분
        </div>
      `,
    });

    naver.maps.Event.addListener(marker, "click", () => {
      infoWindow.open(map, marker);
    });
  });

  map.fitBounds(bounds);
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
        const text = `${idx + 1}. ${res.name}
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
    <p>점수: {res.score} / 5.00</p>
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
     {/* 🔥 여기에 이모지 정보 추가 */}
  <p style={{ marginTop: "6px", lineHeight: "1.6" }}>
  ⏰ 시간: {res.timeText || "정보 없음"}<br />

  {diseaseType === "breast" && (
  <>
    🩺 유방초음파:{" "}
    {res.breastUltrasoundPrice != null
      ? `${res.breastUltrasoundPrice.toLocaleString()}원`
      : "정보 없음"}{" "}
    / 치료 가능: {res.hasMammotome ? "맘모톰 가능" : "없음"}
    <br />
  </>
)}

{diseaseType === "thyroid" && (
  <>
    🩺 갑상선초음파:{" "}
    {res.thyroidUltrasoundPrice != null
      ? `${res.thyroidUltrasoundPrice.toLocaleString()}원`
      : "정보 없음"}{" "}
    / 치료 가능:{" "}
    {[
      res.hasThyroidRFA && "고주파열치료",
      res.hasThyroidBiopsy && "갑상선조직검사",
    ]
      .filter(Boolean)
      .join(", ") || "없음"}
    <br />
  </>
)}

{diseaseType === "both" && (
  <>
    🩺 유방: {res.breastUltrasoundPrice != null
      ? `${res.breastUltrasoundPrice.toLocaleString()}원`
      : "정보 없음"}, 
    갑상선: {res.thyroidUltrasoundPrice != null
      ? `${res.thyroidUltrasoundPrice.toLocaleString()}원`
      : "정보 없음"}
    <br />
    🛠 치료 가능:{" "}
{[
  res.hasMammotome && "맘모톰",
  res.hasThyroidRFA && "고주파열치료",
  res.hasBreastBiopsy && "유방조직검사",
  res.hasThyroidBiopsy && "갑상선조직검사",
]
  .filter(Boolean)
  .join(", ") || "없음"}
    <br />
  </>
)}

  👩‍⚕️ 여의사 진료: {res.hasFemaleDoctor ? "있음" : "없음"}{" "}
  🅿️ 주차: {res.hasParking ? "가능" : "불가"}
</p>
  </div>
))}
          <KakaoHospitalMap userLocation={coordinates} hospitals={results} />
        </div>
      )}
    </div>
  );
}
