import { useEffect } from "react";

const KakaoHospitalMap = ({ userLocation, hospitals }) => {
  useEffect(() => {
    if (!userLocation || !hospitals || hospitals.length === 0) {
      console.warn("지도 렌더링을 위한 정보가 부족합니다.");
      return;
    }

    const createMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        console.error("❌ 카카오맵 객체가 없습니다.");
        return;
      }

      const container = document.getElementById("kakao-map");
      if (!container) {
        console.error("❌ 'kakao-map' 컨테이너 없음");
        return;
      }

      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        level: 5,
      });

      const imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png"; // 빨간 마커 이미지
      const imageSize = new window.kakao.maps.Size(40, 42); // 이미지 크기 조정 가능
      const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

      new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        map,
        title: "내 위치",
        image: markerImage,
      });

      const bounds = new window.kakao.maps.LatLngBounds();
      const markerInfoMap = new Map(); // 마커 ↔️ infoWindow 상태 저장

      hospitals.forEach(({ lat, lng, name }) => {
        if (!lat || !lng) return;

        const position = new window.kakao.maps.LatLng(lat, lng);
        const marker = new window.kakao.maps.Marker({
          position,
          map,
          title: name,
        });

        const infoWindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:6px;font-size:13px;">${name}</div>`,
        });

          window.kakao.maps.event.addListener(marker, "click", () => {
    const isOpen = infoWindow.getMap();
    if (isOpen) {
      infoWindow.close();
    } else {
      infoWindow.open(map, marker);
    }
  });

        bounds.extend(position);
      });

      map.setBounds(bounds);
    };

    // 스크립트가 이미 있는 경우
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(createMap);
    } else {
      // 기존 스크립트 제거
      const existingScript = document.querySelector("script[src*='dapi.kakao.com']");
      if (existingScript) existingScript.remove();

      // 새 스크립트 삽입
      const script = document.createElement("script");
      script.src =
        "https://dapi.kakao.com/v2/maps/sdk.js?appkey=9d9a8eb3170351ac6c822b92b9dd2784&autoload=false&libraries=services";
      script.async = true;
      script.onload = () => window.kakao.maps.load(createMap);
      document.head.appendChild(script);
    }
  }, [userLocation, hospitals]);

  return (
    <div
      id="kakao-map"
      style={{
        width: "100%",
        height: "400px",
        marginTop: "20px",
        border: "2px solid red",
      }}
    />
  );
};

export default KakaoHospitalMap;
