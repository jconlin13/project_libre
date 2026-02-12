import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PersonDetailContent } from "./person-detail-content";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const person = await prisma.user.findUnique({
    where: { id },
  });

  if (!person) {
    notFound();
  }

  const isCurrentUser = currentUser.id === person.id;

  if (!isCurrentUser) {
    const sharedHousehold = await prisma.householdMember.findFirst({
      where: {
        userId: person.id,
        household: {
          members: {
            some: {
              userId: currentUser.id,
            },
          },
        },
      },
    });

    if (!sharedHousehold) {
      notFound();
    }
  }

  return (
    <PersonDetailContent
      person={{
        id: person.id,
        name: person.name,
        email: person.email,
        avatarUrl: person.avatarUrl,
        hardcoverConnected: !!person.hardcoverApiToken,
        hardcoverUsername: person.hardcoverUsername,
      }}
      isCurrentUser={isCurrentUser}
    />
  );
}
