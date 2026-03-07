import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_PATH = path.join(process.cwd(), "mcp-operator.users.json");

function readUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_PATH)) return [];
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), { mode: 0o600 });
}

export function findUserByEmail(email: string): User | undefined {
  return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const users = readUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Email already registered");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = { id: randomUUID(), email, name, passwordHash, createdAt: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
  return user;
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = findUserByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}
