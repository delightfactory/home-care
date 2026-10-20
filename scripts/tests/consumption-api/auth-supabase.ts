function deferred<T>() {
  let resolve!: (response: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

export const authBoundary = {
  initial: deferred<any>(),
  listeners: new Set<(event: string, session: unknown) => void>(),
  profiles: [] as { id: string; resolve: (response: unknown) => void }[],
  holdRole: false,
  roleRequests: [] as { resolve: (response: unknown) => void; reject: (failure: Error) => void }[],
  signOuts: 0,
};
export const sessionFor = (id: string) => ({ user: { id }, access_token: `synthetic-${id}` });
export const profileFor = (id: string, permissions = { orders: { read: true } }) => ({
  id, full_name: 'Synthetic QA', role_id: 'role', is_active: true, role: { permissions },
});
export const emitSession = (id: string) => authBoundary.listeners.forEach(callback => callback('SIGNED_IN', sessionFor(id)));
export function completeProfile(id: string, permissions?: any, latest = false) {
  const request = latest ? authBoundary.profiles.findLastIndex(profile => profile.id === id) : authBoundary.profiles.findIndex(profile => profile.id === id);
  if (request < 0) throw Error(`No profile request for ${id}`);
  authBoundary.profiles.splice(request, 1)[0].resolve({ data: profileFor(id, permissions), error: null });
}
export function failProfile(id: string) {
  const request = authBoundary.profiles.findIndex(profile => profile.id === id);
  if (request < 0) throw Error(`No profile request for ${id}`);
  authBoundary.profiles.splice(request, 1)[0].resolve(Promise.reject(Error('profile offline')));
}
export function resetAuthBoundary() {
  authBoundary.initial = deferred();
  authBoundary.listeners.clear();
  authBoundary.profiles = [];
  authBoundary.holdRole = false;
  authBoundary.roleRequests = [];
  authBoundary.signOuts = 0;
}
export const supabase = {
  auth: {
    getSession: () => authBoundary.initial.promise,
    onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
      authBoundary.listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authBoundary.listeners.delete(callback) } } };
    },
    signOut: () => { authBoundary.signOuts++; return Promise.resolve(); },
  },
  from: () => {
    let userId = '';
    const query = {
      select: () => query,
      eq: (_column: string, id: string) => { userId = id; return query; },
      single: () => new Promise(resolve => authBoundary.profiles.push({ id: userId, resolve })),
    };
    return query;
  },
  rpc: async () => authBoundary.holdRole
    ? new Promise((resolve, reject) => authBoundary.roleRequests.push({ resolve, reject }))
    : ({ data: 'manager', error: null }),
};
