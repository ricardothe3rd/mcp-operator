"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Props {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export default function UserMenu({ name, email, image }: Props) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (email?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        {image && <AvatarImage src={image} alt={name ?? "User"} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground hidden sm:block">{name}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
