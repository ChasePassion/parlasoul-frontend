const RESUME_CHARACTER_KEY = "parlasoul.resume_character_id";

// 访客点击角色时被引导去登录；登录并补齐资料后自动打开刚点的角色。
// 用 localStorage 而不是 sessionStorage：手机浏览器在跳转/后台时更容易回收 sessionStorage。
export function setResumeCharacterId(characterId: string): void {
  try {
    window.localStorage.setItem(RESUME_CHARACTER_KEY, characterId);
  } catch {
    // localStorage 在隐私模式下可能不可用；此时仍能正常登录，只是不自动续接角色。
  }
}

// 只读，不消费。用于判断「这次登录是否由点击角色触发」，以及决定弹窗是否让路。
export function peekResumeCharacterId(): string | null {
  try {
    return window.localStorage.getItem(RESUME_CHARACTER_KEY);
  } catch {
    return null;
  }
}

export function takeResumeCharacterId(): string | null {
  try {
    const value = window.localStorage.getItem(RESUME_CHARACTER_KEY);
    if (value) {
      window.localStorage.removeItem(RESUME_CHARACTER_KEY);
    }
    return value;
  } catch {
    return null;
  }
}
