// Move list (기술 일람표) per character, shown from the setup screen with the pad's Ⓑ button
// (or by touching the character that is already selected).
// Inputs use pad notation: → toward the opponent, ← away, Ⓐ attack, Ⓑ guard.
import { WEAPONS, SUPERS, canDoubleJump } from './config.js';

// [normal, forward, air, charged, back-step]
const NAMES = {
  sword:   ['내려베기', '돌진 찌르기', '공중 베기', '대검 일격', '버티며 베기'],
  spear:   ['찌르기', '장창 돌격', '공중 찌르기', '회전 창격', '버티며 찌르기'],
  axe:     ['도끼 찍기', '돌진 찍기', '공중 찍기', '대지 가르기'],
  dagger:  ['찌르기', '파고들기', '공중 베기', '쌍검 난도'],
  fist:    ['정권', '돌진 권', '공중 발차기', '기공 장타'],
  stag:    ['집게 물기', '돌진 물기', '공중 물기', '집게 박치기', '버티며 물기'],
  genghis: ['언월도 베기', '기마 돌진 베기', '도약 베기', '청룡 일섬', '버티며 베기'],
  mace:    ['철퇴 내리치기', '중갑 돌진', '공중 강타', '분쇄 일격', '버티며 휘두르기'],
  fork:    ['갈퀴 찌르기', '쇠스랑 돌진', '공중 찌르기', '건초 뒤집기', '버티며 찌르기'],
  tkd:     ['앞차기', '돌려차기', '공중 차기', '뒷차기', '내려찍기'],
  archer:  ['환도 베기', '돌진 베기', '공중 베기', '활쏘기', '횡베기'],
  whip:    ['채찍 후리기', '롱 래시', '공중 채찍', '리볼버 사격']
};
const DIVE = { axe: '공중 내려찍기', dagger: '칼날찌르기', fist: '날라차기', tkd: '날라차기' };

// → { name, rows: [{ kind, name, input, note }] }
export function moveList(w) {
  const st = WEAPONS[w], n = NAMES[w], sup = SUPERS[w];
  const rows = [
    { kind: '기본 공격', name: n[0], input: 'Ⓐ', note: '' },
    { kind: '전진 공격', name: n[1], input: '→ + Ⓐ', note: st.longArmor ? '조금 느리지만 리치가 길다 · 맞아도 끊기지 않음' : '조금 느리지만 리치가 길다' },
    { kind: '공중 공격', name: n[2], input: '점프 중 Ⓐ', note: '데미지 1.5배' },
    { kind: '차징 공격', name: n[3], input: 'Ⓐ 길게', note: st.bow ? '활을 장전해 곡사로 쏜다 · 방어를 깨뜨림'
      : st.gun ? '활보다 조금 길게 장전해 권총을 쏜다 · 키 3.5배까지 곧게 날아간 뒤 뚝 떨어짐 · 방어를 깨뜨림' : '평타 후 힘을 모아 한 번 더 · 방어를 깨뜨림' }
  ];
  if (!canDoubleJump(w) || st.heavy) rows.push({ kind: '버티기 공격', name: n[4], input: '← + Ⓐ',
    note: st.heavyHold ? '다리를 머리 높이로 들었다가 찍는다 · 맞아도 끊기지 않음'
      : st.holdImmune ? '공격하는 동안 데미지를 받지 않음 · 맞히면 다음 공격 1.5배 빠르게' : '맞아도 데미지만 받고 계속 공격' });
  if (canDoubleJump(w)) {
    rows.push({ kind: '2단 점프', name: '공중제비', input: '공중에서 ↑', note: '' });
    if (st.airLash) rows.push({ kind: '2단 공격', name: '공중 채찍 낙뢰', input: '2단 점프 중 Ⓐ', note: '공중에 멈춰 45° 아래로 채찍 리치 1.5배' });
    else rows.push({ kind: '2단 공격', name: DIVE[w] ?? '내리꽂기', input: '2단 점프 중 Ⓐ', note: '45°로 내리꽂는다' });
  }
  if (st.airDash) rows.push({ kind: '2단 점프', name: '공중 돌진', input: '공중에서 ↑', note: '수평으로 날아가는 동안 공격을 받지 않음' });
  if (st.blink) rows.push({ kind: '특수 이동', name: '그림자 걸음', input: '→ → (홀드)', note: '앞으로 키 3배 거리 순간이동' });
  if (st.rush) rows.push({ kind: '특수 이동', name: '기마 돌진', input: '→ → (홀드)', note: '앞으로 240px 질주 · 필살기와 공중 공격 말고는 맞지 않음' });
  if (st.reel) rows.push({ kind: '특수 이동', name: '갈고리 후퇴', input: '← ← (홀드)', note: '채찍을 뒤 땅에 걸고 당겨 키 2배 거리를 빠르게 후퇴' });
  rows.push({ kind: '방어', name: '막기', input: 'Ⓑ 홀드', note: '천천히 이동 가능' });
  rows.push({ kind: '방어', name: '패링', input: '맞기 직전 Ⓑ', note: '확정 0.1초 전 안에 누르면 데미지 없음 · 상대 0.2초 경직 (필살기·잡기 제외)' });
  rows.push({ kind: '필살기', name: sup.name, input: '게이지 MAX · Ⓐ+Ⓑ 1초', note: '' });
  return { name: WEAPONS[w].name, rows };
}
