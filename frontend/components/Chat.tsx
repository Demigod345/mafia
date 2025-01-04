import { useCallback } from "react";
import { Chatbox, Session } from "@talkjs/react";
import Talk from "talkjs";
import { useParams } from "next/navigation";

interface ChatProps {
  name: string;
}

export function Chat({ name }: ChatProps) {
  const { gameId } = useParams();

  const syncUser = useCallback(
    () =>
      new Talk.User({
        id: name.toString().toLowerCase(),
        name: name.toString(),
        email: null,
        photoUrl: `https://robohash.org/${name}.png`,
        welcomeMessage: "Hi! Welcome to Mafia!",
      }),
    [name]
  );

  const syncConversation = useCallback(
    (session: Talk.Session) => {
      const conversation = session.getOrCreateConversation(gameId as string);
      conversation.setParticipant(session.me);
      return conversation;
    },
    [gameId]
  );

  return (
    <Session appId="tQrD36pK" syncUser={syncUser}>
      <Chatbox
        syncConversation={syncConversation}
        style={{ height: "500px" }}
      />
    </Session>
  );
}

