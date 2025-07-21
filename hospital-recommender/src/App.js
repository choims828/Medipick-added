import React from 'react';
import './App.css';
// 로고는 제거하거나 유지해도 됩니다
// import logo from './logo.svg';

// 네이버 지도 컴포넌트 import (파일 경로에 맞게 조정)
import NaverMap from './pages/NaverMap';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h2>맞춤형 병원 추천 지도</h2>
        <NaverMap />
      </header>
    </div>
  );
}

export default App;
