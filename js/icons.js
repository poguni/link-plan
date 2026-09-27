// 아이콘 스프라이트(assets/icons.svg, Lucide)를 페이지 맨 앞에 한 번 넣고, <use> 로 참조하는 도우미입니다.
// 스프라이트를 index.html 에 복사해 두면 원본과 어긋날 수 있어서, 시작할 때 원본을 읽어 넣습니다.

export async function loadIcons() {
  if (document.getElementById('icon-sprite')) return;
  const res = await fetch('assets/icons.svg');
  if (!res.ok) throw new Error('아이콘 파일을 불러오지 못했어요.');
  const holder = document.createElement('div');
  holder.id = 'icon-sprite';
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = await res.text();
  document.body.prepend(holder);
}

// 글자 없이 아이콘만 쓰는 버튼에는 호출하는 쪽에서 aria-label 을 붙입니다.
export function icon(id, size = 18, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${id}"/></svg>`;
}
