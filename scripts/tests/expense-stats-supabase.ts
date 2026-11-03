export { supabase, handleSupabaseError, generateOrderNumber } from './request-consumption/supabase';
export async function withSurveyTokenHeader<T>(_token: string, action: () => Promise<T>): Promise<T> {
  return action();
}
