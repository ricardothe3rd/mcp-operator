import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();
  if (!data) return undefined;
  return { id: data.id, email: data.email, name: data.name, passwordHash: data.password_hash, createdAt: data.created_at };
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already registered");
  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from("users")
    .insert({ email: email.toLowerCase(), name, password_hash: passwordHash })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, email: data.email, name: data.name, passwordHash: data.password_hash, createdAt: data.created_at };
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}
