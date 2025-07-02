// signTotal


(() => {

  // ✨ 부트스트랩: 새로고침·첫 로드 시 로그인·마지막 장소 복원
  async function bootstrap() {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('username');
      const pId = localStorage.getItem('placeId');
      if (t && u) {
          authToken = t;
          setLoggedIn(u);
          if (pId) {
              currentPlaceId = pId;
              await fetchLastPlaceAndInit();
              return;
          }
      }
      init();
  }
  // --- 상태 변수 ---
  let currentUser = null;
  let authToken = null;
  let currentPlaceId = null;
  let pins = [];
  let myHistory = [];
  let selectedPin = null;
  let isMovingPin = false;
    let lastClickedX = null;
    let lastClickedY = null;

  // --- DOM 요소 ---
  const startScreen = document.getElementById('startScreen');
  const placeNameInput = document.getElementById('placeNameInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const mainApp = document.getElementById('mainApp');
  const floorplan = document.getElementById('floorplan');
  const floorplanContainer = document.getElementById('floorplan-container');
  const addPinBtn = document.getElementById('addPinBtn');
  const movePinBtn = document.getElementById('movePinBtn');
  const tabButtons = document.querySelectorAll('.tabButton');
  const pinListDiv = document.getElementById('pinList');
  const historyListDiv = document.getElementById('historyList');
  const addPinPopup = document.getElementById('addPinPopup');
  const newPinNameInput = document.getElementById('newPinName');
  const newPinEmojiInput = document.getElementById('newPinEmoji');
  const newPinColorSelect = document.getElementById('newPinColor');
  const confirmAddPinBtn = document.getElementById('confirmAddPinBtn');
  const cancelAddPinBtn = document.getElementById('cancelAddPinBtn');
  const editModal = document.getElementById('editModal');
  const editPinName = document.getElementById('editPinName');
  const editPinEmoji = document.getElementById('editPinEmoji');
  const editPinComment = document.getElementById('editPinComment');
  const editPinColor = document.getElementById('editPinColor');
  const savePinBtn = document.getElementById('savePinBtn');
  const deletePinBtn = document.getElementById('deletePinBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const loginBtn = document.getElementById('loginBtn');
  const loginCloseBtn = document.getElementById('loginCloseBtn');
  const loginPopup = document.getElementById('loginPopup');
  const loginConfirmBtn = document.getElementById('loginConfirmBtn');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const registerPopup = document.getElementById('registerPopup');
  const registerCloseBtn = document.getElementById('registerCloseBtn');
  const registerBtn = document.getElementById('registerBtn');
  const regUsernameInput = document.getElementById('regUsername');
  const regPasswordInput = document.getElementById('regPassword');
  const regPasswordConfirmInput = document.getElementById('regPasswordConfirm');
  const registerMsg = document.getElementById('registerMsg');
  const loading = document.getElementById('loading');
  const backdrop = document.getElementById('backdrop');


  // --- 로그인/회원가입을 위한 API 호출 래퍼 ---
  function apiFetch(url, options = {}) {
      options.headers = options.headers || {};
      if (authToken) {
          options.headers['Authorization'] = `Bearer ${authToken}`;
      }
      return fetch(url, options);
  }

  // --- 로그인 상태 UI 처리 ---
  function setLoggedIn(user) {
      currentUser = user;
      loginBtn.textContent = `${currentUser} 님 (로그아웃)`;
      loginPopup.style.display = 'none';
      registerPopup.style.display = 'none';
      loading.style.display = 'none';
  }
  function setLoggedOut() {
      currentUser = null;
      authToken = null;
      currentPlaceId = null;
      pins = [];
      myHistory = [];
      loginBtn.textContent = '로그인';
      init(); // 다시 시작 화면으로
      clearPinsFromMap();
      renderPinList();
      renderHistory();
  }

  // --- 초기 화면/앱 화면 토글 ---
  function init() {
      startScreen.style.display = 'block';
      showRegisterBtn.style.display = 'block';
      mainApp.style.display = 'none';
      loading.style.display = 'none';
      mainApp.classList.add('sidebar-visible');
      console.log('startScreen', startScreen);
      console.log('mainApp', mainApp);
      console.log('loading', loading);
      addColorFilterButtons();
  }
 function addColorFilterButtons() {
  const pinListDiv = document.getElementById('pinList');
  if (!pinListDiv) return;

  const existingContainer = document.getElementById('pinFilterContainer');
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.id = 'pinFilterContainer';
  container.style.padding = '5px 10px';
  container.style.textAlign = 'center';
  container.style.backgroundColor = '#f5a623'; // 주황 계열 배경

  const colors = [
    { code: '#f44336', name: '빨강' },
    { code: '#ff8c00', name: '주황' },
    { code: '#ffeb3b', name: '노랑' },
    { code: '#4caf50', name: '초록' },
    { code: '#2196f3', name: '파랑' },
    { code: '#9c27b0', name: '보라' },
  ];

  colors.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'colorFilterBtn';
    btn.dataset.color = c.code;
    btn.title = c.name;
    btn.style.backgroundColor = c.code;
    btn.style.width = '24px';
    btn.style.height = '24px';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.margin = '0 4px';
    btn.style.cursor = 'pointer';
    btn.style.verticalAlign = 'middle';
    btn.style.boxShadow = '0 0 3px rgba(0,0,0,0.3)';
    container.appendChild(btn);
  });

  // 전체보기 버튼
  const clearBtn = document.createElement('button');
  clearBtn.id = 'clearFilterBtn';
  clearBtn.textContent = '전체';
  clearBtn.style.marginLeft = '12px';
  clearBtn.style.padding = '4px 8px';
  clearBtn.style.border = 'none';
  clearBtn.style.borderRadius = '4px';
  clearBtn.style.cursor = 'pointer';
  clearBtn.style.backgroundColor = '#fff';
  clearBtn.style.color = '#f57c00';
  clearBtn.style.fontWeight = 'bold';
  container.appendChild(clearBtn);

  // pinListDiv 바로 위에 삽입
  pinListDiv.parentNode.insertBefore(container, pinListDiv);

  // 필터 버튼 클릭 이벤트
  container.querySelectorAll('.colorFilterBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      filterPinsByColor(color);
    });
  });
  clearBtn.addEventListener('click', () => {
    showAllPins();
  });
}

// 핀 색상 필터링 함수
function filterPinsByColor(color) {
  document.querySelectorAll('.pin').forEach(pin => {
    if (pin.dataset.color === color) {
      pin.style.display = 'block';
    } else {
      pin.style.display = 'none';
    }
  });

  document.querySelectorAll('.pinItem').forEach(item => {
    if (item.dataset.color === color) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}


// 모든 핀 보이기 함수
function showAllPins() {
  document.querySelectorAll('.pin').forEach(pin => {
    pin.style.display = 'block';
  });
   document.querySelectorAll('.pinItem').forEach(item => {
    item.style.display = 'flex';
  });
}

  bootstrap();

  // 두 번째 화면 초기화: 사진 띄우고 핀·히스토리 로드
  // ─────────────────────────────────────────────────────────────────────────────
  // 두 번째 화면 초기화: 도면 이미지 + 핀·히스토리 로드
  async function initMainScreen() {
      // 1) UI 전환
      startScreen.style.display = 'none';
      showRegisterBtn.style.display = 'none';
      loginPopup.style.display = 'none';
      mainApp.style.display = 'flex';
      const placeName = localStorage.getItem('placeName')
      document.title = `콕집어 - ${placeName}`;
      const sidebar = document.querySelector('#sidebar');
      sidebar.querySelectorAll('h2').forEach(el => el.remove());
      const h2 = document.createElement('h2');
      h2.textContent = placeName;
      const tabmenu = document.querySelector('#tabMenu');
      document.querySelector('#sidebar').insertBefore(h2, tabmenu);

      // 2) 로딩 스피너 켜고 onload 핸들러 준비
      loading.style.display = 'flex';
      floorplan.onload = () => {
          loading.style.display = 'none';
          floorplan.style.display = 'block';
          loadPins();
          loadHistory();
      };

      // 3) fetch + blob → img.src 로 설정 (토큰 자동 포함)
      const res = await fetch(
          `/api/places/${currentPlaceId}/image`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      if (!res.ok) {
          alert('도면 이미지를 불러오지 못했습니다.');
          init();   // 혹은 적절한 에러 처리
          return;
      }
      const blob = await res.blob();
      floorplan.src = URL.createObjectURL(blob);
  }
  // ─────────────────────────────────────────────────────────────────────────────
  async function fetchLastPlaceAndInit() {
      const res = await fetch('/api/last_place', {
          headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
          const { placeId, placeName } = await res.json();
          if (placeId) {
              currentPlaceId = placeId;
              localStorage.setItem('placeId', placeId);
              localStorage.setItem('placeName', placeName);
              await initMainScreen();
              return;
          }
      }
      init();
  }

  // --- 로그인 버튼 클릭 핸들러 ---
  loginBtn.addEventListener('click', () => {
      if (authToken) {
          if (!confirm('로그아웃 하시겠습니까?')) return;
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('placeId');
          localStorage.removeItem('placeName');
          authToken = null;
          setLoggedOut();
          return;
      } else {
          loginPopup.style.display = 'block';
          backdrop.style.display = 'block';
          registerPopup.style.display = 'none';
      }
  });

  loginCloseBtn.addEventListener('click', () => {
      loginPopup.style.display = 'none';
      backdrop.style.display = 'none';
      usernameInput.value = '';
      passwordInput.value = '';
  })

  // --- 로그인 제출 ---
  loginConfirmBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      if (!username || !password) {
          alert('아이디와 비밀번호를 모두 입력해주세요.');
          return;
      }
      try {
          const res = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (res.ok && data.token) {
              authToken = data.token;
              localStorage.setItem('token', authToken);
              localStorage.setItem('username', username);
              await fetchLastPlaceAndInit();
              setLoggedIn(username);
              alert(`환영합니다, ${username}님!`);
          } else {
              alert(data.error || '로그인 실패');
          }
          backdrop.style.display = 'none';
      } catch {
          alert('서버 연결 오류');
      }
  });

  // --- 회원가입 팝업 열기/닫기 ---
  showRegisterBtn.addEventListener('click', () => {
      registerPopup.style.display = 'flex';
      backdrop.style.display = 'block';
      loginPopup.style.display = 'none';
      registerMsg.textContent = '';
  });
  registerCloseBtn.addEventListener('click', () => {
      registerPopup.style.display = 'none';
      backdrop.style.display = 'none';
      registerMsg.textContent = '';
  });

  // --- 회원가입 제출 ---
  registerBtn.addEventListener('click', async () => {
      const username = regUsernameInput.value.trim();
      const password = regPasswordInput.value;
      const passwordConfirm = regPasswordConfirmInput.value;
      if (!username || !password || !passwordConfirm) {
          registerMsg.style.color = 'red';
          registerMsg.textContent = '모든 항목을 입력해주세요.';
          return;
      }
      if (password !== passwordConfirm) {
          registerMsg.style.color = 'red';
          registerMsg.textContent = '비밀번호가 일치하지 않습니다.';
          return;
      }
      try {
          const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (res.ok) {
              alert('회원가입 성공! 로그인해주세요.');
              // 팝업 닫기
              registerPopup.style.display = 'none';
              backdrop.style.display = 'none';
              // 입력 필드 초기화
              regUsernameInput.value = '';
              regPasswordInput.value = '';
              regPasswordConfirmInput.value = '';
          } else {
              registerMsg.style.color = 'red';
              registerMsg.textContent = data.error || '회원가입 실패';
          }
          backdrop.style.display = 'none';
      } catch {
          registerMsg.style.color = 'red';
          registerMsg.textContent = '서버 연결 실패';
      }
  });

  toggleSidebarBtn.addEventListener('click', () => {
    if(mainApp.classList.contains('sidebar-visible')){
      mainApp.classList.remove('sidebar-visible');
      mainApp.classList.add('sidebar-collapsed');
    }
    else {
      mainApp.classList.remove('sidebar-collapsed');
      mainApp.classList.add('sidebar-visible');
    }
  });

  // --- 장소 업로드 (POST /api/places) ---
  uploadBtn.addEventListener('change', async (e) => {
      if (!authToken) {
          alert('로그인 후 이용해주세요.');
          uploadBtn.value = '';
          return;
      }
      const file = e.target.files[0];
      const placeName = placeNameInput.value.trim();
      if (!placeName) {
          alert('장소 이름을 입력해주세요!');
          uploadBtn.value = '';
          return;
      }
      if (!file) {
          alert('사진을 선택해주세요!');
          return;
      }
      try {
          const formData = new FormData();
          formData.append('name', placeName);
          formData.append('image', file);
          loading.style.display = 'flex';
          const res = await apiFetch('/api/places', {
              method: 'POST',
              body: formData
          });
          const data = await res.json();
          if (res.ok && data._id) {
              currentPlaceId = data._id;
              localStorage.setItem('placeId', currentPlaceId);
              localStorage.setItem('placeName', placeName);
              await apiFetch('/api/last_place', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ placeId: currentPlaceId, placeName })
              });
              // loading.style.display = 'flex';
              floorplan.onload = async () => {
                  // 이미지가 화면에 다 뜬 뒤 실행됨
                  loading.style.display = 'none';
                  floorplan.style.display = 'block';

                  startScreen.style.display = 'none';
                  mainApp.style.display = 'flex';
                  document.title = `콕집어 - ${placeName}`;

                //   const h2 = document.createElement('h2');
                //   h2.textContent = placeName;
                //   const tabmenu = document.querySelector('#tabMenu');
                //   document.querySelector('#sidebar').insertBefore(h2, tabmenu);

                  await loadPins();
                  await loadHistory();
              };
              floorplan.src = URL.createObjectURL(file);
          } else {
              alert(data.error || '장소 생성 실패');
              loading.style.display = 'none';
          }
      } catch {
          alert('서버 연결 실패');
          loading.style.display = 'none';
      }
  });

  // --- 핀 목록 불러오기 ---
  async function loadPins() {
      if (!currentPlaceId) return;
      try {
          const res = await apiFetch(`/api/places/${currentPlaceId}/pins`);
          const arr = await res.json();
          console.log("핀 목록 불러옴", arr);
          if (res.ok) {
              pins = arr.map(p => ({
                  id: p._id, name: p.name, emoji: p.emoji,
                  color: p.color, x: p.x, y: p.y, comment: p.comment
              }));
              clearPinsFromMap();
              pins.forEach(p => createPin(p.x, p.y, p));
              renderPinList();
          }
      } catch {
          alert('핀 데이터를 불러오는 중 오류');
      }
  }

  async function savePinToDB(pinData) {
  const res = await apiFetch(`/api/places/${currentPlaceId}/pins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(pinData)
  });

  if (!res.ok) {
    const err = await res.json();
    alert("핀 저장 실패: " + err.error);
  } else {
    const savedPin = await res.json();
    console.log("핀 저장됨:", savedPin);
  }
}


  // --- 히스토리 불러오기 ---
  async function loadHistory() {
      if (!currentPlaceId) return;
      myHistory = [];
try {
  for (const pin of pins) {
      const res = await apiFetch(`/items/${pin.id}/move`);
      const arr = await res.json();
      arr.sort((a, b) => a._id.localeCompare(b._id));
      if (res.ok) {
          myHistory.push(arr.map(h => ({
              x: h.newX,
              y: h.newY,
          })));
      }
  }
  renderHistory();
} catch {
  alert('히스토리 불러오기 실패');
}

  }

  // --- 핀 화면에서 모두 지우기 ---
  function clearPinsFromMap() {
      floorplanContainer.querySelectorAll('.pin').forEach(el => el.remove());
  }

  // --- 핀 생성 & 드래그/저장 로직 ---
  function createPin(x, y, pinData) {
      const pin = document.createElement('div');
      pin.className = 'pin';
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;
      pin.style.backgroundColor = pinData.color || '#ff8c00';
    //   pin.setProperty('--pin-bg-color', pinData.color);
      pin.textContent = pinData.emoji || '📌';
      pin.dataset.id = pinData.id;
      pin.dataset.name = pinData.name;
      const style = document.createElement('style');
      style.textContent = `
        .pin[data-id="${pinData.id}"]::after {
        background-color: ${pinData.color};}`;
      document.head.appendChild(style);

      let offsetX, offsetY, dragging = false;

      pin.addEventListener('mousedown', e => {
          if (!isMovingPin) return;
          dragging = true;
          offsetX = e.clientX - pin.offsetLeft;
          offsetY = e.clientY - pin.offsetTop;
          pin.classList.add('dragging');
          e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
          if (!dragging) return;
          let newX = e.clientX - offsetX;
          let newY = e.clientY - offsetY;
          const rect = floorplanContainer.getBoundingClientRect();
          newX = Math.min(Math.max(0, newX), rect.width - pin.offsetWidth);
          newY = Math.min(Math.max(0, newY), rect.height - pin.offsetHeight);
          pin.style.left = `${newX}px`;
          pin.style.top = `${newY}px`;
      });
      document.addEventListener('mouseup', async e => {
  if (!dragging) return;
  dragging = false;
  pin.classList.remove('dragging');
  const id = pin.dataset.id;
  const idx = pins.findIndex(p => p.id === id);
  if (idx === -1) return;
  pins[idx].x = parseInt(pin.style.left);
  pins[idx].y = parseInt(pin.style.top);
  try {
      await apiFetch(`/items/${id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newX: pins[idx].x, newY: pins[idx].y })
      });
      await apiFetch(`/api/places/${currentPlaceId}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin_id: id, x: pins[idx].x, y: pins[idx].y })
      });
      loadHistory();
      renderHistory();
      renderPinList();
  } catch {
      alert('위치 저장 실패');
  }
});


      floorplanContainer.appendChild(pin);
  }

  // --- 물건 리스트 렌더링 ---
 function renderPinList() {
  pinListDiv.innerHTML = '';
  pins.forEach(pin => {
    const div = document.createElement('div');
    div.className = 'pinItem';
    div.dataset.id = pin.id;
    div.dataset.color = pin.color;
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
        <div class="pinEmoji">${pin.emoji || '📌'}</div>
        <div class="pinName">${pin.name}</div>
      </div>
      <div class="pinStatus">${pin.comment ? '코멘트 있음' : ''}</div>
    `;
    div.addEventListener('click', () => openEditModal(pin));
    pinListDiv.appendChild(div);
  });
}

  // --- 히스토리 렌더링 ---
  function renderHistory() {
      historyListDiv.innerHTML = '';
      pins.forEach(pin => {
          const div = document.createElement('div');
          div.className = 'pinItem';
          div.dataset.id = pin.id;
          div.innerHTML = `
        <div class="pinEmoji">${pin.emoji || '📌'}</div>
        <div class="pinName">${pin.name}</div>
        <div class="pinStatus"></div>
        `;
          div.addEventListener('click', (e) => {
              const siblings = e.currentTarget.parentNode.querySelectorAll('.pinItem');
              siblings.forEach(el => el.classList.remove('active'));
              e.currentTarget.classList.add('active');
              markHistory(pin)
          });
          historyListDiv.appendChild(div);
      });
      // history.forEach(h => {
      //   const div = document.createElement('div');
      //   div.className = 'historyItem';
      //   div.textContent = `[${new Date(h.time).toLocaleString()}] ${h.text}`;
      //   historyListDiv.appendChild(div);
      // });
  }

  function markHistory(pin) {
      document.querySelectorAll('.pinHistory').forEach(el => el.remove());
      document.querySelectorAll('.historyLine').forEach(el => el.remove());

      const index = pins.indexOf(pin);
      const pinElementHistory = myHistory[index];
      if (!pinElementHistory || pinElementHistory.length === 0) {
          return;
      }
      // svg 요소 생성
      let svg = document.getElementById('historyLineSvg');
      if (!svg) {
          svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('id', 'historyLineSvg');
          svg.style.position = 'absolute';
          svg.style.top = '0';
          svg.style.left = '0';
          svg.style.width = '100%';
          svg.style.height = '100%';
          svg.style.pointerEvents = 'none'; // 마우스 방해 X
          floorplanContainer.appendChild(svg);
      } else {
          svg.innerHTML = ''; // 기존 선 제거
      }
      pinElementHistory.forEach((h, i) => {
          const pinElement = document.createElement('div');
          pinElement.className = 'pin pinHistory';
          pinElement.dataset.id = i + 1;
          pinElement.style.left = `${h.x}px`;
          pinElement.style.top = `${h.y}px`;
          pinElement.style.backgroundColor = pin.color || '#ff8c00';
          pinElement.textContent = pin.emoji || '📌';
          floorplanContainer.appendChild(pinElement);

          //선 그리기, 다음 좌표가 있으면 선 생성 
          if (i > 0) {
              const prev = pinElementHistory[i - 1];
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', prev.x + 12); // 중심 기준 보정
              line.setAttribute('y1', prev.y + 12);
              line.setAttribute('x2', h.x + 12);
              line.setAttribute('y2', h.y + 12);
              line.setAttribute('stroke', pin.color || '#ff8c00');
              line.setAttribute('stroke-width', '2');
              line.classList.add('historyLine');
              svg.appendChild(line);
          }
      })
      console.log('핀 위치 렌더링 완료', pinElementHistory);
      console.log('현재 DOM에 .pinHistory 수:', document.querySelectorAll('.pinHistory').length);
  }

  // --- 물건 추가 팝업 & API 호출 ---
  addPinBtn.addEventListener('click', () => {
      if (!authToken) { alert('로그인 후 이용해주세요.'); return; }
      addPinPopup.style.display = 'flex';
      addPinPopup.style.left = (floorplanContainer.clientWidth / 2 - addPinPopup.clientWidth / 2) + 'px';
      addPinPopup.style.top = (floorplanContainer.clientHeight / 2 - addPinPopup.clientHeight / 2) + 'px';
      newPinNameInput.value = '';
      newPinEmojiInput.value = '';
      newPinColorSelect.value = '#ffb347';
  });
// 핀 추가 시 중앙 좌표로 고정
confirmAddPinBtn.addEventListener('click', async () => {
  const name = newPinNameInput.value.trim();
  const emoji = newPinEmojiInput.value.trim() || '';
  const color = newPinColorSelect.value;
  if (!name) { alert('물건 이름을 입력하세요.'); return; }
  if (!currentPlaceId) { alert('장소가 선택되지 않았습니다.'); return; }
  const x = floorplanContainer.clientWidth / 2 - 16;
  const y = floorplanContainer.clientHeight / 2 - 16;
  try {
      const res = await apiFetch(`/api/places/${currentPlaceId}/pins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, emoji, color, x, y })
      });
      const data = await res.json();
      if (res.ok) {
          const p = { id: data._id, name: data.name, emoji: data.emoji, color: data.color, x: data.x, y: data.y, comment: data.comment };
          pins.push(p);
          createPin(p.x, p.y, p);
          renderPinList();
          addPinPopup.style.display = 'none';
          renderHistory();
      } else {
          alert(data.error || '추가 실패');
      }
  } catch {
      alert('서버 오류');
  }
});


  cancelAddPinBtn.addEventListener('click', () => {
    addPinPopup.style.display = 'none';
    newPinNameInput.value = '';
    newPinEmojiInput.value = '';
    newPinColorSelect.value = '#ffb347';
  })

  // --- 편집 모달 열기/저장/삭제 ---
  function openEditModal(pin) {
      selectedPin = pin;
      editPinName.value = pin.name;
      editPinEmoji.value = pin.emoji || '';
      editPinComment.value = pin.comment || '';
      editPinColor.value = pin.color || '#ff8c00';
      editModal.style.display = 'flex';
  }
  savePinBtn.addEventListener('click', async () => {
      if (!selectedPin) return;
      const name = editPinName.value.trim();
      const emoji = editPinEmoji.value.trim() || '';
      const comment = editPinComment.value.trim();
      const color = editPinColor.value;
      if (!name) { alert('물건 이름을 입력하세요.'); return; }
      try {
          const res = await apiFetch(`/api/pins/${selectedPin.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, emoji, comment, color })
          });
          if (res.ok) {
              Object.assign(selectedPin, { name, emoji, comment, color });
              updatePinOnMap(selectedPin);
              renderPinList();
              console.log(`물건 "${name}" 정보 수정됨.`);
              renderHistory();
              closeEditModal();
          } else {
              const err = await res.json();
              alert(err.error || '수정 실패');
          }
      } catch {
          alert('서버 연결 실패');
      }
  });
  deletePinBtn.addEventListener('click', async () => {
      if (!selectedPin) return;
      if (!confirm(`정말 "${selectedPin.name}"을 삭제하시겠습니까?`)) return;
      try {
          const res = await apiFetch(`/api/pins/${selectedPin.id}`, { method: 'DELETE' });
          if (res.ok) {
              pins = pins.filter(p => p.id !== selectedPin.id);
              document.querySelector(`.pin[data-id="${selectedPin.id}"]`)?.remove();
              renderPinList();
              console.log(`물건 "${selectedPin.name}" 삭제됨.`);
              renderHistory();
              closeEditModal();
          } else {
              const err = await res.json();
              alert(err.error || '삭제 실패');
          }
      } catch {
          alert('서버 오류');
      }
  });
  cancelBtn.addEventListener('click', closeEditModal);
  function closeEditModal() {
      selectedPin = null;
      editModal.style.display = 'none';
  }
  function updatePinOnMap(pin) {
      const el = floorplanContainer.querySelector(`.pin[data-id="${pin.id}"]`);
      if (!el) return;
      el.style.left = pin.x + 'px';
      el.style.top = pin.y + 'px';
      el.style.backgroundColor = pin.color;
      el.textContent = pin.emoji;
  }

  // --- 히스토리 로컬 추가 ---
  // function addHistory(text) {
  //   // myHistory.unshift({ time: Date.now(), text });

  // }

  // --- 물건 옮기기 토글 ---
  movePinBtn.addEventListener('click', () => {
      isMovingPin = !isMovingPin;
      movePinBtn.textContent = isMovingPin ? '옮기기 중 (클릭하여 종료)' : '물건 옮기기';
      floorplanContainer.style.cursor = isMovingPin ? 'grab' : 'default';
  });

  // --- 탭 전환 ---
  // --- 탭 전환 ---
  tabButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
          // 1) active 클래스 토글
          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const pins = document.querySelectorAll('.pin:not(.pinHistory)');

          // 2) 화면 전환 및 데이터 로드
          if (btn.dataset.tab === 'pinList') {
              pinListDiv.style.display = 'block';
              historyListDiv.style.display = 'none';
              pins.forEach(pin => pin.style.display = 'block');
              renderPinList();
              // 히스토리 궤적만 제거
              document.querySelectorAll('.pinHistory').forEach(el => el.remove());
              document.querySelectorAll('.historyLine').forEach(el => el.remove());
          } else {
              pinListDiv.style.display = 'none';
              pins.forEach(pin => pin.style.display = 'none');
              historyListDiv.style.display = 'block';
              // 히스토리 탭 클릭 시 즉시 궤적 그리기
              await loadHistory();
          }
      });
  });

  window.addEventListener('load', () => {
  init();
});
})();