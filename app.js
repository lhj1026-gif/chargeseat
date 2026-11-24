const spotTemplates = [
  { id:'spot-a', name:'충전 스팟 A', short:'스팟 A', category:'카페', meters:180, available:4, total:10, kind:'library', initial:'A', rating:'예시 충전 좌석' },
  { id:'spot-b', name:'충전 스팟 B', short:'스팟 B', category:'도서관', meters:390, available:2, total:6, kind:'cafe', initial:'B', rating:'예시 충전 좌석' },
  { id:'spot-c', name:'충전 스팟 C', short:'스팟 C', category:'스터디 공간', meters:610, available:1, total:8, kind:'study', initial:'C', rating:'예시 충전 좌석' },
  { id:'spot-d', name:'충전 스팟 D', short:'스팟 D', category:'카페', meters:840, available:0, total:5, kind:'roastery', initial:'D', rating:'예시 충전 좌석' }
];
const seats = [
  { id:'A-01',zone:'a',state:'available',w:15,plug:2 },{ id:'A-02',zone:'a',state:'occupied',w:15,plug:2 },{ id:'A-03',zone:'a',state:'available',w:15,plug:2 },{ id:'A-04',zone:'a',state:'available',w:15,plug:2 },{ id:'A-05',zone:'a',state:'occupied',w:15,plug:1 },
  { id:'B-01',zone:'b',state:'occupied',w:10,plug:0 },{ id:'B-02',zone:'b',state:'available',w:15,plug:2 },{ id:'B-03',zone:'b',state:'occupied',w:10,plug:0 },{ id:'B-04',zone:'b',state:'disabled',w:0,plug:0 },{ id:'B-05',zone:'b',state:'available',w:15,plug:1 },
  { id:'C-01',zone:'c',state:'occupied',w:15,plug:1 },{ id:'C-02',zone:'c',state:'occupied',w:15,plug:1 },{ id:'C-03',zone:'c',state:'available',w:15,plug:2 },{ id:'C-04',zone:'c',state:'occupied',w:10,plug:0 },{ id:'C-05',zone:'c',state:'occupied',w:15,plug:2 }
];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const placeList=$('#place-list'), seatModal=$('#seat-modal');
const previewSpots=spotTemplates.map((spot,index)=>({...spot,direction:['북동쪽','남동쪽','남서쪽','북서쪽'][index],walk:Math.max(1,Math.ceil(spot.meters/75)),address:'위치 권한 전 · 주변 지도 미리보기'}));
let places=[...previewSpots],currentPosition=null,activePlace='spot-a',selectedSeat='A-04',filterAvailable=false,saved=new Set(['spot-b','spot-c']),zoom=1,toastTimer,showSaved=false;

function buildNearbySpots(position){
  return spotTemplates.map((template,index)=>{
    const bearing=[28,137,224,318][index],radians=bearing*Math.PI/180,distance=template.meters;
    const lat=position.latitude+(distance*Math.cos(radians))/111320;
    const lon=position.longitude+(distance*Math.sin(radians))/(111320*Math.max(.2,Math.cos(position.latitude*Math.PI/180)));
    return {...template,latitude:lat,longitude:lon,bearing,direction:['북동쪽','남동쪽','남서쪽','북서쪽'][index],walk:Math.max(1,Math.ceil(distance/75)),address:`현재 위치에서 ${['북동쪽','남동쪽','남서쪽','북서쪽'][index]} · 약 ${distance}m`};
  });
}
function visiblePlaces(){
  const q=$('#search-input').value.trim().toLowerCase();
  return places.filter(p=>(!showSaved||saved.has(p.id))&&(!q||`${p.name} ${p.short} ${p.category} ${p.address}`.toLowerCase().includes(q))&&(!filterAvailable||p.available>0));
}
function renderPlaces(){
  const list=visiblePlaces();$('#place-count').textContent=list.length;
  if(!list.length){placeList.innerHTML=currentPosition?'<div class="empty-results"><span>⌕</span><strong>검색 결과가 없습니다.</strong><small>필터를 끄거나 다른 검색어를 입력해 주세요.</small><button id="clear-search">검색 초기화</button></div>':'<div class="empty-results"><span>⌖</span><strong>표시할 주변 스팟이 없어요</strong><small>현재 위치를 확인하면 주변 데모 스팟을 계산해요.</small><button id="list-locate">현재 위치 사용하기</button></div>';}
  else placeList.innerHTML=list.map(p=>`<article class="place-card ${p.id===activePlace?'selected':''} ${p.available===0?'full':''}" data-id="${p.id}" tabindex="0" aria-label="${p.name}, 예시 충전 가능 ${p.available}/${p.total}석"><div class="place-thumb ${p.kind}"><span class="thumb-initial">${p.initial}</span></div><div class="place-card-copy"><div class="place-title-line"><strong>${p.name}</strong><span class="open-label">데모</span></div><div class="place-address">${p.address}</div><div class="place-meta-line"><span class="walk">⌖ <b>${p.walk}분</b></span><i class="meta-separator"></i><span>${p.rating}</span></div></div><div class="place-card-state"><div class="state-count">${p.available}<span> / ${p.total}석</span></div><div class="state-caption"><i></i>${p.available>0?'예시 빈자리':'예시 만석'}</div></div><button class="card-save ${saved.has(p.id)?'saved':''}" data-save="${p.id}" aria-label="${saved.has(p.id)?'저장 취소':'장소 저장'}">${saved.has(p.id)?'♥':'♡'}</button></article>`).join('');
  $$('.place-card').forEach(c=>{c.addEventListener('click',e=>{if(e.target.closest('[data-save]'))return;selectPlace(c.dataset.id)});c.addEventListener('keydown',e=>{if(e.key==='Enter')selectPlace(c.dataset.id)})});
  $$('[data-save]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleSaved(b.dataset.save)}));
  $('#clear-search')?.addEventListener('click',()=>{$('#search-input').value='';renderPlaces()});
  $('#list-locate')?.addEventListener('click',requestCurrentLocation);
  $('#saved-count').textContent=saved.size;
}
function renderMap(){
  const points=$('#map-points');points.innerHTML='';
  const dot=$('#user-map-dot'),empty=$('#map-empty');
  if(!places.length){dot.hidden=true;empty.hidden=false;$('#map-tooltip').hidden=true;return;}
  dot.hidden=!currentPosition;empty.hidden=true;$('#map-user-label').textContent=currentPosition?'현재 위치':'예시 중심';
  places.forEach((p,index)=>{
    const previewPositions=[[67,31],[73,65],[29,69],[31,32]];
    const north=currentPosition?(p.latitude-currentPosition.latitude)*111320:0;
    const east=currentPosition?(p.longitude-currentPosition.longitude)*111320*Math.cos(currentPosition.latitude*Math.PI/180):0;
    const left=currentPosition?Math.max(12,Math.min(87,50+east/19)):previewPositions[index][0];
    const top=currentPosition?Math.max(15,Math.min(84,50-north/19)):previewPositions[index][1];
    const pin=document.createElement('button');pin.className=`map-pin ${p.available===0?'full-pin':''} ${p.id===activePlace?'active':''}`;pin.dataset.place=p.id;pin.style.left=`${left}%`;pin.style.top=`${top}%`;
    pin.setAttribute('aria-label',`${p.name}, ${p.meters}미터, 데모 충전 가능 좌석 ${p.available}석`);
    pin.innerHTML=`<span class="pin-icon">ϟ</span><span class="pin-bubble">${p.available?`${p.available}<small> / ${p.total}</small>`:'만석'}</span>`;
    pin.addEventListener('click',()=>selectPlace(p.id));points.append(pin);
  });
  dot.style.left='50%';dot.style.top='50%';
  if(activePlace)updateTooltip(places.find(p=>p.id===activePlace));
}
function updateTooltip(p){
  if(!p){$('#map-tooltip').hidden=true;return;}
  const tip=$('#map-tooltip');tip.hidden=false;tip.style.left='12px';tip.style.top='12px';
  tip.querySelector('b').textContent=p.name;tip.querySelector('span').innerHTML=`데모 빈자리 <strong>${p.available}</strong>/${p.total}석`;tip.querySelector('small').textContent=currentPosition?`${p.direction} · 약 ${p.meters}m · 도보 ${p.walk}분`:'주변 지도 미리보기 · 실제 장소 아님';
}
function selectPlace(id){activePlace=id;selectedSeat='A-04';const p=places.find(x=>x.id===id);if(!p)return;$$('.place-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));$$('.map-pin').forEach(b=>b.classList.toggle('active',b.dataset.place===id));updateTooltip(p);$('#modal-title').textContent=p.name;$('#modal-subtitle').textContent=`내 위치에서 ${p.direction} · 약 ${p.meters}m · 데모 좌석 배치`;renderPlaces()}
function toggleSaved(id){if(saved.has(id)){saved.delete(id);showToast('저장한 장소에서 삭제했어요.')}else{saved.add(id);showToast('장소를 저장했어요.')}renderPlaces()}
function renderSeats(){for(const zone of ['a','b','c']){$(`#zone-${zone}`).innerHTML=seats.filter(s=>s.zone===zone).map(s=>`<button class="seat-tile ${s.state} ${s.id===selectedSeat?'selected':''}" data-seat="${s.id}" aria-label="${s.id} ${statusText(s.state)} 예시"><strong>${s.id}</strong><small>${s.state==='disabled'?'점검 중':`${s.w}W`}</small></button>`).join('')};$$('.seat-tile').forEach(b=>b.addEventListener('click',()=>chooseSeat(b.dataset.seat)));updateSeatSummary()}
function statusText(s){return s==='available'?'빈자리':s==='occupied'?'사용 중':'점검 중'}
function chooseSeat(id){selectedSeat=id;renderSeats();const s=seats.find(x=>x.id===id);$('#selected-name').textContent=`${s.id} · ${s.zone==='a'?'창가 좌석':s.zone==='b'?'중앙 테이블':'포커스 좌석'}`;$('#selected-spec').textContent=s.state==='disabled'?'현재 점검 중인 좌석입니다.':`무선 충전 · ${s.w}W ${s.w===15?'고속 지원':'지원'}  ·  콘센트 ${s.plug}구`;const badge=$('#selected-status');badge.classList.toggle('busy',s.state!=='available');badge.innerHTML=`<i></i>${statusText(s.state)} · 예시`;$('#seat-cta').disabled=s.state!=='available';$('#seat-cta').textContent=s.state==='available'?'이 좌석으로 이동하기 →':s.state==='occupied'?'사용 중인 좌석이에요':'점검 중인 좌석이에요'}
function updateSeatSummary(){const target=places.find(p=>p.id===activePlace),available=seats.filter(s=>s.state==='available').length,total=seats.length;if(target){target.available=available;target.total=total;}$('#modal-available').innerHTML=`${available}<span> / ${total}석</span>`;$('#modal-progress-fill').style.width=`${available/total*100}%`;$('#modal-progress-pct').textContent=`${Math.round(available/total*100)}%`;}
function openModal(){const p=places.find(p=>p.id===activePlace);$('#modal-title').textContent=p?.name??'좌석 지도 미리보기';$('#modal-subtitle').textContent=p?`내 위치에서 ${p.direction} · 약 ${p.meters}m · 데모 좌석 배치`:'위치 확인 전 · 예시 좌석 배치';renderSeats();chooseSeat(selectedSeat);seatModal.hidden=false;document.body.style.overflow='hidden'}
function closeModal(){seatModal.hidden=true;document.body.style.overflow=''}
function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
function requestCurrentLocation(){
  if(!navigator.geolocation){showLocationError('이 브라우저에서는 위치 기능을 사용할 수 없어요.');return;}
  $('#location-label').textContent='위치 확인 중…';$('#locate-button').classList.add('loading');
  navigator.geolocation.getCurrentPosition(position=>{
    currentPosition={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};
    places=buildNearbySpots(currentPosition);activePlace=places[0].id;showSaved=false;
    $('#search-input').value='';$('#location-label').textContent=`${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}`;
    $('#locate-button').classList.remove('loading');$('#insight-title').innerHTML=`내 위치 기준 반경 2km 안에 <span>${places.length}</span>개 데모 스팟이 있어요`;
    renderPlaces();renderMap();showToast(`현재 위치를 확인했어요 · 정확도 약 ${Math.round(currentPosition.accuracy)}m`);
  },error=>{
    const message=error.code===1?'위치 권한이 거부됐어요. 브라우저 설정에서 위치 권한을 허용해 주세요.':error.code===2?'현재 위치를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.':'위치 확인 시간이 초과됐어요. 다시 시도해 주세요.';
    $('#locate-button').classList.remove('loading');showLocationError(message);
  },{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
}
function showLocationError(message){$('#location-label').textContent='위치를 찾을 수 없어요';$('#insight-title').textContent=message;showToast(message);renderPlaces();renderMap()}

$('#search-input').addEventListener('input',renderPlaces);
$('#available-filter').addEventListener('click',()=>{filterAvailable=!filterAvailable;$('#available-filter').classList.toggle('active',filterAvailable);$('#available-filter').setAttribute('aria-pressed',filterAvailable);renderPlaces()});
$('#open-seats').addEventListener('click',openModal);$$('[data-tab="seats"]').forEach(b=>b.addEventListener('click',openModal));
$('#modal-close').addEventListener('click',closeModal);seatModal.addEventListener('click',e=>{if(e.target===seatModal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search-input').focus()}});
$('#refresh-seats').addEventListener('click',()=>{const button=$('#refresh-seats');button.classList.add('spinning');setTimeout(()=>{const candidate=seats.filter(s=>s.state!=='disabled');const seat=candidate[Math.floor(Math.random()*candidate.length)];seat.state=seat.state==='available'?'occupied':'available';$('#refreshed-at').textContent='방금 바뀐 데모 상태';renderSeats();chooseSeat(selectedSeat);renderPlaces();button.classList.remove('spinning');showToast('좌석 데모 상태를 바꿨어요.')},620)});
$('#seat-cta').addEventListener('click',()=>{const s=seats.find(s=>s.id===selectedSeat);if(s?.state!=='available')return;closeModal();showToast(`${s.id}은 데모 좌석이에요. 실제 좌석을 예약하지 않았어요.`)});
$('#more-places').addEventListener('click',()=>showToast('현재 표시된 위치 주변 데모 스팟이 전부예요.'));
$('#sort-button').addEventListener('click',()=>{places.sort((a,b)=>a.meters-b.meters);renderPlaces();renderMap();showToast('내 위치에서 가까운 순으로 표시해요.')});
$('#locate-button').addEventListener('click',requestCurrentLocation);$('#map-locate').addEventListener('click',requestCurrentLocation);$('#map-locate-empty').addEventListener('click',requestCurrentLocation);
$('#zoom-in').addEventListener('click',()=>setZoom(1.1));$('#zoom-out').addEventListener('click',()=>setZoom(.9));
function setZoom(delta){zoom=Math.max(.8,Math.min(1.5,zoom+delta-1));$('.map-roads').style.transform=`scale(${zoom})`;$('.map-grid').style.backgroundSize=`${88*zoom}px ${78*zoom}px`;showToast(`주변 지도 배율 ${Math.round(zoom*100)}%`)}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='seats'){openModal();return;}$$('.nav-item').forEach(n=>n.classList.toggle('active',n===b));showSaved=b.dataset.tab==='saved';$('#breadcrumb-current').textContent=showSaved?'저장한 장소':'주변 탐색';$('#page-title').innerHTML=showSaved?'저장한 장소를 모아봤어요<span>.</span>':'어디서 충전할까요<span>?</span>';renderPlaces()}));
renderPlaces();renderMap();
