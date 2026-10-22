type AuthSession = { user: { id: string }; access_token: string } | null;
let listener: (event: string, session: AuthSession) => void;
export const authEvents = {
  emit(event: string, session: AuthSession) { listener(event, session); },
};
export const createClient = () => ({
  auth: { onAuthStateChange(callback: typeof listener) { listener = callback; } },
});
