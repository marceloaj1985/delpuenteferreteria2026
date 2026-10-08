import { getStore, saveStore } from './queries.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  const store = getStore();
  const displayName = name || email.split('@')[0] || 'Vendedor';
  const existing = store.users.find((u) => u.uid === uid);

  if (existing) {
    existing.email = email;
    if (name) existing.name = name;
    saveStore();
    return existing;
  }

  const nextId =
    store.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
  const created = {
    id: nextId,
    uid,
    email,
    name: displayName,
    role: 'Vendedor Senior / Caja 01',
    activeBranchId: 1,
    createdAt: new Date().toISOString(),
  };
  store.users.push(created);
  saveStore();
  return created;
}

export async function updateUserActiveBranch(uid: string, branchId: number) {
  const store = getStore();
  let existing = store.users.find((u) => u.uid === uid);
  if (!existing) {
    existing = await getOrCreateUser(uid, 'vendedor@ferreteriadelpuente.com.ar');
  }
  existing.activeBranchId = branchId;
  saveStore();
  return existing;
}
